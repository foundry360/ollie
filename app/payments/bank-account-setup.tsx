import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/components/ui/Alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { getBankAccountApprovalStatus, type BankAccountApprovalStatus } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';

// Conditionally import Financial Connections hook for native platforms only
let useFinancialConnectionsSheet: any = null;
let useStripe: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useFinancialConnectionsSheet = stripeModule.useFinancialConnectionsSheet;
    useStripe = stripeModule.useStripe;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/payments/bank-account-setup.tsx:20',message:'Stripe module import success',data:{platform:Platform.OS,hasHook:!!useFinancialConnectionsSheet,hasUseStripe:!!useStripe},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } catch (e) {
    console.warn('Stripe React Native not available:', e);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/payments/bank-account-setup.tsx:24',message:'Stripe module import failed',data:{platform:Platform.OS,error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }
}

export default function BankAccountSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isConnecting, setIsConnecting] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<BankAccountApprovalStatus | null>(null);

  // Initialize Stripe and Financial Connections sheet for native
  // #region agent log
  const logData1 = {location:'app/payments/bank-account-setup.tsx:42',message:'Before hook calls',data:{platform:Platform.OS,hasHookFunction:!!useFinancialConnectionsSheet,hasUseStripe:!!useStripe},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
  console.log('[DEBUG]', logData1);
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
  // #endregion
  
  // CRITICAL: Hooks must be called unconditionally. Always call useStripe if available.
  const stripe = useStripe ? useStripe() : null;
  // #region agent log
  const logData2 = {location:'app/payments/bank-account-setup.tsx:47',message:'After useStripe call',data:{hasStripe:!!stripe,isStripeInitialized:stripe?.isInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
  console.log('[DEBUG]', logData2);
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
  // #endregion
  
  // CRITICAL FIX: Hooks must be called unconditionally. 
  // The issue: conditional hook calls violate React's Rules of Hooks and cause Stripe initialization errors.
  // Solution: Always call the hook if the function exists (matches payment-setup.tsx pattern)
  let financialConnectionsHook: any = null;
  try {
    if (useFinancialConnectionsSheet) {
      financialConnectionsHook = useFinancialConnectionsSheet();
    }
  } catch (error: any) {
    // #region agent log
    const logError = {location:'app/payments/bank-account-setup.tsx:56',message:'useFinancialConnectionsSheet hook error',data:{error:String(error),hasStripe:!!stripe},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.error('[DEBUG ERROR]', logError);
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logError)}).catch(()=>{});
    // #endregion
  }
  // #region agent log
  const logData3 = {location:'app/payments/bank-account-setup.tsx:52',message:'After useFinancialConnectionsSheet call',data:{hasHookResult:!!financialConnectionsHook,hasCollectMethod:!!financialConnectionsHook?.collectFinancialConnectionsAccounts,stripeInitialized:stripe?.isInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
  console.log('[DEBUG]', logData3);
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
  // #endregion
  // The hook returns collectFinancialConnectionsAccounts, not presentFinancialConnectionsSheet
  const collectFinancialConnectionsAccounts = financialConnectionsHook?.collectFinancialConnectionsAccounts;

  // Check parent approval on mount
  useEffect(() => {
    const checkApproval = async () => {
      if (user?.role === 'teen' && user?.parent_id) {
        try {
          const status = await getBankAccountApprovalStatus();
          setApprovalStatus(status);
        } catch (error: any) {
          console.error('Error checking approval status:', error);
          setApprovalStatus({ status: 'none' });
        }
      }
      setCheckingApproval(false);
    };
    checkApproval();
  }, [user]);

  // Block access if parent approval is required but not completed
  const needsParentApproval = user?.parent_id != null;
  const hasApproval = !needsParentApproval || approvalStatus?.status === 'approved';

  // Handle Financial Connections return from redirect (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
      const urlParams = new URLSearchParams(window.location.search);
      const financialConnectionsComplete = urlParams.get('financial_connections_complete');
      const sessionId = urlParams.get('session_id') || sessionStorage.getItem('financial_connections_session_id');
      
      if (financialConnectionsComplete === 'true' && sessionId) {
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
                      window.history.replaceState({}, document.title, window.location.pathname);
                      sessionStorage.removeItem('financial_connections_session_id');
                      router.replace('/(tabs)/payment-setup');
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

  const handleConnectWithFinancialConnections = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/payments/bank-account-setup.tsx:handleConnect',message:'handleConnect called',data:{platform:Platform.OS,hasCollectMethod:!!collectFinancialConnectionsAccounts},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Double-check parent approval before connecting
    if (needsParentApproval && !hasApproval) {
      Alert.alert(
        'Parent Approval Required',
        'You need your parent\'s approval before you can add a bank account. Please go back to Payment Setup to request approval.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to add a bank account.');
      return;
    }

    setIsConnecting(true);
    try {
      console.log('Creating Financial Connections session for teen:', user.id);
      
      // Set return URL for both web and native
      // For native, use the app's deep link scheme
      // For web, use the current page URL
      let returnUrl: string | undefined = undefined;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const currentUrl = window.location.href.split('?')[0];
        if (currentUrl.startsWith('https://')) {
          returnUrl = `${currentUrl}?financial_connections_complete=true`;
        }
      } else {
        // Native: For native apps, return_url is optional
        // The collectFinancialConnectionsAccounts handles the flow in-app
        // Setting return_url might cause issues, so we'll leave it undefined for native
        returnUrl = undefined;
      }
      
      console.log('Return URL for Financial Connections:', returnUrl);
      
      let data: any = null;
      let error: any = null;
      
      try {
        const result = await supabase.functions.invoke(
          'create-financial-connections-session',
          {
            body: {
              teen_user_id: user.id,
              return_url: returnUrl,
            }
          }
        );
        data = result.data;
        error = result.error;
      } catch (invokeError: any) {
        console.error('Function invoke threw error:', invokeError);
        error = invokeError;
        if (invokeError?.context instanceof Response) {
          try {
            const errorBody = await invokeError.context.clone().json();
            data = errorBody;
            console.error('Extracted error body from context:', errorBody);
          } catch (e) {
            console.error('Could not extract error body:', e);
          }
        }
      }

      if (error || !data?.session?.client_secret) {
        console.error('Failed to create Financial Connections session:', error || data);
        let errorMessage = 'Failed to create connection session. Please try again.';
        if (data?.error) errorMessage = data.error;
        if (data?.details) errorMessage = data.details;
        if (data?.stripe_error?.message) errorMessage = data.stripe_error.message;
        Alert.alert('Error', errorMessage);
        setIsConnecting(false);
        return;
      }

      console.log('Financial Connections session created:', data.session.id);

      // Step 2: Present Financial Connections UI
      if (Platform.OS === 'web') {
        // Web: Redirect to Stripe
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('financial_connections_session_id', data.session.id);
          const redirectUrl = `https://connect.stripe.com/financial_connections/start?client_secret=${encodeURIComponent(data.session.client_secret)}`;
          window.location.href = redirectUrl;
        }
      } else {
        // Native: Use collectFinancialConnectionsAccounts
        if (!collectFinancialConnectionsAccounts) {
          console.error('Financial Connections not available. Platform:', Platform.OS);
          console.error('Financial Connections hook result:', financialConnectionsHook);
          Alert.alert(
            'Financial Connections Not Available',
            'The Financial Connections feature is not available. This may require:\n\n1. Rebuilding your development build\n2. Ensuring Stripe SDK is properly linked',
            [{ text: 'OK' }]
          );
          setIsConnecting(false);
          return;
        }

        // Use collectFinancialConnectionsAccounts with the client secret
        // This will present the Financial Connections UI and collect accounts
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/payments/bank-account-setup.tsx:235',message:'Before collectFinancialConnectionsAccounts call',data:{hasClientSecret:!!data.session.client_secret,hasCollectMethod:!!collectFinancialConnectionsAccounts},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const result = await collectFinancialConnectionsAccounts(data.session.client_secret);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/payments/bank-account-setup.tsx:237',message:'After collectFinancialConnectionsAccounts call',data:{hasResult:!!result,hasError:!!result?.error,errorMessage:result?.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        if (result.error) {
          // Handle user cancellation gracefully
          if (result.error.code === 'Canceled') {
            console.log('Financial Connections canceled by user');
            setIsConnecting(false);
            return;
          }
          
          // Show error for actual errors
          console.error('Financial Connections error:', result.error);
          Alert.alert('Error', result.error.message || 'Failed to connect bank account');
          setIsConnecting(false);
          return;
        }

        // IMPORTANT: Even if result.financialConnectionsAccounts is empty, the account may still be in Stripe
        // The save function will retrieve accounts from Stripe using the session_id
        // So we should always call the save function if there's no error
        
        if (result.financialConnectionsAccounts && result.financialConnectionsAccounts.length > 0) {
          console.log('Financial Connections completed, accounts returned in result:', {
            accountId: result.financialConnectionsAccounts[0].id
          });
        } else {
          console.log('No accounts in result, but session completed successfully. Will retrieve from Stripe using session_id.');
        }
        
        // Call edge function to save the bank account using session_id
        // The save function will retrieve the accounts from Stripe
        console.log('Calling save-financial-connections-account with:', {
          session_id: data.session.id,
          teen_user_id: user.id,
        });
        
        const { data: saveData, error: saveError } = await supabase.functions.invoke(
          'save-financial-connections-account',
          {
            body: {
              session_id: data.session.id,
              teen_user_id: user.id,
            }
          }
        );

        console.log('Save function response:', { saveData, saveError });

        if (saveError || !saveData?.success) {
          console.error('Failed to save bank account:', saveError || saveData);
          const errorMessage = saveError?.message || saveData?.error || saveData?.details || 'Something went wrong. Please try again later.';
          Alert.alert(
            'Error',
            errorMessage,
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace('/(tabs)/payment-setup');
                }
              }
            ]
          );
          setIsConnecting(false);
          return;
        }

        console.log('Bank account saved successfully:', saveData);
        Alert.alert(
          'Success',
          'Bank account connected successfully! You can now receive payments.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)/payment-setup');
              }
            }
          ]
        );
        setIsConnecting(false);
      }
    } catch (error: any) {
      console.error('Error connecting bank account:', error);
      Alert.alert('Error', error.message || 'Failed to connect bank account. Please try again.');
      setIsConnecting(false);
    }
  };

  // Show loading while checking approval
  if (checkingApproval) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  // Show message if parent approval is needed but not completed
  if (needsParentApproval && !hasApproval) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.centered}>
            <Ionicons name="lock-closed" size={64} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
              Parent Approval Required
            </Text>
            <Text style={[styles.description, isDark ? styles.textDark : styles.textLight]}>
              You need your parent's approval before you can add a bank account. Please go back to Payment Setup to request approval.
            </Text>
            <View style={{ marginTop: 24, width: '100%' }}>
              <Button
                title="Go Back to Payment Setup"
                onPress={() => router.back()}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
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
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text style={[styles.screenTitle, titleStyle]}>Add Bank Account</Text>
          </View>

          <View style={[styles.section, cardStyle]}>
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, titleStyle, { marginBottom: 8 }]}>
                Connect Your Bank Account
              </Text>
              <Text style={[styles.sectionDescription, textStyle, { fontSize: 14, marginBottom: 12 }]}>
                Set up payouts so <Text style={{ fontWeight: '700' }}>{user?.full_name ? user.full_name.split(' ')[0] : 'you'}</Text> can receive earnings instantly after completing gigs.
              </Text>
              <Text style={[styles.sectionDescription, textStyle, { fontSize: 14, marginBottom: 12 }]}>
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
              <Text style={[styles.sectionDescription, textStyle, { fontSize: 14, marginBottom: 16, fontStyle: 'italic', color: isDark ? '#9CA3AF' : '#6B7280' }]}>
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
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  subtitleLight: {
    color: '#6B7280',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  accountTypeContainer: {
    marginBottom: 12,
  },
  accountTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  accountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  accountTypeButtonActive: {
    borderColor: '#73af17',
    backgroundColor: '#73af17',
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  accountTypeTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
});
