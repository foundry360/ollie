import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/stores/themeStore';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingSignupByParentEmail, getPendingSignupByParentEmailAnyStatus, sendParentApprovalEmail } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

// Helper function to calculate age from birthdate
const calculateAgeFromBirthdate = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function PendingApprovalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; parentEmail?: string }>();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [isChecking, setIsChecking] = useState(true);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');

  useEffect(() => {
    // Check if account was created (means approved)
    const checkApprovalStatus = async () => {
      if (!params.parentEmail) {
        setIsChecking(false);
        return;
      }

      try {
        // Check if user account exists (means it was approved)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setStatus('approved');
          router.replace('/(tabs)/home');
          return;
        }

        // Check pending signup status by parent email (any status)
        const pendingSignup = await getPendingSignupByParentEmailAnyStatus(params.parentEmail);
        if (pendingSignup) {
          setStatus(pendingSignup.status as 'pending' | 'approved' | 'rejected' | 'expired');
          if (pendingSignup.status === 'approved') {
            // Approved, redirect to complete account screen
            await AsyncStorage.removeItem('pending_signup_parent_email');
            router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(params.parentEmail)}`);
          } else if (pendingSignup.status === 'rejected') {
            // Show rejected message, clear storage
            await AsyncStorage.removeItem('pending_signup_parent_email');
          } else if (pendingSignup.status === 'expired') {
            // Show expired message, clear storage
            await AsyncStorage.removeItem('pending_signup_parent_email');
          }
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkApprovalStatus();

    // Poll every 10 seconds for status updates
    const interval = setInterval(checkApprovalStatus, 10000);

    return () => clearInterval(interval);
  }, [params.parentEmail, router]);

  const handleResendEmail = async () => {
    if (!params.parentEmail) return;

    try {
      const pendingSignup = await getPendingSignupByParentEmail(params.parentEmail);
      if (pendingSignup && pendingSignup.status === 'pending') {
        await sendParentApprovalEmail(
          params.parentEmail,
          pendingSignup.approval_token,
          {
            teenName: pendingSignup.full_name,
            teenAge: calculateAgeFromBirthdate(pendingSignup.date_of_birth),
            // No email yet - will be collected after approval
          }
        );
        // Show success message
      }
    } catch (error) {
      console.error('Error resending email:', error);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  if (isChecking) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ActivityIndicator size="large" color="#73af17" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {status === 'pending' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={64} color="#73af17" />
            </View>
            <Text style={[styles.title, textStyle]}>Waiting for Parent Approval</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              We've sent an approval request to:
            </Text>
            <Text style={[styles.emailText, textStyle]}>{params.parentEmail}</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              Once your parent approves your account, you'll be able to log in and start using Ollie!
            </Text>

            <Pressable
              style={[styles.resendButton, isDark && styles.resendButtonDark]}
              onPress={handleResendEmail}
            >
              <Ionicons name="refresh" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.resendButtonText, isDark && styles.resendButtonTextDark]}>
                Resend Email
              </Text>
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/role-selection')}
            >
              <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>
                Back to Sign Up
              </Text>
            </Pressable>
          </>
        )}

        {status === 'rejected' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="close-circle-outline" size={64} color="#DC2626" />
            </View>
            <Text style={[styles.title, textStyle]}>Request Rejected</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              Your parent has declined the account creation request. Please contact your parent if you have questions.
            </Text>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/role-selection')}
            >
              <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>
                Back to Sign Up
              </Text>
            </Pressable>
          </>
        )}

        {status === 'expired' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="time-outline" size={64} color="#F59E0B" />
            </View>
            <Text style={[styles.title, textStyle]}>Request Expired</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              The approval request has expired. Please start the signup process again.
            </Text>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/role-selection')}
            >
              <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>
                Start Over
              </Text>
            </Pressable>
          </>
        )}
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 150,
    height: 150,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  textLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    marginTop: 24,
    gap: 8,
  },
  resendButtonDark: {
    borderColor: '#4B5563',
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  resendButtonTextDark: {
    color: '#FFFFFF',
  },
  backButton: {
    marginTop: 32,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#73af17',
  },
  backButtonTextDark: {
    color: '#73af17',
  },
});

