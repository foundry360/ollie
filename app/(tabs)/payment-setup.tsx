import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Alert } from '@/components/ui/Alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  requestBankAccountSetup, 
  getBankAccountApprovalStatus,
  getBankAccount,
  deleteBankAccount,
  verifyBankAccount,
  resendMicroDeposits,
  type BankAccountApprovalStatus,
  type BankAccount
} from '@/lib/api/payments';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';

const verificationSchema = z.object({
  verificationMethod: z.enum(['code', 'amounts']),
  descriptorCode: z.string().optional(),
  amount1: z.string().optional(),
  amount2: z.string().optional(),
}).refine((data) => {
  if (data.verificationMethod === 'code') {
    return !!data.descriptorCode && /^\d{4}$/.test(data.descriptorCode);
  } else {
    const amount1Num = data.amount1 ? parseFloat(data.amount1) : NaN;
    const amount2Num = data.amount2 ? parseFloat(data.amount2) : NaN;
    return !isNaN(amount1Num) && !isNaN(amount2Num) && amount1Num > 0 && amount2Num > 0 && amount1Num !== amount2Num;
  }
}, {
  message: 'Please provide valid verification data',
  path: ['verificationMethod']
});

type VerificationFormData = z.infer<typeof verificationSchema>;

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { control, handleSubmit, formState: { errors }, reset, watch } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      verificationMethod: 'code',
      descriptorCode: '',
      amount1: '',
      amount2: '',
    },
  });

  const verificationMethod = watch('verificationMethod');

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

  const handleVerifyAccount = async (data: VerificationFormData) => {
    setIsVerifying(true);
    try {
      if (data.verificationMethod === 'code') {
        if (!data.descriptorCode) {
          throw new Error('Please enter the 4-digit code');
        }
        await verifyBankAccount({ descriptorCode: data.descriptorCode });
      } else {
        if (!data.amount1 || !data.amount2) {
          throw new Error('Please enter both deposit amounts');
        }
        await verifyBankAccount({ amount1: data.amount1, amount2: data.amount2 });
      }
      Alert.alert(
        'Account Verified!',
        'Your bank account has been verified successfully. You can now receive payments.',
        [
          {
            text: 'OK',
            onPress: () => {
              reset();
              loadData();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'The verification information you entered is incorrect. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendDeposits = async () => {
    Alert.alert(
      'Resend Verification Deposits',
      'This will remove your current bank account. You\'ll need to add it again with the same details to receive new verification deposits. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: async () => {
            setIsResending(true);
            try {
              const result = await resendMicroDeposits();
              Alert.alert(
                'Account Removed',
                result.message,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      loadData();
                    },
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to resend deposits. Please try again.');
            } finally {
              setIsResending(false);
            }
          },
        },
      ]
    );
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
                  Your parent has completed the bank account setup.
                </Text>
                {/* Show option to add bank account if it doesn't exist (e.g., after resend) */}
                {!bankAccount && (
                  <View style={{ marginTop: 16 }}>
                    <Button
                      title="Add Bank Account"
                      onPress={() => router.push('/payments/bank-account-setup')}
                      fullWidth
                    />
                  </View>
                )}
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
                    <View style={[styles.infoBox, { backgroundColor: '#F3F4F6' }, isDark && { backgroundColor: '#374151' }]}>
                      <Ionicons name="information-circle" size={20} color="#73af17" />
                      <Text style={[styles.infoBoxText, { color: '#374151' }, isDark && { color: '#D1D5DB' }]}>
                        We've sent micro-deposits to your bank account. Choose how you'd like to verify:
                      </Text>
                    </View>

                    <View style={styles.verificationForm}>
                      <Text style={[styles.formTitle, titleStyle]}>Verification Method</Text>
                      
                      {/* Method Selection */}
                      <View style={styles.methodSelector}>
                        <Pressable
                          style={[
                            styles.methodOption,
                            verificationMethod === 'code' && styles.methodOptionActive,
                            isDark && verificationMethod === 'code' && styles.methodOptionActiveDark
                          ]}
                          onPress={() => {
                            reset({
                              verificationMethod: 'code',
                              descriptorCode: '',
                              amount1: '',
                              amount2: '',
                            });
                          }}
                        >
                          <Ionicons 
                            name={verificationMethod === 'code' ? 'radio-button-on' : 'radio-button-off'} 
                            size={20} 
                            color={verificationMethod === 'code' ? '#73af17' : '#9CA3AF'} 
                          />
                          <Text style={[styles.methodOptionText, textStyle]}>Code (SM1234)</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.methodOption,
                            verificationMethod === 'amounts' && styles.methodOptionActive,
                            isDark && verificationMethod === 'amounts' && styles.methodOptionActiveDark
                          ]}
                          onPress={() => {
                            reset({
                              verificationMethod: 'amounts',
                              descriptorCode: '',
                              amount1: '',
                              amount2: '',
                            });
                          }}
                        >
                          <Ionicons 
                            name={verificationMethod === 'amounts' ? 'radio-button-on' : 'radio-button-off'} 
                            size={20} 
                            color={verificationMethod === 'amounts' ? '#73af17' : '#9CA3AF'} 
                          />
                          <Text style={[styles.methodOptionText, textStyle]}>Two Amounts</Text>
                        </Pressable>
                      </View>

                      <Controller
                        control={control}
                        name="verificationMethod"
                        render={({ field: { value } }) => null}
                      />

                      {/* Code Input */}
                      {verificationMethod === 'code' && (
                        <>
                          <View style={[styles.infoBox, { backgroundColor: '#EFF6FF' }, isDark && { backgroundColor: '#1E3A8A' }]}>
                            <Ionicons name="information-circle" size={16} color="#3B82F6" />
                            <Text style={[styles.infoBoxText, { color: '#1E40AF', fontSize: 12 }, isDark && { color: '#93C5FD' }]}>
                              Check your bank statement for a code starting with "SM" followed by 4 digits (e.g., SM1234). If you don't see a code, use the "Two Amounts" method instead.
                            </Text>
                          </View>
                          <View style={styles.codeInputContainer}>
                            <Text style={[styles.label, textStyle]}>SM Code *</Text>
                            <View style={[styles.codeInputWrapper, isDark ? styles.codeInputWrapperDark : styles.codeInputWrapperLight]}>
                              <Text style={[styles.codePrefix, isDark ? styles.codePrefixDark : styles.codePrefixLight]}>SM</Text>
                              <Controller
                                control={control}
                                name="descriptorCode"
                                render={({ field: { onChange, onBlur, value } }) => (
                                  <TextInput
                                    value={value || ''}
                                    onChangeText={(text) => {
                                      const cleaned = text.replace(/\D/g, '').slice(0, 4);
                                      onChange(cleaned);
                                    }}
                                    onBlur={onBlur}
                                    placeholder="1234"
                                    placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    style={[styles.codeTextInput, isDark ? styles.codeTextInputDark : styles.codeTextInputLight]}
                                  />
                                )}
                              />
                            </View>
                            {errors.descriptorCode && (
                              <Text style={styles.errorText}>{errors.descriptorCode.message}</Text>
                            )}
                          </View>
                        </>
                      )}

                      {/* Amounts Input */}
                      {verificationMethod === 'amounts' && (
                        <>
                          <View style={[styles.infoBox, { backgroundColor: '#EFF6FF' }, isDark && { backgroundColor: '#1E3A8A' }]}>
                            <Ionicons name="information-circle" size={16} color="#3B82F6" />
                            <Text style={[styles.infoBoxText, { color: '#1E40AF', fontSize: 12 }, isDark && { color: '#93C5FD' }]}>
                              Check your bank statement for two small deposits (e.g., $0.32 and $0.45). Enter the exact amounts below.
                            </Text>
                          </View>
                          <View style={styles.amountInputContainer}>
                            <Controller
                              control={control}
                              name="amount1"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <View style={styles.inputWrapper}>
                                  <Text style={[styles.label, textStyle]}>First Amount *</Text>
                                  <Input
                                    value={value || ''}
                                    onChangeText={(text) => {
                                      // Allow decimal numbers
                                      const cleaned = text.replace(/[^0-9.]/g, '');
                                      // Ensure only one decimal point
                                      const parts = cleaned.split('.');
                                      const formatted = parts.length > 2 
                                        ? parts[0] + '.' + parts.slice(1).join('')
                                        : cleaned;
                                      onChange(formatted);
                                    }}
                                    onBlur={onBlur}
                                    placeholder="0.32"
                                    keyboardType="decimal-pad"
                                    style={isDark ? styles.inputDark : styles.inputLight}
                                  />
                                  {errors.amount1 && (
                                    <Text style={styles.errorText}>{errors.amount1.message}</Text>
                                  )}
                                </View>
                              )}
                            />
                            <Controller
                              control={control}
                              name="amount2"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <View style={styles.inputWrapper}>
                                  <Text style={[styles.label, textStyle]}>Second Amount *</Text>
                                  <Input
                                    value={value || ''}
                                    onChangeText={(text) => {
                                      // Allow decimal numbers
                                      const cleaned = text.replace(/[^0-9.]/g, '');
                                      // Ensure only one decimal point
                                      const parts = cleaned.split('.');
                                      const formatted = parts.length > 2 
                                        ? parts[0] + '.' + parts.slice(1).join('')
                                        : cleaned;
                                      onChange(formatted);
                                    }}
                                    onBlur={onBlur}
                                    placeholder="0.45"
                                    keyboardType="decimal-pad"
                                    style={isDark ? styles.inputDark : styles.inputLight}
                                  />
                                  {errors.amount2 && (
                                    <Text style={styles.errorText}>{errors.amount2.message}</Text>
                                  )}
                                </View>
                              )}
                            />
                          </View>
                          {errors.verificationMethod && (
                            <Text style={styles.errorText}>{errors.verificationMethod.message}</Text>
                          )}
                        </>
                      )}

                      <Button
                        title="Verify Account"
                        onPress={handleSubmit(handleVerifyAccount)}
                        loading={isVerifying}
                        disabled={isVerifying}
                        fullWidth
                      />
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Delete Bank Account"
                        onPress={handleDeleteBankAccount}
                        loading={deleting}
                        fullWidth
                        variant="secondary"
                      />
                      <Pressable 
                        onPress={handleResendDeposits} 
                        disabled={isResending}
                        style={styles.resendButton}
                      >
                        <Text style={[styles.resendText, textStyle]}>
                          {isResending ? 'Resending...' : "Didn't receive deposits? Resend"}
                        </Text>
                      </Pressable>
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
                        variant="secondary"
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
                        variant="secondary"
                      />
                    </View>
                  </>
                )}
              </>
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
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  keyboardView: {
    flex: 1,
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
  verificationForm: {
    marginTop: 16,
    width: '100%',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  codeInputContainer: {
    marginBottom: 16,
  },
  codeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderColor: '#D1D5DB',
    minHeight: 48,
  },
  codeInputWrapperLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  codeInputWrapperDark: {
    backgroundColor: '#1F2937',
    borderColor: '#4B5563',
  },
  codePrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  codePrefixDark: {
    color: '#D1D5DB',
  },
  codePrefixLight: {
    color: '#374151',
  },
  codeTextInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    minHeight: 24,
  },
  codeTextInputLight: {
    color: '#111827',
  },
  codeTextInputDark: {
    color: '#F9FAFB',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  methodOptionActive: {
    borderColor: '#73af17',
    backgroundColor: '#F0FDF4',
  },
  methodOptionActiveDark: {
    borderColor: '#73af17',
    backgroundColor: '#1F2937',
  },
  methodOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  amountInputContainer: {
    gap: 16,
    marginBottom: 16,
  },
  inputWrapper: {
    marginBottom: 0,
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    color: '#111827',
  },
  inputDark: {
    backgroundColor: '#1F2937',
    borderColor: '#4B5563',
    color: '#F9FAFB',
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
});
