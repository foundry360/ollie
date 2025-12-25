import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useThemeStore();
  
  // Log URL info for debugging
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      console.log('🔍 [reset-password] Full URL:', window.location.href);
      console.log('🔍 [reset-password] Hash:', window.location.hash);
      console.log('🔍 [reset-password] Search params:', window.location.search);
      console.log('🔍 [reset-password] Route params:', params);
    }
  }, [params]);
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const insets = useSafeAreaInsets();

  const { control, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const validateToken = async () => {
      console.log('🔄 [reset-password] Starting token validation');
      
      // Add a maximum timeout to prevent infinite hanging
      const timeoutId = setTimeout(() => {
        console.log('⏱️ [reset-password] Validation timeout - forcing completion');
        setIsValidToken(false);
        setIsValidating(false);
      }, 10000); // 10 second max
      
      try {
        // On web, check for hash fragments or query parameters
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash;
          const searchParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(hash.substring(1)); // Remove #
          
          console.log('🔍 [reset-password] URL hash:', hash);
          console.log('🔍 [reset-password] URL search:', window.location.search);
          console.log('🔍 [reset-password] Hash params:', Object.fromEntries(hashParams));
          console.log('🔍 [reset-password] Search params:', Object.fromEntries(searchParams));
          
          // Check for code query parameter (PKCE flow)
          const code = searchParams.get('code');
          if (code) {
            console.log('✅ [reset-password] Code parameter found, exchanging for session...');
            try {
              // Exchange the code for a session
              const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              
              if (exchangeError) {
                console.error('❌ [reset-password] Error exchanging code:', exchangeError);
                setIsValidToken(false);
                setIsValidating(false);
                return;
              }
              
              if (session?.user) {
                console.log('✅ [reset-password] Session created from code, token is valid');
                setIsValidToken(true);
                setIsValidating(false);
                return;
              }
            } catch (error: any) {
              console.error('❌ [reset-password] Error exchanging code for session:', error);
              setIsValidToken(false);
              setIsValidating(false);
              return;
            }
          }
          
          // Check hash fragments (older flow)
          if (hash.includes('access_token') && hash.includes('type=recovery')) {
            console.log('✅ [reset-password] Hash fragments found, waiting for Supabase to process...');
            // Wait for Supabase to process the hash fragments
            // Try multiple times with increasing delays
            for (let i = 0; i < 5; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              const { data: { session }, error } = await supabase.auth.getSession();
              
              if (error) {
                console.error('❌ [reset-password] Error getting session:', error);
              }
              
              if (session?.user) {
                console.log('✅ [reset-password] Session found, token is valid');
                setIsValidToken(true);
                setIsValidating(false);
                return;
              }
              
              console.log(`⏳ [reset-password] Attempt ${i + 1}/5: No session yet, waiting...`);
            }
            
            // If we still don't have a session after 5 attempts, check if hash is still there
            const { data: { session: finalSession } } = await supabase.auth.getSession();
            if (finalSession?.user) {
              console.log('✅ [reset-password] Session found on final check');
              setIsValidToken(true);
              setIsValidating(false);
              return;
            }
            
            console.log('⚠️ [reset-password] Hash fragments present but no session after waiting');
            // Hash is present but no session - might be expired or invalid
            setIsValidToken(false);
            setIsValidating(false);
            return;
          }
        }

        // Check if we have a session (might already be set from a previous visit)
        console.log('🔍 [reset-password] Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [reset-password] Error getting session:', error);
          setIsValidToken(false);
          setIsValidating(false);
          return;
        }

        // If we have a session, the token is valid
        if (session?.user) {
          console.log('✅ [reset-password] Session found, token is valid');
          setIsValidToken(true);
          setIsValidating(false);
          return;
        }

        // No session and no hash fragments - invalid or expired
        // This means the user either:
        // 1. Navigated directly to the page without a reset link
        // 2. The reset link expired
        // 3. The redirect URL isn't configured correctly in Supabase
        console.log('❌ [reset-password] No session and no hash fragments - token invalid or expired');
        console.log('💡 [reset-password] This usually means:');
        console.log('   1. The reset link expired (they expire after 1 hour)');
        console.log('   2. The redirect URL is not in Supabase allowed redirect URLs');
        console.log('   3. User navigated directly to this page without a reset link');
        setIsValidToken(false);
        setIsValidating(false);
      } catch (error: any) {
        console.error('❌ [reset-password] Error validating reset token:', error);
        setIsValidToken(false);
        setIsValidating(false);
      } finally {
        // Clear timeout if validation completes
        clearTimeout(timeoutId);
      }
    };

    validateToken();
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully. You can now log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/auth/login');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to reset password. The link may have expired. Please request a new password reset.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/auth/login');
            },
          },
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
          <Text style={[styles.loadingText, isDark && styles.textDark]}>
            Validating reset link...
          </Text>
          <Text style={[styles.loadingText, isDark && styles.textDark, { marginTop: 20, fontSize: 12, opacity: 0.7 }]}>
            This should only take a moment...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isValidToken) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.replace('/auth/login')}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.backButtonText, isDark && styles.textDark]}>Back</Text>
            </Pressable>

            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={64} color="#FF3B30" />
              <Text style={[styles.errorTitle, isDark && styles.textDark]}>
                Invalid or Expired Link
              </Text>
              <Text style={[styles.errorMessage, isDark && styles.textDark]}>
                This password reset link is invalid or has expired. Please request a new password reset link.
              </Text>
              <Button
                title="Request New Reset Link"
                onPress={() => router.replace('/auth/login')}
                style={styles.button}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.replace('/auth/login')}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.backButtonText, isDark && styles.textDark]}>Back</Text>
            </Pressable>

            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.formContainer}>
              <Text style={[styles.title, isDark && styles.textDark]}>
                Reset Your Password
              </Text>
              <Text style={[styles.subtitle, isDark && styles.textDark]}>
                Enter your new password below
              </Text>

              <View style={styles.form}>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="New Password"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry
                      placeholder="Enter new password"
                      error={errors.password?.message}
                      autoCapitalize="none"
                      autoCorrect={false}
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
                      secureTextEntry
                      placeholder="Confirm new password"
                      error={errors.confirmPassword?.message}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}
                />

                <Button
                  title={isSubmitting ? 'Resetting Password...' : 'Reset Password'}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  style={styles.submitButton}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  textDark: {
    color: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#000000',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  formContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    color: '#666666',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  submitButton: {
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    color: '#000000',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    marginBottom: 32,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    marginTop: 16,
  },
});

