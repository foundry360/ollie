import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, AppState, AppStateStatus } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { createStripeAccount, getStripeAccountStatus, getOnboardingLink, refreshStripeAccountStatus } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import type { StripeAccount } from '@/types';
import { 
  useNeedsParentApprovalForStripe, 
  useStripeAccountApprovalStatus, 
  useRequestStripeAccountApproval 
} from '@/hooks/useStripeAccountApprovals';

export function PaymentSetupContent() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const appState = useRef(AppState.currentState);
  const [openedStripe, setOpenedStripe] = useState(false);

  // Check if parent approval is needed
  const { data: needsApproval, isLoading: checkingApproval } = useNeedsParentApprovalForStripe();
  const { data: approvalStatus, isLoading: loadingApprovalStatus } = useStripeAccountApprovalStatus();
  const requestApprovalMutation = useRequestStripeAccountApproval();

  useEffect(() => {
    loadAccountStatus();
  }, []);

  // Refresh account status when app comes to foreground (after Stripe onboarding)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        openedStripe
      ) {
        // App has come to the foreground, refresh account status from Stripe
        try {
          setLoading(true);
          const refreshedAccount = await refreshStripeAccountStatus();
          setAccount(refreshedAccount);
        } catch (error: any) {
          console.error('Error refreshing account status:', error);
          // Fallback to loading from database
          await loadAccountStatus();
        } finally {
          setLoading(false);
          setOpenedStripe(false);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [openedStripe]);

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

  const handleRequestApproval = async () => {
    try {
      await requestApprovalMutation.mutateAsync();
      Alert.alert(
        'Request Sent',
        'We\'ve sent a request to your parent. You\'ll get a notification when they approve.'
      );
    } catch (error: any) {
      console.error('Error requesting approval:', error);
      Alert.alert('Error', error.message || 'Failed to request parent approval');
    }
  };

  const handleConnectAccount = async () => {
    try {
      setProcessing(true);
      const { onboarding_url } = await createStripeAccount();
      const canOpen = await Linking.canOpenURL(onboarding_url);
      if (canOpen) {
        setOpenedStripe(true);
        await Linking.openURL(onboarding_url);
        // Note: Account status will be refreshed when user returns to app
      } else {
        Alert.alert('Error', 'Cannot open Stripe onboarding link');
      }
    } catch (error: any) {
      console.error('Error connecting account:', error);
      // Check if it's a parent approval error
      if (error.code === 'PARENT_APPROVAL_REQUIRED' || error.message?.includes('Parent approval required')) {
        Alert.alert(
          'Parent Approval Required',
          'You need your parent\'s approval before setting up a payment account. Please request approval first.'
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to connect Stripe account');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleContinueOnboarding = async () => {
    // Safety check: Don't allow if approval is needed but not approved
    if (needsApproval && approvalStatus?.status !== 'approved') {
      Alert.alert(
        'Parent Approval Required',
        'You need your parent\'s approval before setting up a payment account. Please request approval first.'
      );
      return;
    }

    try {
      setProcessing(true);
      const onboarding_url = await getOnboardingLink();
      const canOpen = await Linking.canOpenURL(onboarding_url);
      if (canOpen) {
        setOpenedStripe(true);
        await Linking.openURL(onboarding_url);
        // Note: Account status will be refreshed when user returns to app
      } else {
        Alert.alert('Error', 'Cannot open Stripe onboarding link');
      }
    } catch (error: any) {
      console.error('Error getting onboarding link:', error);
      // Check if it's a parent approval error
      if (error.code === 'PARENT_APPROVAL_REQUIRED' || error.message?.includes('Parent approval required')) {
        Alert.alert(
          'Parent Approval Required',
          'You need your parent\'s approval before setting up a payment account. Please request approval first.'
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to get onboarding link');
      }
    } finally {
      setProcessing(false);
    }
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  if (loading || checkingApproval || loadingApprovalStatus) {
    return <Loading />;
  }

  // Show approval request UI if needed
  // IMPORTANT: Check approval status even if account exists
  if (needsApproval) {
    const approval = approvalStatus;
    
    // If no approval or pending, show approval UI (block Stripe access)
    if (!approval || approval.status === 'pending') {
      return (
        <View>
          <View style={[styles.section, cardStyle]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name="time-outline" 
                size={32} 
                color="#F59E0B" 
              />
              <Text style={[styles.statusTitle, titleStyle]}>
                Parent Approval Needed
              </Text>
            </View>

            <Text style={[styles.description, textStyle]}>
              To receive payments, we need your parent's approval first. This ensures they're aware you're setting up a payment account.
            </Text>

            {!approval ? (
              <Pressable
                style={[styles.button, requestApprovalMutation.isPending && styles.buttonDisabled]}
                onPress={handleRequestApproval}
                disabled={requestApprovalMutation.isPending}
              >
                <Text style={styles.buttonText}>
                  {requestApprovalMutation.isPending ? 'Sending...' : 'Request Parent Approval'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.approvalStatusContainer}>
                <View style={styles.approvalStatusBadge}>
                  <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
                  <Text style={styles.approvalStatusText}>Waiting for parent approval...</Text>
                </View>
                <Text style={[styles.approvalStatusSubtext, labelStyle]}>
                  Requested {new Date(approval.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    // If rejected, show rejection UI (block Stripe access)
    if (approval.status === 'rejected') {
      return (
        <View>
          <View style={[styles.section, cardStyle]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name="close-circle" 
                size={32} 
                color="#EF4444" 
              />
              <Text style={[styles.statusTitle, titleStyle]}>
                Parent Declined
              </Text>
            </View>

            <Text style={[styles.description, textStyle]}>
              Your parent has declined setting up a payment account.
            </Text>

            {approval.reason && (
              <View style={[styles.reasonContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                <Text style={[styles.reasonLabel, labelStyle]}>Reason:</Text>
                <Text style={[styles.reasonText, textStyle]}>{approval.reason}</Text>
              </View>
            )}

            <Pressable
              style={[styles.secondaryButton, requestApprovalMutation.isPending && styles.buttonDisabled]}
              onPress={handleRequestApproval}
              disabled={requestApprovalMutation.isPending}
            >
              <Text style={styles.secondaryButtonText}>
                {requestApprovalMutation.isPending ? 'Sending...' : 'Request Again'}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // Only if approved, continue with normal flow (fall through)
  }

  const isComplete = account?.onboarding_status === 'complete' && 
                     account?.charges_enabled && 
                     account?.payouts_enabled;

  return (
    <View>
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
              <>
                {/* Only show continue button if approval is not needed OR if approved */}
                {(!needsApproval || approvalStatus?.status === 'approved') ? (
                  <Pressable
                    style={[styles.button, processing && styles.buttonDisabled]}
                    onPress={handleContinueOnboarding}
                    disabled={processing}
                  >
                    <Text style={styles.buttonText}>
                      {processing ? 'Processing...' : 'Continue Setup'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.approvalStatusContainer}>
                    <View style={styles.approvalStatusBadge}>
                      <Ionicons name="lock-closed" size={20} color="#F59E0B" />
                      <Text style={styles.approvalStatusText}>Parent approval required to continue</Text>
                    </View>
                  </View>
                )}
                <Pressable
                  style={[styles.secondaryButton, processing && styles.buttonDisabled]}
                  onPress={async () => {
                    try {
                      setProcessing(true);
                      const refreshedAccount = await refreshStripeAccountStatus();
                      setAccount(refreshedAccount);
                    } catch (error: any) {
                      console.error('Error refreshing account status:', error);
                      Alert.alert('Error', error.message || 'Failed to refresh account status');
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing}
                >
                  <Text style={styles.secondaryButtonText}>
                    Refresh Status
                  </Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {needsApproval && approvalStatus?.status === 'approved' && (
              <View style={styles.approvalSuccessContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={[styles.approvalSuccessText, textStyle]}>
                  Parent approved! You can now set up your payment account.
                </Text>
              </View>
            )}

            <Text style={[styles.description, textStyle]}>
              Connect your Stripe account to receive payments for completed gigs. You'll need to provide some basic information to get started.
            </Text>

            {/* Only show connect button if approval is not needed OR if approved */}
            {(!needsApproval || approvalStatus?.status === 'approved') ? (
              <Pressable
                style={[styles.button, processing && styles.buttonDisabled]}
                onPress={handleConnectAccount}
                disabled={processing}
              >
                <Text style={styles.buttonText}>
                  {processing ? 'Processing...' : 'Connect Stripe Account'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.approvalStatusContainer}>
                <View style={styles.approvalStatusBadge}>
                  <Ionicons name="lock-closed" size={20} color="#F59E0B" />
                  <Text style={styles.approvalStatusText}>Parent approval required</Text>
                </View>
              </View>
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#73af17',
  },
  secondaryButtonText: {
    color: '#73af17',
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
  approvalStatusContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  approvalStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 8,
  },
  approvalStatusSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  reasonContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  approvalSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  approvalSuccessText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
    color: '#065F46',
  },
});

