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
import { supabase } from '@/lib/supabase';

// Conditionally import Stripe hooks for native platforms only
let useStripe: any = null;
let useFinancialConnectionsSheet: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useStripe = stripeModule.useStripe;
    useFinancialConnectionsSheet = stripeModule.useFinancialConnectionsSheet;
  } catch (e) {
    console.warn('Stripe React Native not available:', e);
  }
}

const verificationSchema = z.object({
  descriptorCode: z.string().refine((val) => {
    return !!val && /^[A-Z0-9]{6}$/.test(val.toUpperCase().trim());
  }, {
    message: 'Please enter a valid 6-character code (e.g., SMPXDQ)'
  }),
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasProcessedFinancialConnectionsReturn, setHasProcessedFinancialConnectionsReturn] = useState(false);

  // Initialize Stripe and Financial Connections for native
  const stripe = useStripe?.();
  const financialConnectionsHook = useFinancialConnectionsSheet 
    ? useFinancialConnectionsSheet() 
    : null;
  // The hook returns collectFinancialConnectionsAccounts, not presentFinancialConnectionsSheet
  const collectFinancialConnectionsAccounts = financialConnectionsHook?.collectFinancialConnectionsAccounts;

  const { control, handleSubmit, formState: { errors }, reset } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      descriptorCode: '',
    },
  });

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-setup.tsx:91',message:'loadData called',data:{user_role:user?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
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
      console.log('Loading bank account for user:', user?.id);
      const account = await getBankAccount();
      console.log('Bank account loaded:', account ? { id: account.id, status: account.verification_status, bank: account.bank_name } : 'null');
      setBankAccount(account);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-setup.tsx:110',message:'Bank account loaded',data:{has_account:!!account,account_id:account?.id,verification_status:account?.verification_status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      console.error('Error loading bank account:', error);
      // If no bank account exists, that's fine
      setBankAccount(null);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-setup.tsx:115',message:'Error loading bank account',data:{error_message:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } finally {
      setLoading(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-setup.tsx:119',message:'loadData completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
      if (!data.descriptorCode) {
        throw new Error('Please enter the 6-character code');
      }
      await verifyBankAccount({ descriptorCode: data.descriptorCode.toUpperCase().trim() });
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

  const handleConnectWithFinancialConnections = async () => {
    console.log('handleConnectWithFinancialConnections called', {
      hasUser: !!user,
      userId: user?.id,
      isConnecting,
      hasBankAccount: !!bankAccount,
      bankAccountStatus: bankAccount?.verification_status
    });

    if (!user) {
      console.error('No user found');
      Alert.alert('Error', 'You must be logged in to add a bank account.');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('Connection already in progress, ignoring duplicate request');
      return;
    }

    // Check if user already has a verified bank account
    if (bankAccount && bankAccount.verification_status === 'verified') {
      console.log('Bank account already verified, blocking connection');
      Alert.alert(
        'Bank Account Already Connected',
        'You already have a verified bank account connected. If you need to update it, please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('Starting Financial Connections flow...');
    setIsConnecting(true);
    
    try {
      // Step 1: Create the Financial Connections session via your backend
      const { data, error } = await supabase.functions.invoke(
        'create-financial-connections-session',
        {
          body: { teen_user_id: user.id }
        }
      );
      
      if (error || !data?.session?.client_secret) {
        // Check if user already has verified account (from backend check)
        if (data?.already_verified) {
          // Reload data to show the verified account
          await loadData();
          Alert.alert(
            'Bank Account Already Connected',
            'You already have a verified bank account connected.',
            [{ text: 'OK' }]
          );
          setIsConnecting(false);
          return;
        }
        
        // Check for rate limit errors
        const isRateLimit = data?.is_rate_limit || 
                           data?.stripe_error_code === 'rate_limit' ||
                           error?.message?.toLowerCase().includes('rate limit') ||
                           data?.error?.toLowerCase().includes('rate limit');
        
        if (isRateLimit) {
          Alert.alert(
            'Too Many Requests',
            'Stripe is temporarily limiting requests. This can happen if multiple users are connecting accounts at the same time. Please wait a few minutes before trying again.',
            [{ text: 'OK' }]
          );
          setIsConnecting(false);
          return;
        }
        
        const errorMessage = data?.error || data?.details || error?.message || 'Failed to create Financial Connections session';
        console.error('Failed to create session:', { error, data, errorMessage });
        Alert.alert('Error', errorMessage);
        setIsConnecting(false);
        return;
      }
      
      const sessionId = data.session.id;
      const clientSecret = data.session.client_secret;
      
      // Handle web platform
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('financial_connections_session_id', sessionId);
          const redirectUrl = `https://connect.stripe.com/financial_connections/start?client_secret=${encodeURIComponent(clientSecret)}`;
          window.location.href = redirectUrl;
        } else {
          Alert.alert('Error', 'Web browser window is not available.');
          setIsConnecting(false);
        }
        return; // Exit early for web
      }

      // Handle native platforms
      if (!collectFinancialConnectionsAccounts) {
        console.error('Financial Connections not available. Platform:', Platform.OS);
        Alert.alert(
          'Financial Connections Not Available',
          'The Financial Connections feature is not available. This may require:\n\n1. Rebuilding your development build\n2. Ensuring Stripe SDK is properly linked',
          [{ text: 'OK' }]
        );
        setIsConnecting(false);
        return;
      }
      
      // Step 2: Present Financial Connections to user
      const result = await collectFinancialConnectionsAccounts(clientSecret);
      
      console.log('Financial Connections result:', result);
      
      if (result.error) {
        if (result.error.code === 'Canceled') {
          console.log('User canceled');
          setIsConnecting(false);
          return;
        }
        throw new Error(result.error.message || 'Failed to connect bank account');
      }
      
      // Step 3: Wait a moment for Stripe to finalize the session
      // This gives Stripe time to attach the payment method
      console.log('Waiting for Stripe to finalize session...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      
      // Step 4: Save to your database with retry logic
      let saveAttempt = 0;
      const maxAttempts = 3;
      let saveSuccess = false;
      
      while (saveAttempt < maxAttempts && !saveSuccess) {
        saveAttempt++;
        console.log(`Saving account (attempt ${saveAttempt}/${maxAttempts})...`);
        
        try {
          const { data: saveData, error: saveError } = await supabase.functions.invoke(
            'save-financial-connections-account',
            {
              body: {
                session_id: sessionId,
                teen_user_id: user.id,
              }
            }
          );
          
          if (saveError) {
            console.error('Save error:', saveError);
            
            // If it's a "session still processing" error, retry
            if (saveError.message?.includes('still processing') && saveAttempt < maxAttempts) {
              console.log('Session still processing, retrying in 1 second...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            
            throw saveError;
          }
          
          if (saveData?.success) {
            saveSuccess = true;
            console.log('Account saved successfully!', saveData);
            
            // Reload data to show the new bank account
            await loadData();
            Alert.alert(
              'Success',
              'Bank account connected successfully! You can now receive payments.',
              [{ text: 'OK' }]
            );
          } else {
            throw new Error(saveData?.error || 'Failed to save account');
          }
          
        } catch (err: any) {
          if (saveAttempt >= maxAttempts) {
            throw err;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!saveSuccess) {
        throw new Error('Failed to save account after multiple attempts');
      }
      
    } catch (error: any) {
      console.error('Error connecting bank account:', error);
      Alert.alert(
        'Connection Failed',
        'We couldn\'t connect your bank account. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Financial Connections return from redirect (web only)
  useEffect(() => {
    // Only process Financial Connections return once per session
    if (hasProcessedFinancialConnectionsReturn) {
      return;
    }
    
    if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
      const urlParams = new URLSearchParams(window.location.search);
      const financialConnectionsComplete = urlParams.get('financial_connections_complete');
      const sessionId = urlParams.get('session_id') || sessionStorage.getItem('financial_connections_session_id');
      
      // Clear session storage and URL params immediately to prevent re-triggering on refresh
      if (sessionId) {
        sessionStorage.removeItem('financial_connections_session_id');
      }
      if (financialConnectionsComplete || sessionId) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      if (financialConnectionsComplete === 'true' && sessionId) {
        setHasProcessedFinancialConnectionsReturn(true); // Mark as processed
        console.log('Financial Connections completed on web, saving bank account...');
        setIsConnecting(true);
        
        (async () => {
          try {
            const { data: saveData, error: saveError } = await supabase.functions.invoke(
              'save-financial-connections-account',
              {
                body: {
                  session_id: sessionId,
                  teen_user_id: user.id,
                }
              }
            );

            if (saveError || !saveData?.success) {
              console.error('Failed to save bank account:', saveError || saveData);
              Alert.alert(
                'Error',
                'Bank account was connected but failed to save. Please contact support.'
              );
              setIsConnecting(false);
            } else {
              console.log('Bank account saved successfully:', saveData);
              Alert.alert(
                'Success',
                'Bank account connected successfully! You can now receive payments.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      loadData();
                    }
                  }
                ]
              );
              setIsConnecting(false);
            }
          } catch (error: any) {
            console.error('Error saving bank account:', error);
            Alert.alert('Error', 'Failed to save bank account. Please try again.');
            setIsConnecting(false);
          }
        })();
      }
    }
  }, [user]);

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

        {/* Parent Approval Section - Hide when bank account is verified */}
        {needsParentApproval && !(bankAccount?.verification_status === 'verified') && (
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
                {/* Show Financial Connections UI directly if no bank account exists */}
                {!bankAccount ? (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.description, textStyle, { fontSize: 14, marginBottom: 12 }]}>
                        Set up payouts so <Text style={{ fontWeight: '700' }}>{user?.full_name ? user.full_name.split(' ')[0] : 'you'}</Text> can receive earnings instantly after completing gigs.
                      </Text>
                      <Text style={[styles.description, textStyle, { fontSize: 14, marginBottom: 12 }]}>
                        Connect your bank account securely using our payment partner, Stripe. You'll log in through your bank's secure portal - we never see or store your banking credentials.
                      </Text>
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                          <Text style={{ color: '#73af17', marginRight: 8, fontSize: 16 }}>✓</Text>
                          <Text style={[textStyle, { fontSize: 14, flex: 1 }]}>Instant verification</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                          <Text style={{ color: '#73af17', marginRight: 8, fontSize: 16 }}>✓</Text>
                          <Text style={[textStyle, { fontSize: 14, flex: 1 }]}>Bank-level security and encryption</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Text style={{ color: '#73af17', marginRight: 8, fontSize: 16 }}>✓</Text>
                          <Text style={[textStyle, { fontSize: 14, flex: 1 }]}>Used by millions of businesses worldwide</Text>
                        </View>
                      </View>
                      <Text style={[styles.description, textStyle, { fontSize: 14, marginBottom: 16, fontStyle: 'italic', color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        Note: During the connection process, you may see "Foundry360" - this is Ollie's parent company that securely processes payments.
                      </Text>
                    </View>
                    <Button
                      title={isConnecting ? 'Connecting...' : 'Connect Bank Account'}
                      onPress={handleConnectWithFinancialConnections}
                      disabled={isConnecting}
                      fullWidth
                    />
                  </View>
                ) : (
                  <Text style={[styles.description, textStyle]}>
                    Your parent has completed the bank account setup.
                  </Text>
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
                          bankAccount.verification_status === 'verified' ? '#73af17' :
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
                    <View style={styles.verificationForm}>
                      <Text style={[styles.formTitle, titleStyle]}>Verify Account</Text>
                      
                      <View style={[styles.infoBox, { backgroundColor: '#F3F4F6' }, isDark && { backgroundColor: '#374151' }]}>
                        <Ionicons name="information-circle" size={20} color="#73af17" />
                        <Text style={[styles.infoBoxText, { color: '#374151' }, isDark && { color: '#D1D5DB' }]}>
                          We've sent a verification deposit to your bank account. Check your bank statement for the 6-character verification code (e.g., SMPXDQ) and enter it below.
                        </Text>
                      </View>
                      <View style={styles.codeInputContainer}>
                        <Text style={[styles.label, textStyle]}>Verification Code *</Text>
                        <Controller
                          control={control}
                          name="descriptorCode"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              value={value || ''}
                              onChangeText={(text) => {
                                // Allow alphanumeric, convert to uppercase, limit to 6 characters
                                const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                                onChange(cleaned);
                              }}
                              onBlur={onBlur}
                              placeholder="SMPXDQ"
                              placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                              keyboardType="default"
                              autoCapitalize="characters"
                              maxLength={6}
                              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                            />
                          )}
                        />
                        {errors.descriptorCode && (
                          <Text style={styles.errorText}>{errors.descriptorCode.message}</Text>
                        )}
                      </View>

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
                  <View style={{ marginTop: 12 }}>
                    <Button
                      title="Delete Bank Account"
                      onPress={handleDeleteBankAccount}
                      loading={deleting}
                      fullWidth
                      variant="secondary"
                    />
                  </View>
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
    color: '#73af17',
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
  input: {
    borderWidth: 1,
    borderColor: '#B8BDC5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
    color: '#111827',
    minHeight: 50,
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
});
