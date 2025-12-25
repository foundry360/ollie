import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { signUp, signInWithGoogle, signInWithApple, supabase } from '@/lib/supabase';
import { createPendingNeighborApplication, checkEmailPhoneExists } from '@/lib/api/neighborApplications';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

// Phone validation: E.164 format (e.g., +1234567890)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string()
    .min(10, 'Phone number is required')
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

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupAdultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ birthdate?: string }>();
  const { setLoading } = useAuthStore();
  const { 
    setSignupData, 
    setApplicationId, 
    setCurrentStep 
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const insets = useSafeAreaInsets();

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      phone: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    setLoading(true);

    try {
      // Normalize phone number
      let normalizedPhone = data.phone.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      // Auto-add +1 for US numbers if user entered 10 digits without country code
      if (!normalizedPhone.startsWith('+')) {
        // If it's 10 digits, assume US and add +1
        if (normalizedPhone.length === 10) {
          normalizedPhone = `+1${normalizedPhone}`;
        } else {
          // Otherwise, add + prefix
          normalizedPhone = `+${normalizedPhone}`;
        }
      }
      
      const phoneWithPlus = normalizedPhone;
      
      // Validate phone format (E.164: + followed by 1-15 digits)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneWithPlus)) {
        Alert.alert(
          'Invalid Phone Number',
          `Please enter a valid phone number.\n\nUS/Canada: 10 digits (e.g., 1234567890) or +1234567890\nInternational: Include country code (e.g., +44...)\n\nYou entered: ${data.phone}`
        );
        setIsSubmitting(false);
        setLoading(false);
        return;
      }
      
      console.log('📱 [signup-adult] Original:', data.phone);
      console.log('📱 [signup-adult] Normalized phone:', phoneWithPlus);

      // Pre-validation: Check if email or phone already exists in our database
      console.log('🔍 [Pre-validation] Checking email:', data.email, 'and phone:', phoneWithPlus);
      const { emailExists, phoneExists } = await checkEmailPhoneExists(data.email, phoneWithPlus);
      console.log('🔍 [Pre-validation] Results - emailExists:', emailExists, 'phoneExists:', phoneExists);
      
      let hasErrors = false;
      
      if (emailExists) {
        console.log('❌ [Pre-validation] Email already exists in database');
        setEmailError('This email is already registered. Please log in or use a different email.');
        hasErrors = true;
      } else {
        console.log('✅ [Pre-validation] Email is available');
        setEmailError(undefined);
      }
      
      if (phoneExists) {
        console.log('❌ [Pre-validation] Phone already exists in database');
        setPhoneError('This phone number is already registered. Please log in or use a different number.');
        hasErrors = true;
      } else {
        console.log('✅ [Pre-validation] Phone is available');
        setPhoneError(undefined);
      }
      
      if (hasErrors) {
        console.log('❌ [Pre-validation] Has errors, stopping signup');
        setIsSubmitting(false);
        setLoading(false);
        return;
      }
      
      console.log('✅ [Pre-validation] All checks passed, proceeding with signup');

      // Step 1: Sign up with Supabase Auth (creates auth user but email not verified)
      let user;
      try {
        const signUpResult = await signUp(data.email, data.password, {
        full_name: data.full_name,
        role: 'poster',
          phone: phoneWithPlus,
      });
        user = signUpResult.user;
      } catch (signUpError: any) {
        // Check if it's a duplicate email error from Supabase Auth
        if (signUpError.code === 'user_already_exists' ||
            signUpError.message?.includes('already registered') || 
            signUpError.message?.includes('User already registered')) {
          console.log('❌ Email already exists in Supabase Auth');
          setEmailError('This email is already registered. Please log in or use a different email.');
          // Note: phoneError might already be set from pre-validation
          // Don't clear it, so both errors show if both are duplicates
          setIsSubmitting(false);
          setLoading(false);
          return;
        }
        throw signUpError;
      }

      if (!user) {
        throw new Error('Failed to create user account');
      }

      // Step 2: Create pending neighbor application
      // Uses a database function that handles RLS properly during signup
      let application;
      try {
        application = await createPendingNeighborApplication({
          userId: user.id,
          email: data.email,
          full_name: data.full_name,
          phone: phoneWithPlus,
        });
      } catch (appError: any) {
        // If creating the application fails, sign out to prevent orphaned session
        console.error('❌ Failed to create application, signing out:', appError);
        
        try {
          await supabase.auth.signOut();
          console.log('✅ Signed out to prevent orphaned session');
        } catch (signOutError) {
          console.error('Failed to sign out:', signOutError);
        }
        
        // Re-throw the original error to be handled by the outer catch
        throw appError;
      }

      // Step 3: Store signup data in store for next steps
      setSignupData({
        email: data.email,
        full_name: data.full_name,
        password: data.password,
        phone: phoneWithPlus,
        userId: user.id,
      });
      setApplicationId(application.id);
      setCurrentStep('verify-phone');

      // Step 4: Send SMS OTP
      // Note: We'll send OTP in the verify-phone screen to avoid rate limiting issues
      
      setLoading(false);
      setIsSubmitting(false);
      
      // Redirect to phone verification screen
      router.replace({
        pathname: '/auth/verify-phone',
        params: { 
          phone: phoneWithPlus,
          applicationId: application.id 
        }
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Check for specific duplicate errors from database
      if (error.message && typeof error.message === 'string') {
        const errorMsg = error.message;
        
        if (errorMsg.includes('PHONE_EXISTS:') || errorMsg.includes('unique_phone')) {
          setEmailError(undefined);
          setPhoneError('This phone number is already registered. Please log in or use a different number.');
          setIsSubmitting(false);
          setLoading(false);
          return;
        } else if (errorMsg.includes('EMAIL_EXISTS:') || errorMsg.includes('unique_email')) {
          setEmailError('This email is already registered. Please log in or use a different email.');
          setPhoneError(undefined);
          setIsSubmitting(false);
          setLoading(false);
          return;
        } else if (errorMsg.includes('DUPLICATE_ENTRY:')) {
          // If we can't determine which field, show on both
          setEmailError('This email or phone is already registered.');
          setPhoneError('This email or phone is already registered.');
          setIsSubmitting(false);
          setLoading(false);
          return;
        }
      }
      
      // Clear field errors for other error types
      setEmailError(undefined);
      setPhoneError(undefined);
      
      // For other errors, show generic alert with more details
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.message) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'An account with this email or phone already exists. Please log in instead.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else if (error.message.includes('function') && error.message.includes('not found')) {
          errorMessage = 'Database function not found. Please contact support.';
        } else if (error.code === '42883') {
          errorMessage = 'Database function not found. Please ensure all migrations have been run.';
        } else {
          // Show the actual error message for debugging
          errorMessage = error.message || 'An unexpected error occurred. Please try again.';
        }
      }
      
      console.error('Signup error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      Alert.alert('Signup Failed', errorMessage);
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const linkTextStyle = isDark ? styles.linkTextDark : styles.linkTextLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
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
          Signup with Ollie for free
        </Text>

        <Controller
          control={control}
          name="full_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Full Name"
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
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={(text) => {
                setEmailError(undefined); // Clear error when user types
                onChange(text);
              }}
              onBlur={onBlur}
              error={emailError || errors.email?.message}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              required
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => {
            // Auto-format: if user enters 10 digits without +, assume US and add +1
            const handlePhoneChange = (text: string) => {
              setPhoneError(undefined); // Clear error when user types
              
              // Remove all non-digits
              const digitsOnly = text.replace(/\D/g, '');
              
              // If starts with +, let user type freely
              if (text.startsWith('+')) {
                onChange(text);
                return;
              }
              
              // If 10 digits and no +, auto-add +1 for US
              if (digitsOnly.length === 10 && !text.includes('+')) {
                onChange(`+1${digitsOnly}`);
                return;
              }
              
              // Otherwise, just update the value
              onChange(text);
            };
            
            return (
              <View>
                <Input
                  label="Phone Number"
                  value={value}
                  onChangeText={handlePhoneChange}
                  onBlur={onBlur}
                  error={phoneError || errors.phone?.message}
                  required
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                />
              </View>
            );
          }}
        />

        <Button
          title="Continue"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />

        <View style={styles.loginLink}>
          <Text
            style={[styles.loginLinkText, linkTextStyle]}
            onPress={() => router.push('/auth/login')}
          >
            Already have an account? Login
          </Text>
        </View>

        <View style={[styles.divider, isDark && styles.dividerDark]}>
          <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
          <Text style={[styles.dividerText, isDark && styles.dividerTextDark]}>OR</Text>
          <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
        </View>

        <View style={styles.socialButtons}>
          <Pressable
            style={[styles.socialButton, isDark && styles.socialButtonDark]}
            onPress={async () => {
              try {
                await signInWithGoogle();
                // OAuth will redirect, so we don't need to handle the response here
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to sign in with Google');
              }
            }}
          >
            <Ionicons name="logo-google" size={20} color={isDark ? '#9CA3AF' : '#666666'} />
            <Text style={[styles.socialButtonText, isDark && styles.socialButtonTextDark]}>
              Google
            </Text>
          </Pressable>

          <Pressable
            style={[styles.socialButton, isDark && styles.socialButtonDark]}
            onPress={async () => {
              try {
                await signInWithApple();
                // OAuth will redirect, so we don't need to handle the response here
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to sign in with Apple');
              }
            }}
          >
            <Ionicons name="logo-apple" size={20} color={isDark ? '#9CA3AF' : '#666666'} />
            <Text style={[styles.socialButtonText, isDark && styles.socialButtonTextDark]}>
              Apple
            </Text>
          </Pressable>
        </View>
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
    backgroundColor: '#111827',
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
    marginBottom: 8,
    marginTop: 0,
  },
  logo: {
    width: 180,
    height: 180,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 24,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  loginLink: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  loginLinkText: {
    fontSize: 14,
  },
  linkTextLight: {
    color: '#73af17',
  },
  linkTextDark: {
    color: '#73af17',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    minHeight: 54,
    gap: 8,
  },
  socialButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  socialButtonTextDark: {
    color: '#9CA3AF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerDark: {
    // Same styling for dark mode
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerLineDark: {
    backgroundColor: '#4B5563',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  dividerTextDark: {
    color: '#9CA3AF',
  },
  helperText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});
