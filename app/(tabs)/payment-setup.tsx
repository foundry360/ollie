import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { createStripeAccount, getStripeAccountStatus, getOnboardingLink } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import type { StripeAccount } from '@/types';

export default function PaymentSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAccountStatus();
  }, []);

  const loadAccountStatus = async () => {
    try {
      setLoading(true);
      const accountData = await getStripeAccountStatus();
      setAccount(accountData);
    } catch (error: any) {
      console.error('Error loading account status:', error);
      Alert.alert('Error', error.message || 'Failed to load account status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = async () => {
    try {
      setProcessing(true);
      const { onboarding_url } = await createStripeAccount();
      // Open onboarding URL in browser
      const canOpen = await Linking.canOpenURL(onboarding_url);
      if (canOpen) {
        await Linking.openURL(onboarding_url);
      } else {
        Alert.alert('Error', 'Cannot open Stripe onboarding link');
      }
      // Reload account status after a delay
      setTimeout(() => {
        loadAccountStatus();
      }, 2000);
    } catch (error: any) {
      console.error('Error connecting account:', error);
      Alert.alert('Error', error.message || 'Failed to connect Stripe account');
    } finally {
      setProcessing(false);
    }
  };

  const handleContinueOnboarding = async () => {
    try {
      setProcessing(true);
      const onboarding_url = await getOnboardingLink();
      const canOpen = await Linking.canOpenURL(onboarding_url);
      if (canOpen) {
        await Linking.openURL(onboarding_url);
      } else {
        Alert.alert('Error', 'Cannot open Stripe onboarding link');
      }
    } catch (error: any) {
      console.error('Error getting onboarding link:', error);
      Alert.alert('Error', error.message || 'Failed to get onboarding link');
    } finally {
      setProcessing(false);
    }
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  const isComplete = account?.onboarding_status === 'complete' && 
                     account?.charges_enabled && 
                     account?.payouts_enabled;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
          </Pressable>
          <Text style={[styles.screenTitle, titleStyle]}>Payment Setup</Text>
        </View>

        <View style={[styles.section, cardStyle]}>
          <View style={styles.statusHeader}>
            <Ionicons 
              name={isComplete ? "checkmark-circle" : "time-outline"} 
              size={32} 
              color={isComplete ? "#10B981" : "#F59E0B"} 
            />
            <Text style={[styles.statusTitle, titleStyle]}>
              {isComplete ? 'Account Connected' : 'Account Setup Required'}
            </Text>
          </View>

          {account ? (
            <>
              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, labelStyle]}>Onboarding Status:</Text>
                <Text style={[styles.statusValue, textStyle]}>
                  {account.onboarding_status === 'complete' ? 'Complete' :
                   account.onboarding_status === 'in_progress' ? 'In Progress' :
                   account.onboarding_status === 'failed' ? 'Failed' : 'Pending'}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, labelStyle]}>Can Receive Payments:</Text>
                <Text style={[styles.statusValue, textStyle]}>
                  {account.charges_enabled ? 'Yes' : 'No'}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, labelStyle]}>Can Receive Payouts:</Text>
                <Text style={[styles.statusValue, textStyle]}>
                  {account.payouts_enabled ? 'Yes' : 'No'}
                </Text>
              </View>

              {!isComplete && (
                <Pressable
                  style={[styles.button, processing && styles.buttonDisabled]}
                  onPress={handleContinueOnboarding}
                  disabled={processing}
                >
                  <Text style={styles.buttonText}>
                    {processing ? 'Processing...' : 'Continue Setup'}
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.description, textStyle]}>
                Connect your Stripe account to receive payments for completed gigs. You'll need to provide some basic information to get started.
              </Text>

              <Pressable
                style={[styles.button, processing && styles.buttonDisabled]}
                onPress={handleConnectAccount}
                disabled={processing}
              >
                <Text style={styles.buttonText}>
                  {processing ? 'Processing...' : 'Connect Stripe Account'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {isComplete && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Payment Information</Text>
            <Text style={[styles.description, textStyle]}>
              Your Stripe account is connected and ready to receive payments. When you complete a gig, payments will be automatically transferred to your account.
            </Text>
          </View>
        )}

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>How It Works</Text>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#73af17" />
            <Text style={[styles.infoText, textStyle]}>
              Connect your Stripe account to receive payments
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#73af17" />
            <Text style={[styles.infoText, textStyle]}>
              Payments are automatically processed when gigs are completed
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#73af17" />
            <Text style={[styles.infoText, textStyle]}>
              Funds are transferred to your account within 2-3 business days
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  labelLight: {
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#73af17',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 12,
    flex: 1,
  },
});

