import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { completeTeenSignup, getUserProfile } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const completeAccountSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CompleteAccountFormData = z.infer<typeof completeAccountSchema>;

export default function CompleteAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ parentEmail?: string }>();
  const { setUser, setLoading } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<CompleteAccountFormData>({
    resolver: zodResolver(completeAccountSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: CompleteAccountFormData) => {
    if (!params.parentEmail) {
      Alert.alert('Error', 'Parent email is missing. Please start over.');
      router.replace('/role-selection');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      const { user, profile } = await completeTeenSignup(
        params.parentEmail,
        data.email,
        data.password
      );

      if (!user) {
        throw new Error('Failed to create user account');
      }

      if (!profile) {
        throw new Error('Failed to create user profile');
      }

      // Use the profile returned directly from createUserProfile
      setUser(profile);

      // Clear stored parent email
      await AsyncStorage.removeItem('pending_signup_parent_email');

      Alert.alert(
        'Account Created!',
        'Your account has been created successfully. Welcome to Ollie!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (error: any) {
      console.error('Complete account error:', error);
      Alert.alert(
        'Account Creation Failed',
        error.message || 'Failed to create account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

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
          onPress={() => {
            // Navigate back to check-status if we have parentEmail, otherwise to role-selection
            if (params.parentEmail) {
              router.replace(`/auth/check-status`);
            } else {
              router.replace('/role-selection');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
        </Pressable>

        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
          Complete Your Account
        </Text>
        
        <Text style={[styles.subtitle, subtitleStyle]}>
          Great news! Your parent has approved your account. Now let's set up your login credentials.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Your Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
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
              placeholder="At least 8 characters"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirm Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              required
              secureTextEntry
              placeholder="Re-enter your password"
            />
          )}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
          />
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
    marginBottom: 24,
    marginTop: 0,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  buttonContainer: {
    marginTop: 24,
  },
});

