import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { sendPhoneOTP, verifyPhoneOTP, resendPhoneOTP } from '@/lib/supabase';
import { updateApplicationPhoneVerification } from '@/lib/api/neighborApplications';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; applicationId?: string }>();
  const { 
    phone: storePhone, 
    applicationId: storeApplicationId,
    email: storeEmail,
    full_name: storeFullName,
    setPhoneVerified,
    setCurrentStep,
    setApplicationId
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [phone, setPhone] = useState(params.phone || storePhone || '');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const codeInputRef = useRef<TextInput>(null);
  const applicationId = params.applicationId || storeApplicationId;

  useEffect(() => {
    // Log phone number received
    console.log('📱 [verify-phone] Screen loaded');
    console.log('📱 [verify-phone] Phone from params:', params.phone);
    console.log('📱 [verify-phone] Phone from store:', storePhone);
    console.log('📱 [verify-phone] Final phone state:', phone);
    
    // Validate phone number format
    if (phone) {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      const isValid = phoneRegex.test(phone);
      console.log('📱 [verify-phone] Phone format valid:', isValid);
      if (!isValid) {
        console.error('❌ [verify-phone] Invalid phone format:', phone);
        Alert.alert(
          'Invalid Phone Number',
          `Phone number must be in E.164 format (e.g., +1234567890).\n\nReceived: ${phone}\n\nPlease go back and enter a valid phone number.`
        );
        return;
      }
    }
    
    // Send OTP when screen loads
    if (phone && !code) {
      console.log('📱 [verify-phone] Auto-sending OTP...');
      handleSendOTP();
    } else if (!phone) {
      console.error('❌ [verify-phone] No phone number available!');
      Alert.alert(
        'Missing Phone Number',
        'Phone number is required. Please go back and enter your phone number.'
      );
    }
  }, []);

  const handleSendOTP = async () => {
    if (!phone) {
      console.error('❌ [handleSendOTP] No phone number provided');
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    // Validate phone format before sending
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      console.error('❌ [handleSendOTP] Invalid phone format:', phone);
      Alert.alert(
        'Invalid Phone Number',
        `Phone number must be in E.164 format (e.g., +1234567890).\n\nCurrent: ${phone}`
      );
      return;
    }

    console.log('📱 [handleSendOTP] Attempting to send OTP to:', phone);
    setIsSending(true);
    
    try {
      await sendPhoneOTP(phone);
      console.log('✅ [handleSendOTP] OTP sent successfully');
      // Code sent - user can see the message on screen, no need for alert
      codeInputRef.current?.focus();
    } catch (error: any) {
      console.error('❌ [handleSendOTP] Error sending OTP:', error);
      console.error('❌ [handleSendOTP] Error details:', JSON.stringify(error, null, 2));
      
      // Show detailed error message
      let errorMessage = error.message || 'Failed to send verification code. Please try again.';
      
      // Add phone number to error for debugging
      if (error.message?.includes('invalid') || error.message?.includes('phone')) {
        errorMessage += `\n\nPhone number used: ${phone}`;
        errorMessage += `\n\nPlease ensure your phone number is in E.164 format: +[country code][number]`;
        errorMessage += `\nExample: +1234567890 (US)`;
      }
      
      Alert.alert('Error Sending Code', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits and limit to 6 characters
    const digitsOnly = value.replace(/[^\d]/g, '');
    if (digitsOnly.length <= 6) {
      setCode(digitsOnly);
      
      // Auto-submit when 6 digits are entered
      if (digitsOnly.length === 6 && !isVerifying) {
        setTimeout(() => {
          handleVerifyCode(digitsOnly);
        }, 100);
      }
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    if (isVerifying) return;

    const codeString = codeToVerify || code;
    
    if (codeString.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code');
      return;
    }

    if (!phone) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    if (!applicationId) {
      Alert.alert('Error', 'Application ID is missing. Please start over.');
      router.replace('/auth/signup-adult');
      return;
    }

    setIsVerifying(true);

    try {
      // Verify the OTP code
      const verificationResult = await verifyPhoneOTP(phone, codeString);
      
      if (!verificationResult || !verificationResult.user) {
        throw new Error('Verification failed');
      }

      // Update application with phone verification status
      // Pass fallback data in case application doesn't exist (user_id mismatch)
      const updatedApplication = await updateApplicationPhoneVerification(
        applicationId, 
        true,
        storeEmail && storeFullName && phone ? {
          email: storeEmail,
          full_name: storeFullName,
          phone: phone,
        } : undefined
      );
      
      // Use the returned application ID (in case applicationId was null)
      const finalApplicationId = updatedApplication.id || applicationId;
      
      if (!finalApplicationId) {
        throw new Error('Application ID not found. Please start over.');
      }
      
      // Update store
      setPhoneVerified(true);
      setCurrentStep('application');
      setApplicationId(finalApplicationId);

      // Redirect to application form
      router.replace({
        pathname: '/auth/neighbor-application',
        params: { applicationId: finalApplicationId }
      });
    } catch (error: any) {
      console.error('Error verifying code:', error);
      
      // Clear the code on error
      setCode('');
      codeInputRef.current?.focus();
      
      // Show helpful error message
      const isExpired = error.message?.toLowerCase().includes('expired');
      const isInvalid = error.message?.toLowerCase().includes('invalid');
      
      if (isExpired) {
        Alert.alert(
          'Code Expired',
          'That verification code has expired. A new code is being sent now.',
          [
            {
              text: 'OK',
              onPress: () => {
                setTimeout(() => {
                  handleResendCode();
                }, 300);
              }
            }
          ]
        );
      } else if (isInvalid) {
        Alert.alert(
          'Invalid Code',
          'The code you entered is incorrect. Please check and try again, or request a new code.',
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
        Alert.alert(
          'Verification Failed',
          error.message || 'Failed to verify code. Please try again.'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!phone) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    setIsResending(true);
    try {
      await resendPhoneOTP(phone);
      setCode('');
      codeInputRef.current?.focus();
      Alert.alert(
        'New Code Sent',
        'A fresh verification code has been sent to your phone. Codes expire after 10 minutes.'
      );
    } catch (error: any) {
      console.error('Error resending code:', error);
      Alert.alert(
        'Unable to Send Code',
        error.message || 'Failed to send verification code. Please try again.'
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
            onPress={() => router.back()}
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

          {isVerifying ? (
            <View style={styles.content}>
              <ActivityIndicator size="large" color="#73af17" style={styles.loader} />
              <Text style={[styles.title, titleStyle]}>Verifying Code</Text>
              <Text style={[styles.subtitle, subtitleStyle]}>
                Please wait while we verify your code...
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              <Ionicons name="phone-portrait-outline" size={64} color={isDark ? '#FFFFFF' : '#000000'} style={styles.icon} />
              <Text style={[styles.title, titleStyle]}>Verify Your Phone</Text>
              <Text style={[styles.subtitle, subtitleStyle]}>
                We sent a verification code to{'\n'}
                <Text style={styles.phoneText}>{phone}</Text>
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
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  editable={!isVerifying && !isSending}
                  autoFocus
                />
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title="Verify Code"
                  onPress={() => handleVerifyCode()}
                  loading={isVerifying}
                  disabled={isVerifying || code.length !== 6 || isSending}
                  fullWidth
                />
              </View>

              <View style={styles.resendContainer}>
                <Text style={[styles.resendText, subtitleStyle]}>
                  Didn't receive the code?
                </Text>
                <Button
                  title={isResending ? 'Sending...' : 'Resend Code'}
                  onPress={handleResendCode}
                  disabled={isResending || isSending}
                  fullWidth
                  variant="secondary"
                />
              </View>
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
  loader: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
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
  phoneText: {
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
});
