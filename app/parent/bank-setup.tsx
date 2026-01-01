import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform, Image, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';
import { loadStripe } from '@stripe/stripe-js';

// Conditionally import Financial Connections hook for native platforms only
let useFinancialConnectionsSheet: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useFinancialConnectionsSheet = stripeModule.useFinancialConnectionsSheet;
  } catch (e) {
    console.warn('Stripe React Native not available:', e);
  }
}

const bankAccountSchema = z.object({
  account_type: z.enum(['checking', 'savings']),
  bank_name: z.string()
    .min(2, 'Bank name must be at least 2 characters')
    .max(100, 'Bank name is too long'),
  routing_number: z.string()
    .min(9, 'Routing number must be 9 digits')
    .max(9, 'Routing number must be 9 digits')
    .regex(/^\d+$/, 'Routing number must contain only numbers'),
  account_number: z.string()
    .min(4, 'Account number must be at least 4 digits')
    .max(17, 'Account number must be less than 18 digits')
    .regex(/^\d+$/, 'Account number must contain only numbers'),
  confirm_account_number: z.string(),
  account_holder_name: z.string()
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name is too long'),
  authorization_agreed: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the authorization',
  }),
}).refine((data) => data.account_number === data.confirm_account_number, {
  message: 'Account numbers do not match',
  path: ['confirm_account_number'],
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

interface ApprovalData {
  id: string;
  teen_id: string;
  status: string;
  token_expires_at: string;
  expires_at: string;
}

export default function ParentBankSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { colorScheme } = useThemeStore();
  // Force light theme on web
  const isDark = Platform.OS === 'web' ? false : colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teenName, setTeenName] = useState<string>('');
  const [showAccountTypeDropdown, setShowAccountTypeDropdown] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  
  // Initialize Stripe.js for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
      if (stripePublishableKey) {
        loadStripe(stripePublishableKey).then((stripeInstance) => {
          setStripe(stripeInstance);
        }).catch((error) => {
          console.error('Failed to load Stripe:', error);
        });
      }
    }
  }, []);
  
  // Stripe Financial Connections hook (native platforms only)
  const financialConnectionsHook = useFinancialConnectionsSheet 
    ? useFinancialConnectionsSheet() 
    : null;
  const presentFinancialConnectionsSheet = financialConnectionsHook?.presentFinancialConnectionsSheet;

  const { control, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      account_type: 'checking',
      bank_name: '',
      routing_number: '',
      account_number: '',
      confirm_account_number: '',
      account_holder_name: '',
      authorization_agreed: false,
    },
  });

  const accountType = watch('account_type');
  const authorizationAgreed = watch('authorization_agreed');

  const clearForm = () => {
    reset({
      account_type: 'checking',
      bank_name: '',
      routing_number: '',
      account_number: '',
      confirm_account_number: '',
      account_holder_name: '',
      authorization_agreed: false,
    });
  };

  // Handle Financial Connections return from redirect (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const financialConnectionsComplete = urlParams.get('financial_connections_complete');
      const sessionId = urlParams.get('session_id');
      
      if (financialConnectionsComplete === 'true' && sessionId) {
        // User returned from Financial Connections
        // Show success message
        Alert.alert(
          'Success',
          'Bank account connected successfully! Your child can now receive payments.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clean up URL params
                window.history.replaceState({}, document.title, window.location.pathname);
                // Optionally close the window if it was opened in a popup
                if (window.opener) {
                  window.close();
                }
              }
            }
          ]
        );
      }
    }
  }, []);

  // Validate token and fetch approval data
  useEffect(() => {
    const validateToken = async () => {
      console.log('🔍 [bank-setup] Starting token validation', { token: params.token, hasToken: !!params.token });
      
      if (!params.token) {
        console.log('❌ [bank-setup] No token provided');
        setError('Missing setup token. Please use the link from your email.');
        setLoading(false);
        return;
      }

      try {
        console.log('📞 [bank-setup] Calling validate-bank-setup-token function');
        // Call edge function to validate token (bypasses RLS)
        const { data: result, error: functionError } = await supabase.functions.invoke('validate-bank-setup-token', {
          body: {
            setup_token: params.token,
          },
        });

        console.log('📥 [bank-setup] Function response:', { 
          hasResult: !!result, 
          hasError: !!functionError,
          result,
          error: functionError 
        });

        if (functionError) {
          console.error('❌ [bank-setup] Error calling validate-bank-setup-token:', functionError);
          
          // Check if function doesn't exist (404 or function not found)
          const errorMessage = functionError.message || '';
          const isFunctionNotFound = 
            (functionError as any)?.status === 404 || 
            errorMessage.includes('not found') ||
            errorMessage.includes('Function not found');
          
          if (isFunctionNotFound) {
            setError('The validation service is not available. Please contact support or ensure the function is deployed.');
          } else {
            setError(`Failed to validate setup token: ${errorMessage || 'Unknown error'}. Please try again.`);
          }
          setLoading(false);
          return;
        }

        if (!result) {
          console.error('❌ [bank-setup] No result from function');
          setError('No response from server. Please try again.');
          setLoading(false);
          return;
        }

        console.log('📊 [bank-setup] Result structure:', {
          hasValid: 'valid' in result,
          valid: result.valid,
          hasApproved: 'approved' in result,
          approved: result.approved,
          hasApproval: 'approval' in result,
          hasTeenName: 'teen_name' in result,
          keys: Object.keys(result)
        });

        if (result.valid === false || result.valid === undefined) {
          console.log('❌ [bank-setup] Token invalid:', result.error);
          setError(result?.error || 'Invalid or expired setup token. Please request a new link.');
          setLoading(false);
          return;
        }

        // Check if already approved
        if (result.approved === true) {
          console.log('ℹ️ [bank-setup] Already approved');
          setError('This bank account has already been set up.');
          setLoading(false);
          return;
        }

        // Token is valid and not approved - proceed
        console.log('✅ [bank-setup] Token valid, setting approval data');
        
        // Set approval data
        if (result.approval) {
          setApprovalData({
            id: result.approval.id,
            teen_id: result.approval.teen_id,
            status: result.approval.status,
            token_expires_at: '',
            expires_at: '',
          });
          console.log('✅ [bank-setup] Approval data set:', result.approval);
        } else {
          console.warn('⚠️ [bank-setup] No approval data in result');
        }

        // Set teen name if available
        if (result.teen_name) {
          setTeenName(result.teen_name);
          console.log('✅ [bank-setup] Teen name set:', result.teen_name);
        }

        setLoading(false);
        console.log('✅ [bank-setup] Token validation complete, loading form');
      } catch (err: any) {
        console.error('❌ [bank-setup] Exception validating token:', err);
        setError(err.message || 'Failed to validate setup token.');
        setLoading(false);
      }
    };

    validateToken();
  }, [params.token]);

  const onSubmit = async (data: BankAccountFormData) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:208',message:'onSubmit called',data:{hasApprovalData:!!approvalData,hasToken:!!params.token,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    if (!approvalData || !params.token) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:210',message:'Validation failed - missing approvalData or token',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
      Alert.alert('Error', 'Invalid setup token. Please use the link from your email.');
      return;
    }

    setIsSubmitting(true);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:214',message:'About to call edge function',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    try {
      // Call edge function to create bank account for the teen
      let result: any, submitError: any
      try {
        const response = await supabase.functions.invoke('create-bank-account-for-teen', {
          body: {
            setup_token: params.token,
            routing_number: data.routing_number,
            account_number: data.account_number,
            account_type: data.account_type,
            bank_name: data.bank_name,
            account_holder_name: data.account_holder_name,
          },
        })
        result = response.data
        submitError = response.error
        
        // If there's an error, try to get more details from the response
        if (submitError) {
          // Try to access the error context which might contain the response body
          const errorContext = (submitError as any)?.context
          if (errorContext) {
            try {
              const errorBody = typeof errorContext === 'string' ? JSON.parse(errorContext) : errorContext
              submitError = {
                ...submitError,
                message: errorBody?.error || errorBody?.message || submitError.message,
                details: errorBody?.details || errorBody?.error_type || errorBody
              }
            } catch (e) {
              // Context is not JSON, use as-is
            }
          }
          
          // Also check if result contains error info (for 500 responses)
          if (result && typeof result === 'object' && (result.error || result.message)) {
            submitError = {
              ...submitError,
              message: result.error || result.message || submitError.message,
              details: result.details || result.error_type || result
            }
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:228',message:'Function invoke response',data:{hasData:!!result,hasError:!!submitError,dataKeys:result?Object.keys(result):[],resultStringified:JSON.stringify(result||{}),errorMessage:submitError?.message,errorDetails:submitError?.details,errorContext:JSON.stringify((submitError as any)?.context||{}),timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
      } catch (invokeError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:260',message:'Exception during function invoke',data:{errorMessage:invokeError?.message,errorType:invokeError?.constructor?.name,errorStack:invokeError?.stack,errorContext:JSON.stringify(invokeError?.context||{}),timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        submitError = invokeError
      }
      
      // Extract error from Response objects in details/context
      if (submitError) {
        let extractedError: any = null
        
        // Check if details is a Response object
        if (submitError.details instanceof Response) {
          try {
            extractedError = await submitError.details.clone().json()
            console.log('Extracted error from details Response:', extractedError)
          } catch (e) {
            console.error('Failed to parse details Response:', e)
            extractedError = { error: `HTTP ${submitError.details.status}: ${submitError.details.statusText}` }
          }
        }
        
        // Check if context is a Response object (if details didn't work)
        if (!extractedError && submitError.context instanceof Response) {
          try {
            extractedError = await submitError.context.clone().json()
            console.log('Extracted error from context Response:', extractedError)
          } catch (e) {
            console.error('Failed to parse context Response:', e)
          }
        }
        
        // If we extracted an error, update submitError
        if (extractedError) {
          submitError.details = extractedError.error || extractedError.message || extractedError.details || JSON.stringify(extractedError)
          submitError.stripe_error = extractedError.stripe_error
          submitError.stripe_error_code = extractedError.stripe_error_code
          submitError.stripe_error_type = extractedError.stripe_error_type
          if (extractedError.error || extractedError.message) {
            submitError.message = extractedError.error || extractedError.message
          }
        }
        
        // If we still don't have error details, try a direct fetch to get the raw response
        if (!extractedError || (!submitError.details || submitError.details === '{}' || (typeof submitError.details === 'object' && Object.keys(submitError.details).length === 0))) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
            const directResponse = await fetch(`${supabaseUrl}/functions/v1/create-bank-account-for-teen`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`,
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
              },
              body: JSON.stringify({
                setup_token: params.token,
                routing_number: data.routing_number,
                account_number: data.account_number,
                account_type: data.account_type,
                bank_name: data.bank_name,
                account_holder_name: data.account_holder_name,
              }),
            })
            
            if (!directResponse.ok) {
              let errorBody: any
              try {
                errorBody = await directResponse.json()
                console.log('Direct fetch error body:', errorBody)
              } catch (parseError) {
                errorBody = { error: `HTTP ${directResponse.status}: ${directResponse.statusText}` }
              }
              
              // Extract error message properly
              const errorMessage = errorBody.error || errorBody.message || `HTTP ${directResponse.status} error`
              const errorDetails = errorBody.details || errorBody.error_type || errorBody.stripe_error || errorBody
              
              submitError = {
                ...submitError,
                message: errorMessage,
                details: typeof errorDetails === 'string' ? errorDetails : (typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : String(errorDetails)),
                stripe_error: errorBody.stripe_error,
                stripe_error_code: errorBody.stripe_error_code,
                stripe_error_type: errorBody.stripe_error_type
              }
            }
          } catch (directFetchError: any) {
            // If direct fetch itself fails, log it but don't override the original error
            console.error('Direct fetch error:', directFetchError)
          }
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:240',message:'Edge function response received',data:{hasResult:!!result,hasError:!!submitError,resultSuccess:result?.success,resultError:result?.error,resultErrorType:result?.error_type,resultDetails:result?.details,errorMessage:submitError?.message,errorContext:submitError?.context,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
      // #endregion
      
      // Log the full result for debugging
      console.log('Full function response:', { result, submitError })
      console.log('submitError type:', typeof submitError)
      console.log('submitError keys:', submitError ? Object.keys(submitError) : 'null')
      console.log('submitError.message:', submitError?.message)
      console.log('submitError.details:', submitError?.details)
      console.log('submitError.context:', submitError?.context)
      if (submitError) {
        try {
          console.log('submitError stringified:', JSON.stringify(submitError, null, 2))
        } catch (e) {
          console.log('Could not stringify submitError:', e)
        }
      }

      if (submitError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:325',message:'submitError detected, throwing',data:{errorMessage:submitError?.message,errorDetails:submitError?.details,errorContext:JSON.stringify(submitError?.context||{}),timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        
        // Extract error message properly - handle Response objects and other edge cases
        let errorMsg = 'Failed to set up bank account'
        
        // Priority: details > message > stripe_error > default
        if (submitError?.details) {
          if (typeof submitError.details === 'string') {
            errorMsg = submitError.details
          } else if (typeof submitError.details === 'object') {
            // If it's an object, try to extract a meaningful message
            if (submitError.details.error) {
              errorMsg = submitError.details.error
            } else if (submitError.details.message) {
              errorMsg = submitError.details.message
            } else {
              errorMsg = JSON.stringify(submitError.details)
            }
          } else {
            errorMsg = String(submitError.details)
          }
        } else if (submitError?.stripe_error?.message) {
          errorMsg = submitError.stripe_error.message
        } else if (submitError?.message && submitError.message !== 'Edge Function returned a non-2xx status code') {
          errorMsg = submitError.message
        }
        
        // Log the full error for debugging
        console.error('Full submitError object:', submitError)
        console.error('Extracted error message:', errorMsg)
        
        throw new Error(errorMsg);
      }

      if (!result?.success) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:266',message:'result.success is false, throwing',data:{resultError:result?.error,resultErrorType:result?.error_type,resultDetails:result?.details,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        const errorMsg = result?.details || result?.error || 'Failed to set up bank account';
        throw new Error(errorMsg);
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:236',message:'Success - showing alert',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
      // #endregion

      Alert.alert(
        'Bank Account Setup Complete',
        'The bank account has been added successfully.\n\n' +
        'We\'ll send two small deposits to verify the account (usually within 1-2 business days). Your child needs to verify these deposits in the Ollie app. Once verified, they can receive payments.\n\n' +
        'You\'ll receive an email when verification is complete.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Close the page or redirect
              if (Platform.OS === 'web') {
                window.close();
              } else {
                router.back();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:260',message:'Error caught in onSubmit',data:{errorMessage:error?.message,errorType:error?.constructor?.name,errorStack:error?.stack,errorContext:JSON.stringify(error?.context||{}),timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      console.error('Error setting up bank account:', error);
      console.error('Error details:', {
        message: error?.message,
        context: error?.context,
        stack: error?.stack,
        fullError: error
      });
      const errorMessage = error?.context?.message || error?.message || 'Failed to set up bank account. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-setup.tsx:257',message:'onSubmit finally block - setting isSubmitting to false',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      setIsSubmitting(false);
    }
  };

  const handleConnectWithFinancialConnections = async () => {
    if (!approvalData || !params.token) {
      Alert.alert('Error', 'Invalid setup token. Please use the link from your email.');
      return;
    }

    setIsConnecting(true);
    try {
      console.log('Creating Financial Connections session for teen:', approvalData.teen_id);
      
      // Step 1: Call edge function to create Financial Connections session
      // Include return_url for web redirects (only if HTTPS)
      let returnUrl: string | undefined = undefined;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const currentUrl = window.location.href.split('?')[0];
        // Only set return_url if using HTTPS (Stripe requires HTTPS)
        if (currentUrl.startsWith('https://')) {
          returnUrl = `${currentUrl}?financial_connections_complete=true`;
        } else {
          console.warn('Skipping return_url for localhost (HTTP) - Stripe requires HTTPS');
        }
      }
      
      const { data, error } = await supabase.functions.invoke(
        'create-financial-connections-session',
        {
          body: {
            teen_user_id: approvalData.teen_id,
            approval_token: params.token,
            return_url: returnUrl, // Only set if HTTPS
          }
        }
      );

      if (error || !data?.session?.client_secret) {
        console.error('Failed to create Financial Connections session:', error || data);
        
        // Try to extract detailed error message
        let errorMessage = 'Failed to create connection session. Please try again.';
        let errorDetails: any = null;
        
        if (error) {
          // Check if error has details in context
          if (error.context instanceof Response) {
            try {
              errorDetails = await error.context.clone().json();
              console.error('Error details from response:', errorDetails);
              console.error('Error details type:', typeof errorDetails);
              console.error('Error details keys:', errorDetails ? Object.keys(errorDetails) : 'null');
              console.error('Full error details object:', JSON.stringify(errorDetails, null, 2));
              console.error('Error details.error:', errorDetails?.error);
              console.error('Error details.details:', errorDetails?.details);
              console.error('Error details.stripe_error:', errorDetails?.stripe_error);
              errorMessage = errorDetails?.error || errorDetails?.details || errorDetails?.message || errorDetails?.stripe_error?.message || errorMessage;
            } catch (e) {
              console.error('Could not parse error context:', e);
              // Try to get text instead
              try {
                const text = await error.context.clone().text();
                console.error('Error response text:', text);
                errorMessage = text || errorMessage;
              } catch (e2) {
                console.error('Could not read error context as text:', e2);
              }
            }
          }
          
          if (!errorDetails && error.message) {
            errorMessage = error.message;
          }
        }
        
        if (data?.error) {
          errorMessage = data.error;
        }
        if (data?.details) {
          errorMessage = data.details;
        }
        if (data?.stripe_error?.message) {
          errorMessage = data.stripe_error.message;
        }
        
        console.error('Final error message:', errorMessage);
        console.error('Full error data:', { error, data, errorDetails });
        console.error('Error object stringified:', JSON.stringify({ error, data, errorDetails }, null, 2));
        console.error('Error context type:', typeof error?.context);
        console.error('Error context:', error?.context);
        
        Alert.alert(
          'Error', 
          errorMessage
        );
        setIsConnecting(false);
        return;
      }

      console.log('Financial Connections session created:', data.session.id);
      console.log('Full session response:', JSON.stringify(data.session, null, 2));
      console.log('Session keys:', Object.keys(data.session));

      // Step 2: Present Financial Connections UI
      if (Platform.OS === 'web') {
        // Web: Use Stripe.js to collect Financial Connections or redirect to hosted page
        if (typeof window !== 'undefined') {
          // Store session info for when they return
          sessionStorage.setItem('financial_connections_session_id', data.session.id);
          sessionStorage.setItem('financial_connections_customer_id', data.customer_id);
          
          // Check if session has a URL from Stripe (hosted_url or url)
          const sessionUrl = (data.session as any).url || 
                            (data.session as any).hosted_url || 
                            (data.session as any).redirect_url ||
                            (data.session as any).hosted_redirect_url;
          
          let redirectUrl: string;
          
          if (sessionUrl) {
            // Use the URL provided by Stripe
            redirectUrl = sessionUrl;
            console.log('Using session URL from Stripe:', redirectUrl);
          } else if (stripe) {
            // Try using Stripe.js to collect Financial Connections
            // Note: This method might not exist - if it fails, fall back to redirect
            console.log('Attempting to use Stripe.js to collect Financial Connections');
            try {
              // Check if collectFinancialConnections method exists
              if (typeof (stripe as any).collectFinancialConnections === 'function') {
                (stripe as any).collectFinancialConnections({
                  clientSecret: data.session.client_secret,
                }).then((result: any) => {
                  if (result.error) {
                    console.error('Financial Connections error:', result.error);
                    Alert.alert('Error', result.error.message || 'Failed to connect bank account');
                    setIsConnecting(false);
                  } else {
                    console.log('Financial Connections completed:', result);
                    // Handle success
                    Alert.alert('Success', 'Bank account connected successfully!');
                    setIsConnecting(false);
                  }
                });
                return; // Don't redirect if using Stripe.js
              }
            } catch (error) {
              console.warn('Stripe.js collectFinancialConnections not available, using redirect:', error);
            }
            
            // Fallback: construct redirect URL
            // Try different possible URL formats for Financial Connections
            // Format 1: Standard Financial Connections redirect
            redirectUrl = `https://connect.stripe.com/financial_connections/start?client_secret=${encodeURIComponent(data.session.client_secret)}`;
            console.log('Using constructed redirect URL (format 1):', redirectUrl);
            console.warn('If this redirects to dashboard, the URL format may be incorrect. Financial Connections might require embedded component or different URL format.');
          } else {
            // No Stripe.js instance, use redirect
            // Try the standard Financial Connections redirect URL
            redirectUrl = `https://connect.stripe.com/financial_connections/start?client_secret=${encodeURIComponent(data.session.client_secret)}`;
            console.log('Using constructed redirect URL (no Stripe.js):', redirectUrl);
          }
          
          console.log('Final redirect URL:', redirectUrl);
          
          // Show a message for localhost users since there's no return_url
          if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
            Alert.alert(
              'Connecting Bank Account',
              'You will be redirected to Stripe to connect your bank account. After completing the connection, please return to this page manually.',
              [
                {
                  text: 'Continue',
                  onPress: () => {
                    window.location.href = redirectUrl;
                  }
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setIsConnecting(false);
                  }
                }
              ]
            );
          } else {
            // HTTPS - redirect directly (return_url will bring them back)
            window.location.href = redirectUrl;
          }
        }
        
        // Note: We don't set isConnecting to false here if redirecting
        // The page will reload when they return via return_url
      } else {
        // Native: Use the sheet
        if (!presentFinancialConnectionsSheet) {
          Alert.alert('Error', 'Financial Connections is not available on this platform.');
          setIsConnecting(false);
          return;
        }

        const { error: sheetError } = await presentFinancialConnectionsSheet({
          clientSecret: data.session.client_secret,
          onEvent: (event: any) => {
            console.log('Financial Connections event:', event.name);
            
            if (event.name === 'financialConnectionsSheetCompleted') {
              // Success! Payment method is already created and attached
              Alert.alert(
                'Success',
                'Bank account connected successfully! Your child can now receive payments.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.back();
                    }
                  }
                ]
              );
              setIsConnecting(false);
            } else if (event.name === 'financialConnectionsSheetClosed') {
              // User closed the sheet
              console.log('User closed Financial Connections sheet');
              setIsConnecting(false);
            } else if (event.name === 'financialConnectionsSheetError') {
              Alert.alert('Error', 'Failed to connect bank account. Please try again.');
              setIsConnecting(false);
            }
          }
        });

        if (sheetError) {
          console.error('Financial Connections sheet error:', sheetError);
          Alert.alert('Error', sheetError.message || 'Failed to connect bank account');
          setIsConnecting(false);
        }
      }
    } catch (error: any) {
      console.error('Error connecting bank account:', error);
      Alert.alert('Error', error.message || 'Failed to connect bank account. Please try again.');
      setIsConnecting(false);
    }
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  // Add CSS to hide scrollbar on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'scroll-view-web-style';
      // Check if style already exists
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          /* Hide scrollbar for Chrome, Safari and Opera */
          .scroll-view-web::-webkit-scrollbar {
            display: none;
          }
          /* Hide scrollbar for IE, Edge and Firefox */
          .scroll-view-web {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.webContainer}>
          <Loading />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.webContainer}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={64} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.title, titleStyle]}>Error</Text>
              <Text style={[styles.description, textStyle]}>{error}</Text>
              {Platform.OS === 'web' && (
                <View style={{ marginTop: 16, padding: 12, backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 8 }}>
                  <Text style={[styles.description, { fontSize: 12, fontFamily: 'monospace' }]}>
                    Token: {params.token ? `${params.token.substring(0, 20)}...` : 'none'}
                  </Text>
                  <Text style={[styles.description, { fontSize: 12, marginTop: 8 }]}>
                    Check browser console for detailed logs
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const Container = Platform.OS === 'web' ? View : SafeAreaView;
  const containerProps = Platform.OS === 'web'
    ? { style: [styles.container, isDark && styles.containerDark] }
    : { style: [styles.container, isDark && styles.containerDark], edges: ['top', 'bottom', 'left', 'right'] as const };

  return (
    <Container {...containerProps}>
      {/* Header with centered logo - outside webContainer for full width */}
      <View style={styles.topHeader}>
        <Image
          source={require('@/assets/logo-dark.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.webContainer}>
        {Platform.OS === 'web' ? (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            // @ts-ignore - web-specific className
            className={Platform.OS === 'web' ? 'scroll-view-web' : undefined}
          >
            <View style={styles.headerContainer}>
              <Text style={[styles.screenTitle, titleStyle]}>Set Up Bank Account</Text>
              <Text style={[styles.screenSubtitle, subtitleStyle]}>
                Enter bank account details to enable payments for your child
              </Text>
            </View>

            {teenName && (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={20} color="#73af17" />
                <Text style={[styles.infoBannerText, textStyle]}>
                  Setting up bank account for <Text style={styles.infoBannerName}>{teenName}</Text>
                </Text>
              </View>
            )}

            {/* Financial Connections Option - Available on all platforms */}
            <View style={[styles.section, cardStyle, { marginBottom: 16 }]}>
              <View style={{ marginBottom: 12 }}>
                <Ionicons name="shield-checkmark" size={24} color="#73af17" style={{ marginBottom: 8 }} />
                <Text style={[styles.sectionTitle, titleStyle, { marginBottom: 4 }]}>
                  Connect Securely (Recommended)
                </Text>
                <Text style={[styles.sectionDescription, textStyle, { fontSize: 14 }]}>
                  Connect your bank account instantly using Stripe's secure authentication. No manual entry required.
                </Text>
              </View>
              <Button
                onPress={handleConnectWithFinancialConnections}
                disabled={isConnecting || isSubmitting}
                style={{ marginTop: 8 }}
              >
                {isConnecting ? 'Connecting...' : 'Connect Bank Account Securely'}
              </Button>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
              <Text style={[textStyle, { marginHorizontal: 16, fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                OR
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
            </View>

            <View style={[styles.section, cardStyle]}>
              <Text style={[styles.sectionTitle, titleStyle]}>Account Information</Text>
              <Text style={[styles.sectionDescription, textStyle]}>
                Your bank account information is encrypted and secure. We use Stripe to process payments.
              </Text>

              {/* Account Type and Bank Name Row */}
              <View style={Platform.OS === 'web' ? styles.twoColumnContainer : undefined}>
                {/* Account Type Selector */}
                <View style={[styles.accountTypeContainer, Platform.OS === 'web' && styles.column]}>
                  <Text style={[styles.label, textStyle]}>Account Type <Text style={styles.requiredAsterisk}>*</Text></Text>
                  <Controller
                    control={control}
                    name="account_type"
                    render={({ field: { onChange, value } }) => (
                      <>
                        {Platform.OS === 'web' ? (
                          <View style={styles.dropdownContainer}>
                            <select
                              value={value}
                              onChange={(e) => {
                                onChange(e.target.value as 'checking' | 'savings');
                                setValue('account_type', e.target.value as 'checking' | 'savings', { shouldValidate: true });
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                fontSize: '16px',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: '#B8BDC5',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                color: '#111827',
                                minHeight: '50px',
                              }}
                            >
                              <option value="checking">Checking</option>
                              <option value="savings">Savings</option>
                            </select>
                          </View>
                        ) : (
                          <>
                            <Pressable
                              style={[styles.dropdownButton, cardStyle]}
                              onPress={() => setShowAccountTypeDropdown(true)}
                            >
                              <Text style={[styles.dropdownButtonText, textStyle]}>
                                {value === 'checking' ? 'Checking' : 'Savings'}
                              </Text>
                              <Ionicons name="chevron-down" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </Pressable>
                            <Modal
                              visible={showAccountTypeDropdown}
                              transparent={true}
                              animationType="fade"
                              onRequestClose={() => setShowAccountTypeDropdown(false)}
                            >
                              <Pressable
                                style={styles.modalOverlay}
                                onPress={() => setShowAccountTypeDropdown(false)}
                              >
                                <View style={[styles.dropdownMenu, cardStyle]}>
                                  <Pressable
                                    style={styles.dropdownOption}
                                    onPress={() => {
                                      onChange('checking');
                                      setValue('account_type', 'checking', { shouldValidate: true });
                                      setShowAccountTypeDropdown(false);
                                    }}
                                  >
                                    <Text style={[styles.dropdownOptionText, textStyle, value === 'checking' && styles.dropdownOptionTextActive]}>
                                      Checking
                                    </Text>
                                    {value === 'checking' && (
                                      <Ionicons name="checkmark" size={20} color="#73af17" />
                                    )}
                                  </Pressable>
                                  <Pressable
                                    style={styles.dropdownOption}
                                    onPress={() => {
                                      onChange('savings');
                                      setValue('account_type', 'savings', { shouldValidate: true });
                                      setShowAccountTypeDropdown(false);
                                    }}
                                  >
                                    <Text style={[styles.dropdownOptionText, textStyle, value === 'savings' && styles.dropdownOptionTextActive]}>
                                      Savings
                                    </Text>
                                    {value === 'savings' && (
                                      <Ionicons name="checkmark" size={20} color="#73af17" />
                                    )}
                                  </Pressable>
                                </View>
                              </Pressable>
                            </Modal>
                          </>
                        )}
                      </>
                    )}
                  />
                  {errors.account_type && (
                    <Text style={styles.errorText}>{errors.account_type.message}</Text>
                  )}
                </View>

                {/* Bank Name */}
                <View style={Platform.OS === 'web' ? styles.column : undefined}>
                  <Controller
                    control={control}
                    name="bank_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Bank Name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.bank_name?.message}
                        required
                        placeholder="Chase, Bank of America, etc."
                        autoCapitalize="words"
                        forceLightTheme={Platform.OS === 'web'}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Two Column Layout for Web */}
              <View style={styles.twoColumnContainer}>
                {/* Left Column */}
                <View style={styles.column}>
                  {/* Account Holder Name */}
                  <Controller
                    control={control}
                    name="account_holder_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Account Holder Name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.account_holder_name?.message}
                        required
                        placeholder="John Doe"
                        autoCapitalize="words"
                        forceLightTheme={Platform.OS === 'web'}
                      />
                    )}
                  />

                  {/* Account Number */}
                  <Controller
                    control={control}
                    name="account_number"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View style={styles.inputWithToggle}>
                        <Input
                          label="Account Number"
                          value={value}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/\D/g, '').slice(0, 17);
                            onChange(cleaned);
                          }}
                          onBlur={onBlur}
                          error={errors.account_number?.message}
                          required
                          placeholder="Enter account number"
                          keyboardType="number-pad"
                          secureTextEntry={!showAccountNumber}
                          maxLength={17}
                          forceLightTheme={Platform.OS === 'web'}
                          style={styles.inputWithIcon}
                        />
                        <Pressable
                          style={styles.eyeIcon}
                          onPress={() => setShowAccountNumber(!showAccountNumber)}
                        >
                          <Ionicons
                            name={showAccountNumber ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#6B7280"
                          />
                        </Pressable>
                      </View>
                    )}
                  />
                </View>

                {/* Right Column */}
                <View style={styles.column}>
                  {/* Routing Number */}
                  <Controller
                    control={control}
                    name="routing_number"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View style={styles.inputWithToggle}>
                        <Input
                          label="Routing Number"
                          value={value}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/\D/g, '').slice(0, 9);
                            onChange(cleaned);
                          }}
                          onBlur={onBlur}
                          error={errors.routing_number?.message}
                          required
                          placeholder="123456789"
                          keyboardType="number-pad"
                          secureTextEntry={!showRoutingNumber}
                          maxLength={9}
                          forceLightTheme={Platform.OS === 'web'}
                          style={styles.inputWithIcon}
                        />
                        <Pressable
                          style={styles.eyeIcon}
                          onPress={() => setShowRoutingNumber(!showRoutingNumber)}
                        >
                          <Ionicons
                            name={showRoutingNumber ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#6B7280"
                          />
                        </Pressable>
                      </View>
                    )}
                  />

                  {/* Confirm Account Number */}
                  <Controller
                    control={control}
                    name="confirm_account_number"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View style={styles.inputWithToggle}>
                        <Input
                          label="Confirm Account Number"
                          value={value}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/\D/g, '').slice(0, 17);
                            onChange(cleaned);
                          }}
                          onBlur={onBlur}
                          error={errors.confirm_account_number?.message}
                          required
                          placeholder="Re-enter account number"
                          keyboardType="number-pad"
                          secureTextEntry={!showConfirmAccountNumber}
                          maxLength={17}
                          forceLightTheme={Platform.OS === 'web'}
                          style={styles.inputWithIcon}
                        />
                        <Pressable
                          style={styles.eyeIcon}
                          onPress={() => setShowConfirmAccountNumber(!showConfirmAccountNumber)}
                        >
                          <Ionicons
                            name={showConfirmAccountNumber ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#6B7280"
                          />
                        </Pressable>
                      </View>
                    )}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                <Text style={[styles.infoText, textStyle]}>
                  After submitting, we'll send two small test deposits to verify the account. This usually takes 1-2 business days.
                </Text>
              </View>
            </View>

            <View style={[styles.section, cardStyle]}>
              <Text style={[styles.sectionTitle, titleStyle]}>Authorization</Text>
              <Text style={[styles.sectionDescription, textStyle]}>
                Please read and accept the authorization below
              </Text>
              <Text style={[styles.authorizationText, textStyle]}>
                I hereby authorize Ollie to set up the bank account listed above for transactions related to my minor child's Ollie account. I understand that:
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.bulletText, textStyle]}>
                    I am the parent or guardian of the account holder
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.bulletText, textStyle]}>
                    I have the legal authority to set up this bank account
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.bulletText, textStyle]}>
                    This authorization remains in effect until revoked
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.bulletText, textStyle]}>
                    I can revoke this authorization at any time by contacting Ollie support
                  </Text>
                </View>
              </View>
              
              <Controller
                control={control}
                name="authorization_agreed"
                render={({ field: { onChange, value } }) => (
                  <Pressable
                    style={styles.checkboxContainer}
                    onPress={() => onChange(!value)}
                  >
                    <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                      {value && (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={[styles.checkboxLabel, textStyle]}>
                      I authorize Ollie to set up the bank account listed above for my minor child's account <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                  </Pressable>
                )}
              />
              {errors.authorization_agreed && (
                <Text style={styles.errorText}>{errors.authorization_agreed.message}</Text>
              )}
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Clear Form"
                onPress={clearForm}
                variant="secondary"
                disabled={isSubmitting}
              />
              <Button
                title="Set Up Bank Account"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting || !authorizationAgreed}
              />
            </View>
          </ScrollView>
        ) : (
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
              <View style={styles.headerContainer}>
                <Text style={[styles.screenTitle, titleStyle]}>Set Up Bank Account</Text>
                <Text style={[styles.screenSubtitle, subtitleStyle]}>
                  Enter bank account details to enable payments for your child
                </Text>
              </View>

              {teenName && (
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={20} color="#73af17" />
                  <Text style={[styles.infoBannerText, textStyle]}>
                    Setting up bank account for <Text style={styles.infoBannerName}>{teenName}</Text>
                  </Text>
                </View>
              )}

              {/* Financial Connections Option - Available on all platforms */}
              <View style={[styles.section, cardStyle, { marginBottom: 16 }]}>
                <View style={{ marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={24} color="#73af17" style={{ marginBottom: 8 }} />
                  <Text style={[styles.sectionTitle, titleStyle, { marginBottom: 4 }]}>
                    Connect Securely (Recommended)
                  </Text>
                  <Text style={[styles.sectionDescription, textStyle, { fontSize: 14 }]}>
                    Connect your bank account instantly using Stripe's secure authentication. No manual entry required.
                  </Text>
                </View>
                <Button
                  onPress={handleConnectWithFinancialConnections}
                  disabled={isConnecting || isSubmitting}
                  style={{ marginTop: 8 }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Bank Account Securely'}
                </Button>
              </View>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
                <Text style={[textStyle, { marginHorizontal: 16, fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  OR
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
              </View>

              <View style={[styles.section, cardStyle]}>
                <Text style={[styles.sectionTitle, titleStyle]}>Account Information</Text>
                <Text style={[styles.sectionDescription, textStyle]}>
                  Your bank account information is encrypted and secure. We use Stripe to process payments.
                </Text>

                {/* Account Type and Bank Name Row */}
                <View>
                  {/* Account Type Selector */}
                  <View style={styles.accountTypeContainer}>
                    <Text style={[styles.label, textStyle]}>Account Type <Text style={styles.requiredAsterisk}>*</Text></Text>
                    <Controller
                      control={control}
                      name="account_type"
                      render={({ field: { onChange, value } }) => (
                        <>
                          {Platform.OS === 'web' ? (
                            <View style={styles.dropdownContainer}>
                              <select
                                value={value}
                                onChange={(e) => {
                                  onChange(e.target.value as 'checking' | 'savings');
                                  setValue('account_type', e.target.value as 'checking' | 'savings', { shouldValidate: true });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  fontSize: '16px',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  borderColor: '#B8BDC5',
                                  borderRadius: '8px',
                                  backgroundColor: 'transparent',
                                  color: '#111827',
                                  minHeight: '50px',
                                }}
                              >
                                <option value="checking">Checking</option>
                                <option value="savings">Savings</option>
                              </select>
                            </View>
                          ) : (
                            <>
                              <Pressable
                                style={[styles.dropdownButton, cardStyle]}
                                onPress={() => setShowAccountTypeDropdown(true)}
                              >
                                <Text style={[styles.dropdownButtonText, textStyle]}>
                                  {value === 'checking' ? 'Checking' : 'Savings'}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              </Pressable>
                              <Modal
                                visible={showAccountTypeDropdown}
                                transparent={true}
                                animationType="fade"
                                onRequestClose={() => setShowAccountTypeDropdown(false)}
                              >
                                <Pressable
                                  style={styles.modalOverlay}
                                  onPress={() => setShowAccountTypeDropdown(false)}
                                >
                                  <View style={[styles.dropdownMenu, cardStyle]}>
                                    <Pressable
                                      style={styles.dropdownOption}
                                      onPress={() => {
                                        onChange('checking');
                                        setValue('account_type', 'checking', { shouldValidate: true });
                                        setShowAccountTypeDropdown(false);
                                      }}
                                    >
                                      <Text style={[styles.dropdownOptionText, textStyle, value === 'checking' && styles.dropdownOptionTextActive]}>
                                        Checking
                                      </Text>
                                      {value === 'checking' && (
                                        <Ionicons name="checkmark" size={20} color="#73af17" />
                                      )}
                                    </Pressable>
                                    <Pressable
                                      style={styles.dropdownOption}
                                      onPress={() => {
                                        onChange('savings');
                                        setValue('account_type', 'savings', { shouldValidate: true });
                                        setShowAccountTypeDropdown(false);
                                      }}
                                    >
                                      <Text style={[styles.dropdownOptionText, textStyle, value === 'savings' && styles.dropdownOptionTextActive]}>
                                        Savings
                                      </Text>
                                      {value === 'savings' && (
                                        <Ionicons name="checkmark" size={20} color="#73af17" />
                                      )}
                                    </Pressable>
                                  </View>
                                </Pressable>
                              </Modal>
                            </>
                          )}
                        </>
                      )}
                    />
                    {errors.account_type && (
                      <Text style={styles.errorText}>{errors.account_type.message}</Text>
                    )}
                  </View>

                  {/* Bank Name */}
                  <View>
                    <Controller
                      control={control}
                      name="bank_name"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Bank Name"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.bank_name?.message}
                          required
                          placeholder="Chase, Bank of America, etc."
                          autoCapitalize="words"
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Two Column Layout for Web */}
                <View style={styles.twoColumnContainer}>
                  {/* Left Column */}
                  <View style={styles.column}>
                    {/* Account Holder Name */}
                    <Controller
                      control={control}
                      name="account_holder_name"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Account Holder Name"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.account_holder_name?.message}
                          required
                          placeholder="John Doe"
                          autoCapitalize="words"
                        />
                      )}
                    />

                    {/* Account Number */}
                    <Controller
                      control={control}
                      name="account_number"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <View style={styles.inputWithToggle}>
                          <Input
                            label="Account Number"
                            value={value}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/\D/g, '').slice(0, 17);
                              onChange(cleaned);
                            }}
                            onBlur={onBlur}
                            error={errors.account_number?.message}
                            required
                            placeholder="Enter account number"
                            keyboardType="number-pad"
                            secureTextEntry={!showAccountNumber}
                            maxLength={17}
                            style={styles.inputWithIcon}
                          />
                          <Pressable
                            style={styles.eyeIcon}
                            onPress={() => setShowAccountNumber(!showAccountNumber)}
                          >
                            <Ionicons
                              name={showAccountNumber ? 'eye-outline' : 'eye-off-outline'}
                              size={20}
                              color="#6B7280"
                            />
                          </Pressable>
                        </View>
                      )}
                    />
                  </View>

                  {/* Right Column */}
                  <View style={styles.column}>
                    {/* Routing Number */}
                    <Controller
                      control={control}
                      name="routing_number"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <View style={styles.inputWithToggle}>
                          <Input
                            label="Routing Number"
                            value={value}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/\D/g, '').slice(0, 9);
                              onChange(cleaned);
                            }}
                            onBlur={onBlur}
                            error={errors.routing_number?.message}
                            required
                            placeholder="123456789"
                            keyboardType="number-pad"
                            secureTextEntry={!showRoutingNumber}
                            maxLength={9}
                            style={styles.inputWithIcon}
                          />
                          <Pressable
                            style={styles.eyeIcon}
                            onPress={() => setShowRoutingNumber(!showRoutingNumber)}
                          >
                            <Ionicons
                              name={showRoutingNumber ? 'eye-outline' : 'eye-off-outline'}
                              size={20}
                              color="#6B7280"
                            />
                          </Pressable>
                        </View>
                      )}
                    />

                    {/* Confirm Account Number */}
                    <Controller
                      control={control}
                      name="confirm_account_number"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <View style={styles.inputWithToggle}>
                          <Input
                            label="Confirm Account Number"
                            value={value}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/\D/g, '').slice(0, 17);
                              onChange(cleaned);
                            }}
                            onBlur={onBlur}
                            error={errors.confirm_account_number?.message}
                            required
                            placeholder="Re-enter account number"
                            keyboardType="number-pad"
                            secureTextEntry={!showConfirmAccountNumber}
                            maxLength={17}
                            style={styles.inputWithIcon}
                          />
                          <Pressable
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmAccountNumber(!showConfirmAccountNumber)}
                          >
                            <Ionicons
                              name={showConfirmAccountNumber ? 'eye-outline' : 'eye-off-outline'}
                              size={20}
                              color="#6B7280"
                            />
                          </Pressable>
                        </View>
                      )}
                    />
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                  <Text style={[styles.infoText, textStyle]}>
                    After submitting, we'll send two small test deposits to verify the account. This usually takes 1-2 business days.
                  </Text>
                </View>
              </View>

              <View style={[styles.section, cardStyle]}>
                <Text style={[styles.sectionTitle, titleStyle]}>Authorization</Text>
                <Text style={[styles.sectionDescription, textStyle]}>
                  Please read and accept the authorization below
                </Text>
                <Text style={[styles.authorizationText, textStyle]}>
                  I hereby authorize Ollie to set up the bank account listed above for transactions related to my minor child's Ollie account. I understand that:
                </Text>
                <View style={styles.bulletList}>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, textStyle]}>
                      I am the parent or guardian of the account holder
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, textStyle]}>
                      I have the legal authority to set up this bank account
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, textStyle]}>
                      This authorization remains in effect until revoked
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, textStyle]}>
                      I can revoke this authorization at any time by contacting Ollie support
                    </Text>
                  </View>
                </View>
              
                <Controller
                  control={control}
                  name="authorization_agreed"
                  render={({ field: { onChange, value } }) => (
                    <Pressable
                      style={styles.checkboxContainer}
                      onPress={() => onChange(!value)}
                    >
                      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                        {value && (
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, textStyle]}>
                        I authorize Ollie to set up the bank account listed above for my minor child's account
                      </Text>
                    </Pressable>
                  )}
                />
                {errors.authorization_agreed && (
                  <Text style={styles.errorText}>{errors.authorization_agreed.message}</Text>
                )}
              </View>

            <View style={styles.buttonRow}>
              <Button
                title="Clear Form"
                onPress={clearForm}
                variant="secondary"
                disabled={isSubmitting}
              />
              <Button
                title="Set Up Bank Account"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting || !authorizationAgreed}
              />
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  webContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    }),
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
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 48,
      // No flex constraints - let content determine height
    }),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      minHeight: 400,
    }),
  },
  topHeader: {
    width: '100%',
    paddingVertical: Platform.OS === 'web' ? 16 : 16,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: Platform.OS === 'web' ? 8 : 16,
    backgroundColor: Platform.OS === 'web' ? '#F3F4F6' : '#FFFFFF',
    ...(Platform.OS === 'web' ? {
      borderBottomWidth: 0,
    } : {
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: Platform.OS === 'web' ? 120 : 100,
    height: Platform.OS === 'web' ? 120 : 100,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    ...(Platform.OS === 'web' && {
      marginTop: 0,
    }),
  },
  header: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: Platform.OS === 'web' ? -0.5 : 0,
  },
  screenSubtitle: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    flexWrap: 'nowrap',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: Platform.OS === 'web' ? 16 : 12,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  infoBannerText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    marginLeft: 8,
    color: '#166534',
    flex: 1,
  },
  infoBannerName: {
    color: '#73af17',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'web' ? 16 : 12,
    padding: Platform.OS === 'web' ? 32 : 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#B8BDC5',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 22 : 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
    letterSpacing: Platform.OS === 'web' ? -0.3 : 0,
  },
  sectionDescription: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    lineHeight: Platform.OS === 'web' ? 22 : 20,
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
    color: '#374151',
  },
  twoColumnContainer: {
    ...(Platform.OS === 'web' && {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 0,
    }),
  },
  column: {
    ...(Platform.OS === 'web' && {
      flex: 1,
    }),
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
    justifyContent: 'center',
    padding: Platform.OS === 'web' ? 18 : 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#B8BDC5',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }),
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
  dropdownContainer: {
    width: '100%',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8BDC5',
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  dropdownOptionTextActive: {
    color: '#73af17',
    fontWeight: '600',
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
    padding: Platform.OS === 'web' ? 16 : 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    lineHeight: Platform.OS === 'web' ? 22 : 20,
    marginLeft: 8,
    flex: 1,
    color: '#92400E',
  },
  authorizationText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    lineHeight: Platform.OS === 'web' ? 24 : 22,
    marginTop: 16,
    marginBottom: 12,
    color: '#374151',
  },
  bulletList: {
    marginTop: 8,
    marginLeft: Platform.OS === 'web' ? 24 : 20,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Platform.OS === 'web' ? 12 : 10,
  },
  bullet: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    marginRight: 12,
    color: '#374151',
    lineHeight: Platform.OS === 'web' ? 24 : 22,
  },
  bulletText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    lineHeight: Platform.OS === 'web' ? 24 : 22,
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#B8BDC5',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  checkboxLabel: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    lineHeight: Platform.OS === 'web' ? 24 : 22,
    flex: 1,
    color: '#374151',
  },
  requiredAsterisk: {
    color: '#DC2626',
  },
  buttonContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    gap: 12,
  },
  inputWithToggle: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 38,
    padding: 4,
    zIndex: 1,
  },
});

