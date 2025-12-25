import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase, getUserProfile, verifyEmailCode, resendVerificationCode, createUserProfile } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { UserRole } from '@/types';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; full_name?: string; role?: string }>();
  const { setUser, setLoading } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState(params.email || '');
  const [isVerified, setIsVerified] = useState(false);
  const [code, setCode] = useState<string>(''); // 6 digits for Supabase OTP
  const codeInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Clear loading state immediately on mount to prevent loading screen flash
    // This must happen synchronously, not in a setTimeout
    setLoading(false);
    
    // Check for email in params
    if (params.email) {
      const normalizedEmail = params.email.trim().toLowerCase();
      const screenLoadTime = Date.now();
      setEmail(normalizedEmail);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/confirm-email.tsx:36',message:'confirm-email screen loaded',data:{email:normalizedEmail,timestamp:screenLoadTime},timestamp:screenLoadTime,sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Don't auto-request code here - Supabase already sends one during signup
      // Auto-requesting immediately causes rate limiting (60 second cooldown)
      // The user should use the code from the signup email, or use "Resend Code" button if needed
      console.log('📧 [confirm-email] Email confirmed:', normalizedEmail);
      console.log('📧 [confirm-email] Use the code from your signup email, or click "Resend Code" if needed');
      console.log('⏰ [confirm-email] Note: Verification codes expire after 1 hour');
    }
  }, [params.email, setLoading]);

  const handleCodeChange = (value: string) => {
    // Only allow digits and limit to 6 characters (Supabase OTP default)
    const digitsOnly = value.replace(/[^\d]/g, '');
    if (digitsOnly.length <= 6) {
      setCode(digitsOnly);
      
      // Auto-submit when 6 digits are entered (with a small delay to prevent double submission)
      if (digitsOnly.length === 6 && !isVerifying) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          handleVerifyCode(digitsOnly);
        }, 100);
      }
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    // Prevent double submission
    if (isVerifying) {
      console.log('Already verifying, ignoring duplicate call');
      return;
    }

    const codeString = codeToVerify || code;
    const codeEntryTime = Date.now();
    
    if (codeString.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Email address is required');
      return;
    }

    setIsVerifying(true);
    setLoading(true);
    
    console.log('🔐 [handleVerifyCode] Starting verification for:', email.trim().toLowerCase(), 'at', new Date().toISOString());

    try {
      // Normalize email before verification
      const normalizedEmail = email.trim().toLowerCase();
      console.log('🔐 [handleVerifyCode] Verifying code for:', normalizedEmail);
      console.log('🔐 [handleVerifyCode] Code length:', codeString.length);
      console.log('🔐 [handleVerifyCode] Timestamp:', new Date().toISOString());
      
      // Calculate time since signup if available
      const timeSinceSignup = (globalThis as any)._lastSignupTime ? codeEntryTime - (globalThis as any)._lastSignupTime : null;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/confirm-email.tsx:85',message:'user entered code',data:{email:normalizedEmail,codeLength:codeString.length,codeValue:codeString,timeSinceSignup,timestamp:codeEntryTime},timestamp:codeEntryTime,sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Verify the OTP code - this will try 'signup' type first, then 'email' type
      console.log('🔐 [handleVerifyCode] Calling verifyEmailCode...');
      const verificationResult = await verifyEmailCode(normalizedEmail, codeString);
      console.log('🔐 [handleVerifyCode] Verification result received');
      
      if (!verificationResult || !verificationResult.user) {
        throw new Error('User not found after verification');
      }

      const user = verificationResult.user;
      console.log('✅ Email verified successfully');

      // Create or get user profile
      let profile;
      try {
        profile = await getUserProfile(user.id);
      } catch (error: any) {
        // Profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile after email verification');
          
          const userMetadata = user.user_metadata || {};
          const fullName = params.full_name || 
                          userMetadata.full_name || 
                          userMetadata.name || 
                          user.email?.split('@')[0] ||
                          'User';
          
          const userEmail = user.email || email;
          
          if (!userEmail) {
            throw new Error('Email is required');
          }

          const role = (params.role as UserRole) || (userMetadata.role as UserRole) || UserRole.POSTER;

          // Create user profile
          try {
            profile = await createUserProfile(user.id, {
              email: userEmail,
              full_name: fullName,
              role,
            });
            
            // If profile creation returns data, use it; otherwise fetch it
            if (!profile || !profile.id) {
              profile = await getUserProfile(user.id);
            }
          } catch (createError: any) {
            console.error('Failed to create profile after verification:', createError);
            throw new Error('Failed to create user profile. Please contact support.');
          }
        } else {
          throw error;
        }
      }
      
      setUser(profile);
      setIsVerified(true);
      setIsVerifying(false);
      setLoading(false);
      
      // Show success message for 3 seconds before redirecting
      setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 3000);
    } catch (error: any) {
      console.error('Error verifying code:', error);
      setIsVerifying(false);
      setLoading(false);
      
      // Clear the code on error
      setCode('');
      codeInputRef.current?.focus();
      
      // Check if code is expired or invalid
      const isExpired = error.message?.toLowerCase().includes('expired') || 
                       error.message?.toLowerCase().includes('token has expired');
      const isInvalid = error.message?.toLowerCase().includes('invalid') ||
                       error.message?.toLowerCase().includes('incorrect');
      
      if (isExpired) {
        // Auto-resend code when expired
        Alert.alert(
          'Code Expired',
          'That verification code has expired. A new code is being sent to your email now.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Auto-resend code
                try {
                  await handleResendCode();
                } catch (resendError) {
                  // Error already handled in handleResendCode
                }
              }
            }
          ]
        );
      } else if (isInvalid) {
        Alert.alert(
          'Invalid Code',
          'The code you entered is incorrect. Please check your email and try again, or request a new code.',
          [
            {
              text: 'Resend Code',
              onPress: () => {
                setTimeout(() => {
                  handleResendCode();
                }, 300);
              }
            },
            { text: 'Try Again', style: 'cancel' }
          ]
        );
      } else {
        // For other errors, show the error message
        let errorMessage = 'Verification failed. Please try again or request a new code.';
        if (error.message) {
          errorMessage = error.message;
        }
        
        Alert.alert(
          'Verification Failed',
          errorMessage,
          [
            {
              text: 'Resend Code',
              onPress: () => {
                setTimeout(() => {
                  handleResendCode();
                }, 300);
              }
            },
            { text: 'OK' }
          ]
        );
      }
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is required');
      return;
    }

    setIsResending(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      console.log('📧 [handleResendCode] Requesting new code for:', normalizedEmail);
      await resendVerificationCode(normalizedEmail);
      setEmail(normalizedEmail); // Update email to normalized version
      
      // Clear the code input
      setCode('');
      codeInputRef.current?.focus();
      
      Alert.alert(
        'New Code Sent',
        'A fresh verification code has been sent to your email. Codes expire after 1 hour, so please enter it soon.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ [handleResendCode] Resend code error:', error);
      
      // Handle rate limiting errors gracefully
      let errorMessage = error.message || 'Failed to send verification code. Please try again.';
      if (error.message?.includes('after') && error.message?.includes('seconds')) {
        // Extract the number of seconds from the error message
        const secondsMatch = error.message.match(/(\d+)\s+seconds?/);
        const seconds = secondsMatch ? secondsMatch[1] : '60';
        errorMessage = `Please wait ${seconds} seconds before requesting another code. This prevents spam.`;
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment before requesting another code.';
      }
      
      Alert.alert(
        'Unable to Send Code',
        errorMessage
      );
    } finally {
      setIsResending(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

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
                onPress={() => router.replace('/auth/login')}
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

        {isVerified ? (
          <View style={styles.content}>
            <Ionicons name="checkmark-circle" size={64} color="#73af17" style={styles.successIcon} />
            <Text style={[styles.title, titleStyle]}>Email Verified!</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              Your email has been confirmed. You're all set to start using Ollie!
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            {isVerifying ? (
              <>
                <ActivityIndicator size="large" color="#73af17" style={styles.loader} />
                <Text style={[styles.title, titleStyle]}>Verifying Code</Text>
                <Text style={[styles.subtitle, subtitleStyle]}>
                  Please wait while we verify your code...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="mail-outline" size={64} color={isDark ? '#FFFFFF' : '#000000'} style={styles.icon} />
                <Text style={[styles.title, titleStyle]}>Enter Verification Code</Text>
                <Text style={[styles.subtitle, subtitleStyle]}>
                  {email ? (
                    <>We've sent a verification code to{'\n'}<Text style={styles.emailText}>{email}</Text></>
                  ) : (
                    'Please enter the verification code sent to your email'
                  )}
                </Text>
                <Text style={[styles.warningText, subtitleStyle]}>
                  ⏰ Codes expire after 1 hour. If your code expired or you didn't receive it, use the "Resend Code" button below.
                </Text>

                <View style={styles.codeContainer}>
                  <TextInput
                    ref={codeInputRef}
                    style={[
                      styles.codeInput,
                      isDark && styles.codeInputDark,
                    ]}
                    value={code}
                    onChangeText={handleCodeChange}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Enter verification code"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    editable={!isVerifying}
                    autoFocus
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Button
                    title="Verify Code"
                    onPress={() => handleVerifyCode()}
                    loading={isVerifying}
                    disabled={isVerifying || code.length !== 6}
                    fullWidth
                  />
                </View>

                <View style={styles.resendContainer}>
                  <Text style={[styles.resendText, subtitleStyle]}>
                    Didn't receive the code or code expired?
                  </Text>
                  <Button
                    title={isResending ? 'Sending...' : 'Resend Verification Code'}
                    onPress={handleResendCode}
                    disabled={isResending}
                    fullWidth
                    variant="secondary"
                  />
                </View>
              </>
            )}
          </View>
        )}
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
    marginBottom: 24,
    marginTop: 0,
  },
  logo: {
    width: 120,
    height: 120,
  },
  content: {
    alignItems: 'center',
    marginTop: 24,
  },
  icon: {
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
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
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  emailText: {
    fontWeight: '600',
    color: '#73af17',
  },
  codeContainer: {
    width: '100%',
    marginBottom: 32,
  },
  codeInput: {
    width: '100%',
    height: 50,
    borderBottomWidth: 2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderColor: '#E5E7EB',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 4,
    color: '#000000',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  codeInputDark: {
    borderColor: '#374151',
    color: '#FFFFFF',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  resendContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  resendText: {
    fontSize: 14,
    textAlign: 'center',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendButtonTextDark: {
    color: '#FFFFFF',
  },
  loader: {
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});