import { useState, useEffect, useRef } from 'react';
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
    if (!params.parentEmail) {
      setIsChecking(false);
      return;
    }

    let signupId: string | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentStatus: 'pending' | 'approved' | 'rejected' | 'expired' = 'pending';

    // Handle status change and redirect
    const handleStatusChange = async (newStatus: string) => {
      currentStatus = newStatus as 'pending' | 'approved' | 'rejected' | 'expired';
      setStatus(currentStatus);
      
      if (newStatus === 'approved') {
        console.log('✅ [pending-approval] Status is approved, redirecting to complete-account...');
        try {
          await AsyncStorage.removeItem('pending_signup_parent_email');
          router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(params.parentEmail)}`);
        } catch (error) {
          console.error('❌ [pending-approval] Error redirecting:', error);
        }
      } else if (newStatus === 'rejected' || newStatus === 'expired') {
        console.log('❌ [pending-approval] Status is rejected/expired, clearing storage');
        await AsyncStorage.removeItem('pending_signup_parent_email');
      }
    };

    // Set up realtime subscription
    const setupRealtimeSubscription = (id: string | null) => {
      if (!id && !params.parentEmail) return;

      const normalizedEmail = params.parentEmail.trim().toLowerCase();
      console.log('🔔 [pending-approval] Setting up realtime subscription for:', normalizedEmail, 'signupId:', id);
      
      // Try to use ID-based filter if we have the signup ID (more reliable)
      // Otherwise fall back to email-based filter
      const filter = id 
        ? `id=eq.${id}`
        : `parent_email=eq.${normalizedEmail}`;
      
      channel = supabase
        .channel(`pending-signup-${id || normalizedEmail}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pending_teen_signups',
            filter: filter,
          },
          async (payload) => {
            console.log('🔔 [pending-approval] Realtime update received:', payload);
            console.log('🔔 [pending-approval] Payload new status:', payload.new?.status);
            console.log('🔔 [pending-approval] Payload new parent_email:', payload.new?.parent_email);
            console.log('🔔 [pending-approval] Payload old status:', payload.old?.status);
            
            const newStatus = payload.new?.status;
            if (!newStatus) {
              console.warn('⚠️ [pending-approval] No status in payload.new');
              return;
            }
            
            // Only process if status actually changed
            if (payload.old?.status === newStatus) {
              console.log('⚠️ [pending-approval] Status unchanged, ignoring');
              return;
            }
            
            console.log(`🔄 [pending-approval] Status changed from ${payload.old?.status} to ${newStatus}`);
            
            // Stop polling if realtime is working
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
            
            await handleStatusChange(newStatus);
          }
        )
        .subscribe((subscriptionStatus) => {
          console.log('🔔 [pending-approval] Subscription status:', subscriptionStatus);
          if (subscriptionStatus === 'SUBSCRIBED') {
            console.log('✅ [pending-approval] Successfully subscribed to realtime updates');
          } else if (subscriptionStatus === 'CHANNEL_ERROR') {
            console.error('❌ [pending-approval] Channel subscription error, will use polling fallback');
            // If realtime fails, ensure polling is active
            if (!pollingInterval) {
              setupPollingFallback();
            }
          } else if (subscriptionStatus === 'TIMED_OUT') {
            console.warn('⚠️ [pending-approval] Realtime subscription timed out, will use polling fallback');
            if (!pollingInterval) {
              setupPollingFallback();
            }
          }
        });
    };

    // Set up polling as fallback (checks every 5 seconds)
    const setupPollingFallback = () => {
      if (pollingInterval) return; // Already polling
      
      console.log('🔄 [pending-approval] Setting up polling fallback (every 5 seconds)');
      pollingInterval = setInterval(async () => {
        try {
          const pendingSignup = await getPendingSignupByParentEmailAnyStatus(params.parentEmail);
          if (pendingSignup && pendingSignup.status !== currentStatus) {
            console.log(`🔄 [pending-approval] Polling detected status change: ${currentStatus} -> ${pendingSignup.status}`);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
            await handleStatusChange(pendingSignup.status);
          }
        } catch (error) {
          console.error('❌ [pending-approval] Error polling status:', error);
        }
      }, 5000); // Poll every 5 seconds
    };

    // Check approval status from pending signup
    const checkApprovalStatus = async () => {
      try {
        // Check pending signup status by parent email (any status)
        // Note: We don't check for existing user account here because the teen
        // hasn't created their account yet - they're waiting for parent approval
        const pendingSignup = await getPendingSignupByParentEmailAnyStatus(params.parentEmail);
        
        console.log('🔍 [pending-approval] checkApprovalStatus result:', {
          hasPendingSignup: !!pendingSignup,
          status: pendingSignup?.status,
          statusType: typeof pendingSignup?.status,
          id: pendingSignup?.id
        });
        
        if (pendingSignup) {
          signupId = pendingSignup.id;
          currentStatus = pendingSignup.status as 'pending' | 'approved' | 'rejected' | 'expired';
          setStatus(currentStatus);
          
          console.log('📊 [pending-approval] Setting status to:', currentStatus);
          
          if (pendingSignup.status === 'approved') {
            // Approved, redirect to complete account screen
            console.log('✅ [pending-approval] Status is approved, redirecting...');
            await AsyncStorage.removeItem('pending_signup_parent_email');
            router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(params.parentEmail)}`);
            return;
          } else if (pendingSignup.status === 'rejected') {
            // Show rejected message, clear storage
            console.log('❌ [pending-approval] Status is rejected');
            await AsyncStorage.removeItem('pending_signup_parent_email');
            return;
          } else if (pendingSignup.status === 'expired') {
            // Show expired message, clear storage
            console.log('⏰ [pending-approval] Status is expired');
            await AsyncStorage.removeItem('pending_signup_parent_email');
            return;
          }
          
          // If status is still pending, set up realtime and polling
          if (pendingSignup.status === 'pending') {
            console.log('⏳ [pending-approval] Status is pending, setting up realtime and polling');
            setupRealtimeSubscription(signupId);
            // Also set up polling as a fallback
            setupPollingFallback();
          } else {
            console.warn('⚠️ [pending-approval] Unexpected status:', pendingSignup.status);
          }
        } else {
          console.warn('⚠️ [pending-approval] No pending signup found for:', params.parentEmail);
        }
      } catch (error) {
        console.error('❌ [pending-approval] Error checking approval status:', error);
        // Don't redirect on error - show the pending screen
      } finally {
        setIsChecking(false);
      }
    };

    // Initial status check
    checkApprovalStatus();

    return () => {
      if (channel) {
        console.log('🧹 [pending-approval] Cleaning up realtime subscription');
        supabase.removeChannel(channel);
      }
      if (pollingInterval) {
        console.log('🧹 [pending-approval] Cleaning up polling interval');
        clearInterval(pollingInterval);
      }
    };
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

