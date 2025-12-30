import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { 
  requestBankAccountSetup, 
  getBankAccountApprovalStatus,
  getBankAccount,
  deleteBankAccount,
  type BankAccountApprovalStatus,
  type BankAccount
} from '@/lib/api/payments';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';

export default function PaymentSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [approvalStatus, setApprovalStatus] = useState<BankAccountApprovalStatus | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingSetup, setRequestingSetup] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load approval status and bank account on mount
  useEffect(() => {
    if (user?.role === 'teen') {
      loadData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    
    // Load approval status first (for teens)
    if (user?.role === 'teen') {
      try {
        const status = await getBankAccountApprovalStatus();
        setApprovalStatus(status);
      } catch (error: any) {
        console.error('Error loading approval status:', error);
        // If no approval record exists, that's fine - status will be 'none'
        setApprovalStatus({ status: 'none' });
      }
    }
    
    // Load bank account (this can fail independently)
    try {
      const account = await getBankAccount();
      setBankAccount(account);
    } catch (error: any) {
      console.error('Error loading bank account:', error);
      // If no bank account exists, that's fine
      setBankAccount(null);
    } finally {
      setLoading(false);
    }
  };

  // All teens need parent approval for bank account setup (new flow requires parent to enter bank account info)
  const needsParentApproval = user?.role === 'teen';
  const approvalRequired = needsParentApproval && approvalStatus?.status !== 'approved';


  const handleRequestSetup = async () => {
    setRequestingSetup(true);
    try {
      const result = await requestBankAccountSetup();
      Alert.alert(
        'Email Sent',
        `We've sent an email to your parent (${result.parent_email_masked || 'your parent'}) with a secure link to set up your bank account. Once they complete the setup, you'll be able to receive payments.`,
        [{ text: 'OK' }]
      );
      // Reload status to reflect pending state
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send setup email');
    } finally {
      setRequestingSetup(false);
    }
  };

  const handleDeleteBankAccount = async () => {
    Alert.alert(
      'Delete Bank Account',
      'Are you sure you want to delete your bank account? You will need to add it again to receive payments.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteBankAccount();
              Alert.alert('Success', 'Bank account deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    loadData();
                  },
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete bank account');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Skip reload if we're suppressing navigation (during OTP verification)
      const { suppressingNavigation } = useAuthStore.getState();
      if (user?.role === 'teen' && !suppressingNavigation) {
        loadData();
      }
    }, [user])
  );

  // Only show to teenlancers
  // But skip this check if we're suppressing navigation (during OTP verification)
  const { suppressingNavigation } = useAuthStore();
  if (user?.role !== 'teen' && !suppressingNavigation) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={[styles.message, isDark ? styles.textDark : styles.textLight]}>
            This feature is only available for teenlancers.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // If suppressing navigation, show loading to prevent flash of wrong content
  if (suppressingNavigation && user?.role !== 'teen') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.screenTitle, titleStyle]}>Payment Setup</Text>
        </View>

        {/* Parent Approval Section */}
        {needsParentApproval && (
          <View style={[styles.section, cardStyle]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={approvalStatus?.status === 'approved' ? "checkmark-circle" : "shield-checkmark-outline"} 
                size={32} 
                color={approvalStatus?.status === 'approved' ? "#73af17" : "#F59E0B"} 
              />
              <Text style={[styles.statusTitle, titleStyle]}>
                {approvalStatus?.status === 'approved' ? 'Parent Approval Complete' : 'Parent Approval Required'}
              </Text>
            </View>

            {approvalStatus?.status === 'approved' ? (
              <>
                <Text style={[styles.description, textStyle]}>
                  Your parent has received the setup link. Once they complete the bank account setup, you'll see it here.
                </Text>
              </>
            ) : approvalStatus?.status === 'pending' ? (
              <>
                <Text style={[styles.description, textStyle]}>
                  We've sent an email to your parent ({approvalStatus.parent_email_masked || 'your parent'}) with a secure link to set up your bank account. Once they complete the setup, you'll be able to receive payments.
                </Text>
                
                {approvalStatus.expires_at && (
                  <View style={[styles.infoBox, isDark ? styles.infoBoxDark : styles.infoBoxLight]}>
                    <Ionicons name="time-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.infoBoxText, textStyle]}>
                      Link expires: {new Date(approvalStatus.expires_at).toLocaleDateString()} at {new Date(approvalStatus.expires_at).toLocaleTimeString()}
                    </Text>
                  </View>
                )}

                <Pressable onPress={handleRequestSetup} disabled={requestingSetup} style={styles.resendButton}>
                  <Text style={[styles.resendText, textStyle]}>
                    {requestingSetup ? 'Sending...' : "Didn't receive email? Resend"}
                  </Text>
                </Pressable>
              </>
            ) : approvalStatus?.status === 'expired' ? (
              <>
                <Text style={[styles.description, textStyle]}>
                  The setup link has expired. Please request a new one.
                </Text>
                <Button
                  title="Request New Link"
                  onPress={handleRequestSetup}
                  loading={requestingSetup}
                  fullWidth
                />
              </>
            ) : (
              <>
                <Text style={[styles.description, textStyle]}>
                  You need your parent to set up your bank account. We'll send them an email with a secure link to enter the bank account details.
                </Text>
                <Button
                  title="Request Bank Account Setup"
                  onPress={handleRequestSetup}
                  loading={requestingSetup}
                  fullWidth
                />
              </>
            )}
          </View>
        )}

        {/* Bank Account Info Section - Only show when bank account exists */}
        {bankAccount && (
          <View style={[styles.section, cardStyle]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={bankAccount ? "card" : "card-outline"} 
                size={32} 
                color="#73af17" 
              />
              <Text style={[styles.statusTitle, titleStyle]}>
                Bank Account {bankAccount ? 'Status' : 'Setup'}
              </Text>
            </View>

            <>
              {/* Display existing bank account info */}
              <View style={styles.accountInfo}>
                  <View style={[styles.accountInfoRow, isDark && styles.accountInfoRowDark]}>
                    <Text style={[styles.accountInfoLabel, textStyle]}>Account Type:</Text>
                    <Text style={[styles.accountInfoValue, isDark ? styles.accountInfoValueDark : styles.accountInfoValueLight]}>
                      {bankAccount.account_type === 'checking' ? 'Checking' : 'Savings'}
                    </Text>
                  </View>
                  <View style={[styles.accountInfoRow, isDark && styles.accountInfoRowDark]}>
                    <Text style={[styles.accountInfoLabel, textStyle]}>Account Number:</Text>
                    <Text style={[styles.accountInfoValue, isDark ? styles.accountInfoValueDark : styles.accountInfoValueLight]}>
                      ••••{bankAccount.account_number_last4}
                    </Text>
                  </View>
                  {bankAccount.bank_name && (
                    <View style={[styles.accountInfoRow, isDark && styles.accountInfoRowDark]}>
                      <Text style={[styles.accountInfoLabel, textStyle]}>Bank:</Text>
                      <Text style={[styles.accountInfoValue, isDark ? styles.accountInfoValueDark : styles.accountInfoValueLight]}>
                        {bankAccount.bank_name}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.accountInfoRow, isDark && styles.accountInfoRowDark]}>
                    <Text style={[styles.accountInfoLabel, textStyle]}>Status:</Text>
                    <View style={styles.statusBadge}>
                      <Ionicons 
                        name={
                          bankAccount.verification_status === 'verified' ? 'checkmark-circle' :
                          bankAccount.verification_status === 'pending' ? 'time-outline' :
                          'close-circle'
                        }
                        size={16}
                        color={
                          bankAccount.verification_status === 'verified' ? '#10B981' :
                          bankAccount.verification_status === 'pending' ? '#F59E0B' :
                          '#EF4444'
                        }
                      />
                      <Text style={[
                        styles.statusText,
                        bankAccount.verification_status === 'verified' && styles.statusVerified,
                        bankAccount.verification_status === 'pending' && styles.statusPending,
                        bankAccount.verification_status === 'failed' && styles.statusFailed,
                      ]}>
                        {bankAccount.verification_status === 'verified' ? 'Verified' :
                         bankAccount.verification_status === 'pending' ? 'Pending Verification' :
                         'Verification Failed'}
                      </Text>
                    </View>
                  </View>
                </View>

                {bankAccount.verification_status === 'pending' && (
                  <>
                    <View style={[styles.infoBox, { backgroundColor: '#EFF6FF' }, isDark && { backgroundColor: '#1E3A8A' }]}>
                      <Ionicons name="information-circle" size={20} color="#3B82F6" />
                      <Text style={[styles.infoBoxText, { color: '#1E40AF' }, isDark && { color: '#93C5FD' }]}>
                        We've sent two small deposits to your bank account. Please verify them to complete setup.
                      </Text>
                    </View>
                    <Button
                      title="Verify Bank Account"
                      onPress={() => router.push('/payments/bank-account-verify')}
                      fullWidth
                    />
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Delete Bank Account"
                        onPress={handleDeleteBankAccount}
                        loading={deleting}
                        fullWidth
                        variant="danger"
                      />
                    </View>
                  </>
                )}

                {bankAccount.verification_status === 'verified' && (
                  <>
                    <View style={[styles.infoBox, { backgroundColor: '#D1FAE5' }, isDark && { backgroundColor: '#064E3B' }]}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={[styles.infoBoxText, { color: '#065F46' }, isDark && { color: '#6EE7B7' }]}>
                        Your bank account is verified and ready to receive payments!
                      </Text>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Delete Bank Account"
                        onPress={handleDeleteBankAccount}
                        loading={deleting}
                        fullWidth
                        variant="danger"
                      />
                    </View>
                  </>
                )}

                {bankAccount.verification_status === 'failed' && (
                  <>
                    <View style={[styles.infoBox, { backgroundColor: '#FEE2E2' }, isDark && { backgroundColor: '#7F1D1D' }]}>
                      <Ionicons name="alert-circle" size={20} color="#EF4444" />
                      <Text style={[styles.infoBoxText, { color: '#991B1B' }, isDark && { color: '#FCA5A5' }]}>
                        Verification failed. Please delete this account and request a new setup link for your parent.
                      </Text>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Delete Bank Account"
                        onPress={handleDeleteBankAccount}
                        loading={deleting}
                        fullWidth
                        variant="danger"
                      />
                    </View>
                  </>
                )}
              </>
          </View>
        )}
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
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
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
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
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
  resendButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#73af17',
    textDecorationLine: 'underline',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoBoxLight: {
    backgroundColor: '#FEF3C7',
  },
  infoBoxDark: {
    backgroundColor: '#374151',
  },
  infoBoxText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  accountInfo: {
    marginVertical: 16,
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  accountInfoRowDark: {
    borderBottomColor: '#374151',
  },
  accountInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  accountInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountInfoValueDark: {
    color: '#F9FAFB',
  },
  accountInfoValueLight: {
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusVerified: {
    color: '#10B981',
  },
  statusPending: {
    color: '#F59E0B',
  },
  statusFailed: {
    color: '#EF4444',
  },
});
