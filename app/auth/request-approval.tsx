import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { createPendingTeenSignup, sendParentApprovalEmail } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

// Phone validation: E.164 format (e.g., +1234567890)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

const requestSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  date_of_birth: z.date({
    required_error: 'Date of birth is required',
  }),
  parent_email: z.string().email('Please enter a valid parent email address'),
  parent_phone: z.string()
    .min(10, 'Parent phone number is required')
    .refine((val) => {
      // Remove spaces and non-digits (except +)
      let cleaned = val.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      // Auto-add +1 for US numbers if 10 digits without country code
      if (!cleaned.startsWith('+')) {
        if (cleaned.length === 10) {
          cleaned = `+1${cleaned}`;
        } else {
          cleaned = `+${cleaned}`;
        }
      }
      
      return phoneRegex.test(cleaned);
    }, 'Please enter a valid phone number (10 digits for US/Canada, or include country code)'),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function RequestApprovalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ birthdate?: string; age?: string }>();
  const { setLoading } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [birthDate, setBirthDate] = useState<Date | null>(null);

  const { control, handleSubmit, formState: { errors }, setValue } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      full_name: '',
      date_of_birth: new Date(2005, 0, 1),
      parent_email: '',
      parent_phone: '',
    },
  });

  useEffect(() => {
    if (params.birthdate) {
      const date = new Date(params.birthdate);
      // Validate the date
      if (isNaN(date.getTime())) {
        Alert.alert('Invalid Date', 'Please complete the age verification first.');
        router.replace('/auth/age-gate-teen');
        return;
      }
      setBirthDate(date);
      setValue('date_of_birth', date);
      console.log('Birthdate set:', date, 'ISO:', date.toISOString(), 'Date string:', date.toISOString().split('T')[0]);
      // Store birthdate for later use (e.g., check status)
      AsyncStorage.setItem('teen_birthdate', params.birthdate);
    } else {
      // If no birthdate param, redirect back to age gate
      Alert.alert('Missing Information', 'Please complete the age verification first.');
      router.replace('/auth/age-gate-teen');
    }
  }, [params.birthdate, setValue, router]);

  const calculateAgeLocal = (birthdate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
    return age;
  };

  const onSubmit = async (data: RequestFormData) => {
    const age = calculateAgeLocal(data.date_of_birth);
    
    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to use Ollie.');
      return;
    }
    if (age >= 18) {
      Alert.alert('Age Limit', 'Teens must be under 18. Please use the adult signup.');
      router.replace('/role-selection');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // Create pending signup (doesn't create account yet)
      // Email and password will be set when teen creates account after approval
      
      // Format date as YYYY-MM-DD for database (PostgreSQL DATE format)
      const dateStr = data.date_of_birth.toISOString().split('T')[0];
      console.log('Submitting with date_of_birth:', dateStr, 'from date:', data.date_of_birth);
      
      // Normalize phone number to E.164 format
      let normalizedPhone = data.parent_phone.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.length === 10) {
          normalizedPhone = `+1${normalizedPhone}`;
        } else {
          normalizedPhone = `+${normalizedPhone}`;
        }
      }
      
      const pendingSignup = await createPendingTeenSignup({
        full_name: data.full_name,
        date_of_birth: dateStr,
        parent_email: data.parent_email,
        parent_phone: normalizedPhone,
      });

      // Send approval email to parent
      try {
        await sendParentApprovalEmail(
          data.parent_email,
          pendingSignup.approval_token,
          {
            teenName: data.full_name,
            teenAge: age,
            // No email yet - will be collected after approval
          }
        );
      } catch (emailError: any) {
        // Log email error but don't fail the request - the signup was created
        console.warn('Failed to send approval email:', emailError);
        // Continue anyway - the parent can still approve via the token
      }

      // Store parent email in AsyncStorage for persistence
      await AsyncStorage.setItem('pending_signup_parent_email', data.parent_email);
      
      // Redirect to confirmation screen
      console.log('Success! Redirecting to request-sent screen with parentEmail:', data.parent_email);
      
      // Ensure loading state is cleared before navigation
      setIsSubmitting(false);
      setLoading(false);
      
      // Use a small delay to ensure state updates complete before navigation
      // This prevents the root layout from intercepting the navigation
      setTimeout(() => {
        const targetPath = `/auth/request-sent?parentEmail=${encodeURIComponent(data.parent_email)}`;
        console.log('Navigating to:', targetPath);
        router.replace(targetPath as any);
      }, 50);
    } catch (error: any) {
      console.error('Request error:', error);
      console.error('Error type:', typeof error);
      console.error('Error stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      let errorMessage = 'Failed to submit approval request. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          console.error('Could not stringify error:', e);
          console.error('Full error object:', error);
          console.error('Error keys:', Object.keys(error || {}));
        }
      }
      
      Alert.alert(
        'Request Failed',
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              // Don't navigate away - let user try again
            }
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
        </Pressable>

        <View style={styles.logoContainer}>
          <Image 
            source={isDark ? require('@/assets/logo.png') : require('@/assets/logo-dark.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.subtitle, subtitleStyle]}>
          You're one step away! Get your parent's approval and start connecting with neighbors today.
        </Text>

        <View style={styles.spacer} />

        <Controller
          control={control}
          name="full_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Your Full Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.full_name?.message}
              required
              autoCapitalize="words"
            />
          )}
        />

        <Controller
          control={control}
          name="parent_email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Your Parent's Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.parent_email?.message}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="parent@example.com"
            />
          )}
        />

        <Controller
          control={control}
          name="parent_phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Your Parent's Phone Number"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.parent_phone?.message}
              required
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+1234567890"
            />
          )}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Request Approval"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
          />
        </View>

        <Pressable 
          style={styles.checkStatusLink} 
          onPress={() => router.push('/auth/check-status')}
        >
          <Text style={[styles.checkStatusLinkText, isDark && styles.checkStatusLinkTextDark]}>
            Already submitted a request? Check status
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    alignSelf: 'flex-start',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 0,
  },
  logo: {
    width: 180,
    height: 180,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitleLight: {
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  spacer: {
    height: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  labelLight: {
    color: '#111827',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    marginTop: 24,
  },
  checkStatusLink: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  checkStatusLinkText: {
    fontSize: 14,
    color: '#73af17',
  },
  checkStatusLinkTextDark: {
    color: '#73af17',
  },
});

