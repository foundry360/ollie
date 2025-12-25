import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { signIn, resetPassword, getUserProfile, createUserProfile, supabase } from '@/lib/supabase';
import { getNeighborApplicationByUserId } from '@/lib/api/neighborApplications';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [showEmailField, setShowEmailField] = useState(false);
  const insets = useSafeAreaInsets();

  // Load last email from storage
  useEffect(() => {
    const loadLastEmail = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem('last_login_email');
        if (storedEmail) {
          setLastEmail(storedEmail);
          setShowEmailField(false); // Hide email field if we have stored email
        } else {
          setShowEmailField(true); // Show email field if no stored email
        }
      } catch (error) {
        console.error('Error loading last email:', error);
        setShowEmailField(true);
      }
    };
    loadLastEmail();
  }, []);

  const { control, handleSubmit, formState: { errors }, reset, setValue, watch, trigger } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Update form when lastEmail loads or when showEmailField changes
  useEffect(() => {
    if (lastEmail && !showEmailField) {
      // Set email value even when field is hidden so form validation works
      setValue('email', lastEmail, { shouldValidate: true, shouldDirty: false });
      // Trigger validation to ensure the email field is valid
      trigger('email');
    } else if (showEmailField && lastEmail) {
      // If email field is shown, clear the set value so user can type
      setValue('email', '', { shouldValidate: false, shouldDirty: false });
    }
  }, [lastEmail, showEmailField, setValue, trigger]);

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setLoading(true);
    let shouldClearLoadingInFinally = true;

    // Use lastEmail if email field is hidden, otherwise use form data
    // Also check the form value in case it was set via setValue
    const emailToUse = !showEmailField && lastEmail ? lastEmail : (data.email || lastEmail || '');

    // Validate email if field is shown
    if (showEmailField && !data.email) {
      Alert.alert('Error', 'Email is required');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }

    // Validate email format if we have an email
    if (emailToUse && !emailToUse.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }

    if (!emailToUse) {
      Alert.alert('Error', 'Email is required');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }

    if (!data.password) {
      Alert.alert('Error', 'Password is required');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }

    console.log('Attempting login with email:', emailToUse);

    try {
      const { user, error: signInError } = await signIn(emailToUse, data.password);

      if (signInError) {
        throw signInError;
      }

      if (!user) {
        throw new Error('Failed to sign in');
      }

      // FIRST: Check for pending neighbor application before attempting to load profile
      // This prevents bypassing the approval process if a profile somehow got created
      console.log('🔍 [login] Step 1: Checking for pending neighbor application');
      console.log('🔍 [login] User ID:', user.id, 'Email:', user.email);
      
      try {
        let pendingApp = await getNeighborApplicationByUserId(user.id);
        
        // If not found by user_id, try finding by email (in case user_id mismatch from multiple signups)
        // Use RPC function to bypass RLS
        if (!pendingApp && user.email) {
          console.log('⚠️ [login] No application found by user_id, trying by email via RPC:', user.email);
          const { data: appByEmail, error: emailError } = await supabase
            .rpc('find_pending_application_by_email', { p_email: user.email });
          
          console.log('🔍 [login] RPC result:', appByEmail, 'error:', emailError);
          
          if (appByEmail && Array.isArray(appByEmail) && appByEmail.length > 0) {
            console.log('✅ [login] Found application by email:', appByEmail[0].id, 'status:', appByEmail[0].status);
            pendingApp = appByEmail[0];
          } else {
            console.log('ℹ️ [login] No application found by email');
          }
        }
        
        if (pendingApp) {
          console.log('✅ [login] Found application with status:', pendingApp.status);
          
          if (pendingApp.status === 'pending') {
            console.log('⏳ [login] Application is pending - redirecting');
            setIsSubmitting(false);
            shouldClearLoadingInFinally = false;
            Alert.alert(
              'Application Pending',
              'Your neighbor application is still under review. Please wait for approval.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace({
                      pathname: '/auth/pending-neighbor-approval',
                      params: { applicationId: pendingApp.id }
                    });
                  }
                }
              ]
            );
            return;
          } else if (pendingApp.status === 'rejected') {
            console.log('❌ [login] Application was rejected - redirecting');
            setIsSubmitting(false);
            shouldClearLoadingInFinally = false;
            Alert.alert(
              'Application Rejected',
              pendingApp.rejection_reason || 'Your application was not approved.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace({
                      pathname: '/auth/neighbor-rejected',
                      params: { 
                        applicationId: pendingApp.id,
                        reason: pendingApp.rejection_reason || 'No reason provided'
                      }
                    });
                  }
                }
              ]
            );
            return;
          }
          // If approved, continue to load/create profile
          console.log('✅ [login] Application is approved, continuing to profile');
        }
      } catch (appCheckError) {
        console.log('ℹ️ [login] No application found or error:', appCheckError);
        // Continue - no application exists
      }

      // Fetch user profile
      console.log('🔍 [login] Step 2: Loading user profile');
      let profile;
      try {
        profile = await getUserProfile(user.id);
        console.log('✅ [login] Profile loaded successfully');
      } catch (profileError: any) {
        // If profile doesn't exist, create it using user metadata
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist - create one
          console.log('Creating profile from user metadata');
          
          const userMetadata = user.user_metadata || {};
          const fullName = userMetadata.full_name || 
                          userMetadata.name || 
                          user.email?.split('@')[0] ||
                          'User';
          
          const email = user.email;
          
          if (!email) {
            Alert.alert(
              'Error',
              'Unable to create profile: email is missing. Please contact support.'
            );
            return;
          }

          // Default role to 'poster' for email/password users
          const role = userMetadata.role || 'poster';

          try {
            // Create user profile
            profile = await createUserProfile(user.id, {
              email,
              full_name: fullName,
              role,
            });

            if (!profile) {
              // If profile creation didn't return data, fetch it
              profile = await getUserProfile(user.id);
            }
          } catch (createError: any) {
            console.error('Failed to create profile on login:', createError);
            Alert.alert(
              'Error',
              'Failed to create your profile. Please try again or contact support.'
            );
            return;
          }
        } else {
          throw profileError;
        }
      }
      
      if (!profile) {
        throw new Error('Failed to get user profile');
      }
      
      setUser(profile);

      // Store email for next login
      if (emailToUse) {
        try {
          await AsyncStorage.setItem('last_login_email', emailToUse);
        } catch (error) {
          console.error('Error saving last email:', error);
        }
      }

      // Wait for router to be ready before navigating
      // Use a longer delay and check if we can navigate
      setTimeout(() => {
        try {
          router.replace('/(tabs)/home');
        } catch (navError: any) {
          // If navigation fails, try again after a bit more delay
          console.log('Navigation failed, retrying...', navError);
          setTimeout(() => {
            router.replace('/(tabs)/home');
          }, 500);
        }
      }, 300);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // For other errors, show alert
      Alert.alert(
        'Login Failed',
        error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message || 'Failed to sign in. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
      if (shouldClearLoadingInFinally) {
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      await resetPassword(resetEmail);
      Alert.alert(
        'Password Reset Sent',
        'Check your email for password reset instructions.',
        [{ text: 'OK', onPress: () => setShowForgotPassword(false) }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send password reset email.');
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const linkTextStyle = isDark ? styles.linkTextDark : styles.linkTextLight;

  if (showForgotPassword) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <Text style={[styles.title, titleStyle]}>Reset Password</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>

          <Input
            label="Email"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            required
          />

          <Button
            title="Send Reset Link"
            onPress={handleForgotPassword}
            fullWidth
          />

          <View style={styles.loginLink}>
            <Text
              style={[styles.loginLinkText, linkTextStyle]}
              onPress={() => setShowForgotPassword(false)}
            >
              Back to Login
            </Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
          onPress={() => router.replace('/role-selection')}
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
          <Text style={[styles.welcomeText, isDark ? styles.welcomeTextDark : styles.welcomeTextLight]}>Welcome back{lastEmail ? `, ${lastEmail}!` : '!'}</Text>
        </View>

        {!showEmailField && lastEmail && (
          <Pressable
            style={styles.notMeLink}
            onPress={() => {
              setShowEmailField(true);
              reset({ email: '', password: '' });
            }}
          >
            <Text style={[styles.notMeText, linkTextStyle]}>(This is not me)</Text>
          </Pressable>
        )}

        <View style={[styles.loginFormContainer, isDark && styles.loginFormContainerDark]}>
          {showEmailField && (
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  required
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={styles.loginInput}
                />
              )}
            />
          )}

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
                autoComplete="password"
                style={styles.loginInput}
              />
            )}
          />

          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
          />
        </View>

        <Pressable
          style={styles.forgotPasswordLink}
          onPress={() => setShowForgotPassword(true)}
        >
          <Text style={[styles.forgotPasswordText, linkTextStyle]}>
            Forgot Password?
          </Text>
        </Pressable>

        <View style={styles.signupLink}>
          <Text
            style={[styles.signupLinkText, linkTextStyle]}
            onPress={() => router.push('/role-selection')}
          >
            Don't have an account? Sign up
          </Text>
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
    padding: 24,
    paddingTop: 0,
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 0,
  },
  logo: {
    width: 120,
    height: 120,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeTextLight: {
    color: '#000000',
  },
  welcomeTextDark: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  signupLink: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signupLinkText: {
    fontSize: 14,
  },
  loginLink: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
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
  notMeLink: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  notMeText: {
    fontSize: 14,
  },
  loginFormContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  loginFormContainerDark: {
    borderColor: '#4B5563',
    backgroundColor: '#111111',
  },
  loginInput: {
    fontSize: 14,
  },
});
