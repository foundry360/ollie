import { View, Text, StyleSheet, ScrollView, Alert, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { 
  requestBankAccountApproval, 
  verifyBankAccountApprovalOTP, 
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
  const [requestingOTP, setRequestingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
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
    try {
      const needsParentApproval = user?.parent_id != null;
      
      // Load approval status if needed
      if (needsParentApproval) {
        const status = await getBankAccountApprovalStatus();
        setApprovalStatus(status);
      }
      
      // Always try to load bank account
      const account = await getBankAccount();
      setBankAccount(account);
    } catch (error: any) {
      console.error('Error loading data:', error);
      // If no bank account exists, that's fine
      setBankAccount(null);
      if (user?.parent_id != null) {
        setApprovalStatus({ status: 'none' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if teen needs parent approval (has parent_id)
  const needsParentApproval = user?.parent_id != null;
  const approvalRequired = needsParentApproval && approvalStatus?.status !== 'approved';


  const handleRequestApproval = async () => {
    setRequestingOTP(true);
    setOtpError('');
    try {
      const result = await requestBankAccountApproval();
      Alert.alert(
        'OTP Sent',
        `A verification code has been sent to your parent's phone ${result.parent_phone_masked || ''}. Please ask your parent for the code and enter it below.`,
        [{ text: 'OK' }]
      );
      // Reload status to reflect pending state
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP code');
    } finally {
      setRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      setOtpError('Please enter a valid 6-digit code');
      return;
    }

    setVerifyingOTP(true);
    setOtpError('');
    try {
      await verifyBankAccountApprovalOTP(otpCode);
      Alert.alert(
        'Approved!',
        'Your bank account setup has been approved. You can now add your bank account.',
        [{ text: 'OK', onPress: () => {
          setOtpCode('');
          loadData();
        }}]
      );
    } catch (error: any) {
      setOtpError(error.message || 'Invalid OTP code. Please try again.');
      // Reload status to get updated attempts count
      await loadData();
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleAddBankAccount = () => {
    router.push('/payments/bank-account-setup');
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
      if (user?.role === 'teen') {
        loadData();
      }
    }, [user])
  );

  // Only show to teenlancers
  if (user?.role !== 'teen') {
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
                  Your parent has approved bank account setup. You can now add your bank account details.
                </Text>
                <Button
                  title="Add Bank Account"
                  onPress={handleAddBankAccount}
                  fullWidth
                />
              </>
            ) : approvalStatus?.status === 'pending' ? (
              <>
                <Text style={[styles.description, textStyle]}>
                  A verification code has been sent to your parent's phone {approvalStatus.parent_phone_masked || ''}. 
                  Please ask your parent for the code and enter it below.
                </Text>
                
                {approvalStatus.expires_at && (
                  <View style={[styles.infoBox, isDark ? styles.infoBoxDark : styles.infoBoxLight]}>
                    <Ionicons name="time-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.infoBoxText, textStyle]}>
                      Code expires: {new Date(approvalStatus.expires_at).toLocaleTimeString()}
                    </Text>
                  </View>
                )}

                {approvalStatus.attempts !== undefined && approvalStatus.attempts > 0 && (
                  <View style={[styles.infoBox, isDark ? styles.infoBoxDark : styles.infoBoxLight]}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.infoBoxText, textStyle]}>
                      Attempts remaining: {5 - approvalStatus.attempts}
                    </Text>
                  </View>
                )}

                <View style={styles.otpContainer}>
                  <Text style={[styles.otpLabel, textStyle]}>Enter OTP Code</Text>
                  <TextInput
                    style={[
                      styles.otpInput,
                      isDark ? styles.otpInputDark : styles.otpInputLight,
                      otpError && styles.otpInputError
                    ]}
                    value={otpCode}
                    onChangeText={(text) => {
                      // Only allow digits, max 6 characters
                      const cleaned = text.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(cleaned);
                      setOtpError('');
                    }}
                    placeholder="123456"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="sms-otp"
                  />
                  {otpError ? (
                    <Text style={styles.errorText}>{otpError}</Text>
                  ) : null}
                  <Button
                    title="Verify OTP"
                    onPress={handleVerifyOTP}
                    loading={verifyingOTP}
                    disabled={otpCode.length !== 6 || verifyingOTP}
                    fullWidth
                  />
                </View>

                <Pressable onPress={handleRequestApproval} disabled={requestingOTP} style={styles.resendButton}>
                  <Text style={[styles.resendText, textStyle]}>
                    {requestingOTP ? 'Sending...' : "Didn't receive code? Resend"}
                  </Text>
                </Pressable>
              </>
            ) : approvalStatus?.status === 'expired' ? (
              <>
                <Text style={[styles.description, textStyle]}>
                  The verification code has expired. Please request a new code.
                </Text>
                <Button
                  title="Request New Code"
                  onPress={handleRequestApproval}
                  loading={requestingOTP}
                  fullWidth
                />
              </>
            ) : (
              <>
                <Text style={[styles.description, textStyle]}>
                  You need your parent's approval to set up a bank account. We'll send a verification code to your parent's phone.
                </Text>
                <Button
                  title="Request Parent Approval"
                  onPress={handleRequestApproval}
                  loading={requestingOTP}
                  fullWidth
                />
              </>
            )}
          </View>
        )}

        {/* Bank Account Info Section - Show when approved or no approval needed */}
        {(!needsParentApproval || approvalStatus?.status === 'approved') && (
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

            {bankAccount ? (
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
                        Verification failed. Please add a new bank account.
                      </Text>
                    </View>
                    <Button
                      title="Add New Bank Account"
                      onPress={handleAddBankAccount}
                      fullWidth
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {/* No bank account - show setup instructions */}
                <Text style={[styles.description, textStyle]}>
                  Add your bank account details to receive payments directly.
                </Text>

                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#73af17" />
                  <Text style={[styles.infoText, textStyle]}>
                    Add your bank account details
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#73af17" />
                  <Text style={[styles.infoText, textStyle]}>
                    Payments will be automatically transferred to your account
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#73af17" />
                  <Text style={[styles.infoText, textStyle]}>
                    Funds arrive within 2-3 business days
                  </Text>
                </View>

                <Button
                  title="Add Bank Account"
                  onPress={handleAddBankAccount}
                  fullWidth
                />
              </>
            )}
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
  otpContainer: {
    marginTop: 20,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  otpInputLight: {
    backgroundColor: '#F3F4F6',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  otpInputDark: {
    backgroundColor: '#374151',
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4B5563',
  },
  otpInputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
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
