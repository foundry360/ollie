import { supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/types';

// ============================================
// Payment Method Functions (for Neighbors)
// ============================================

/**
 * Get all payment methods for the current user
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('get-payment-methods', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  return data?.payment_methods || [];
}

/**
 * Create a Stripe Setup Intent for adding a payment method
 * Returns the client secret needed to initialize Stripe Payment Sheet
 */
export async function createSetupIntent(): Promise<{
  client_secret: string;
  customer_id?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  const { data, error } = await supabase.functions.invoke('create-setup-intent', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.client_secret) {
    throw new Error('Invalid response: missing client_secret');
  }
  
  return {
    client_secret: data.client_secret,
    customer_id: data.customer_id,
  };
}

/**
 * Add a payment method for the current user
 * @param paymentMethodId - Stripe payment method ID (from Stripe Elements or Payment Sheet)
 * @param isDefault - Whether this should be the default payment method
 */
export async function addPaymentMethod(
  paymentMethodId: string,
  isDefault: boolean = false
): Promise<PaymentMethod> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('add-payment-method', {
    body: {
      payment_method_id: paymentMethodId,
      is_default: isDefault,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.payment_method) {
    throw new Error('Failed to add payment method');
  }

  return data.payment_method;
}

/**
 * Set a payment method as default
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // First, unset all defaults
  await supabase
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', user.id)
    .eq('is_default', true);

  // Then set the new default
  const { error } = await supabase
    .from('payment_methods')
    .update({ is_default: true })
    .eq('user_id', user.id)
    .eq('stripe_payment_method_id', paymentMethodId);

  if (error) throw error;
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('user_id', user.id)
    .eq('stripe_payment_method_id', paymentMethodId);

  if (error) throw error;
}

/**
 * Get the default payment method for the current user
 */
export async function getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No default payment method
    }
    throw error;
  }

  return data;
}

// ============================================
// Payment Processing Functions
// ============================================

/**
 * Process payment for a completed gig
 * This is typically called by the database trigger, but can be called manually if needed
 */
export async function processPayment(gigId: string, earningsId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('process-payment', {
    body: {
      gig_id: gigId,
      earnings_id: earningsId,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error('Payment processing failed');
  }
}

/**
 * Get platform fee percentage
 */
export async function getPlatformFeePercentage(): Promise<number> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'platform_fee_percentage')
    .single();

  if (error) {
    // Default to 10% if not configured
    return 0.10;
  }

  return parseFloat(data.value) || 0.10;
}

// ============================================
// Bank Account Approval Functions (for Teenlancers)
// ============================================

export interface BankAccountApprovalStatus {
  status: 'none' | 'pending' | 'approved' | 'expired';
  expires_at?: string;
  attempts?: number;
  verified_at?: string;
  parent_phone_masked?: string;
}

/**
 * Request parent approval for bank account setup
 * Sends an OTP code to the parent's phone number
 */
export async function requestBankAccountApproval(): Promise<{
  success: boolean;
  expires_at: string;
  parent_phone_masked?: string;
}> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/payments.ts:214',message:'requestBankAccountApproval entry',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const { data: { session } } = await supabase.auth.getSession();
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/payments.ts:220',message:'Session check',data:{hasSession:!!session,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (!session) throw new Error('User not authenticated');

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/payments.ts:225',message:'Before edge function invoke',data:{functionName:'send-bank-account-approval-otp',hasBody:true,hasAuthHeader:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('send-bank-account-approval-otp', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/payments.ts:235',message:'After edge function invoke',data:{hasError:!!error,hasData:!!data,errorMessage:error?.message,errorName:error?.name,errorStatus:(error as any)?.status,dataSuccess:data?.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  if (error) {
    console.error('Edge Function error:', error);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/payments.ts:241',message:'Error details extraction',data:{errorMessage:error.message,errorName:error.name,errorContext:(error as any)?.context,errorDetails:(error as any)?.details,errorKeys:Object.keys(error || {})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Try to extract more details from the error
    // Check if data contains error information (sometimes errors are returned in data)
    if (data && (data as any).error) {
      const errorData = data as any;
      console.error('Error in response data:', errorData);
      throw new Error(errorData.error || errorData.message || errorData.details || 'Failed to send OTP code');
    }
    
    // Try to extract from error object
    const errorAny = error as any;
    const errorMessage = errorAny.message || error.message || 'Unknown error';
    const errorDetails = errorAny.context?.message || errorAny.details || errorAny.error;
    
    // Log full error structure for debugging
    console.error('Full error object:', {
      message: errorMessage,
      details: errorDetails,
      context: errorAny.context,
      keys: Object.keys(errorAny || {})
    });
    
    throw new Error(errorDetails || errorMessage);
  }

  if (!data) {
    throw new Error('No response from server');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to send OTP code');
  }

  return {
    success: data.success,
    expires_at: data.expires_at,
    parent_phone_masked: data.parent_phone_masked,
  };
}

/**
 * Verify the OTP code for bank account approval
 * @param otpCode - The 6-digit OTP code received by the parent
 */
export async function verifyBankAccountApprovalOTP(otpCode: string): Promise<{
  approved: boolean;
  verified_at: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header
  const { data, error } = await supabase.functions.invoke('verify-bank-account-approval-otp', {
    body: {
      otp_code: otpCode,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }

  if (!data) {
    throw new Error('No response from server');
  }

  if (!data.success || !data.approved) {
    throw new Error(data.error || 'OTP verification failed');
  }

  return {
    approved: data.approved,
    verified_at: data.verified_at,
  };
}

/**
 * Get the current bank account approval status for the teen
 */
export async function getBankAccountApprovalStatus(): Promise<BankAccountApprovalStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Query the bank_account_approvals table
  const { data, error } = await supabase
    .from('bank_account_approvals')
    .select('status, expires_at, attempts, verified_at, parent_phone')
    .eq('teen_id', user.id)
    .single();

  if (error) {
    // If no record found, return 'none' status
    if (error.code === 'PGRST116') {
      return { status: 'none' };
    }
    throw error;
  }

  // Check if expired
  if (data.status === 'pending' && data.expires_at) {
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return {
        status: 'expired',
        expires_at: data.expires_at,
        attempts: data.attempts,
      };
    }
  }

  // Mask parent phone for privacy
  let parentPhoneMasked: string | undefined;
  if (data.parent_phone) {
    parentPhoneMasked = data.parent_phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****');
  }

  return {
    status: data.status as 'pending' | 'approved' | 'expired',
    expires_at: data.expires_at,
    attempts: data.attempts,
    verified_at: data.verified_at,
    parent_phone_masked: parentPhoneMasked,
  };
}

// ============================================
// Bank Account Functions (for Teenlancers)
// ============================================

export interface BankAccount {
  id: string;
  user_id: string;
  stripe_external_account_id: string;
  stripe_customer_id?: string;
  account_type: 'checking' | 'savings';
  account_holder_name: string;
  bank_name?: string;
  routing_number_last4?: string;
  account_number_last4: string;
  verification_status: 'pending' | 'verified' | 'failed' | 'unverified';
  verification_method?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

export interface CreateBankAccountData {
  routing_number: string;
  account_number: string;
  account_type: 'checking' | 'savings';
  account_holder_name: string;
}

export interface CreateBankAccountResponse {
  success: boolean;
  bank_account: {
    id: string;
    verification_status: 'pending' | 'verified' | 'failed' | 'unverified';
    bank_name?: string;
    account_type: 'checking' | 'savings';
    account_number_last4: string;
    routing_number_last4?: string;
    requires_verification: boolean;
  };
}

/**
 * Create a bank account for the current user (Teenlancer)
 * @param data - Bank account information
 */
export async function createBankAccount(data: CreateBankAccountData): Promise<CreateBankAccountResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header
  const { data: result, error } = await supabase.functions.invoke('create-bank-account', {
    body: {
      routing_number: data.routing_number,
      account_number: data.account_number,
      account_type: data.account_type,
      account_holder_name: data.account_holder_name,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }

  if (!result) {
    throw new Error('No response from server');
  }

  if (!result.success) {
    throw new Error(result.error || 'Failed to create bank account');
  }

  return result;
}

/**
 * Verify bank account with micro-deposit amounts
 * @param amount1 - First micro-deposit amount (e.g., 0.32)
 * @param amount2 - Second micro-deposit amount (e.g., 0.45)
 */
export async function verifyBankAccount(amount1: string, amount2: string): Promise<{
  verified: boolean;
  verified_at: string;
  bank_account: {
    id: string;
    verification_status: 'verified';
    bank_name?: string;
    account_type: 'checking' | 'savings';
    account_number_last4: string;
  };
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header
  const { data, error } = await supabase.functions.invoke('verify-bank-account', {
    body: {
      amount1: amount1,
      amount2: amount2,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }

  if (!data) {
    throw new Error('No response from server');
  }

  if (!data.success || !data.verified) {
    throw new Error(data.error || 'Bank account verification failed');
  }

  return {
    verified: data.verified,
    verified_at: data.verified_at,
    bank_account: data.bank_account,
  };
}

/**
 * Get the current user's bank account
 */
export async function getBankAccount(): Promise<BankAccount | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Query the bank_accounts table
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If no record found, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as BankAccount;
}

/**
 * Resend micro-deposits by deleting the current bank account
 * User will need to add their bank account again to receive new verification deposits
 */
export async function resendMicroDeposits(): Promise<{
  success: boolean;
  message: string;
  deleted: boolean;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header
  const { data, error } = await supabase.functions.invoke('resend-micro-deposits', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }

  if (!data) {
    throw new Error('No response from server');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to resend micro-deposits');
  }

  return {
    success: data.success,
    message: data.message,
    deleted: data.deleted,
  };
}

/**
 * Delete the current user's bank account
 */
export async function deleteBankAccount(): Promise<{
  success: boolean;
  message: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header
  const { data, error } = await supabase.functions.invoke('delete-bank-account', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }

  if (!data) {
    throw new Error('No response from server');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete bank account');
  }

  return {
    success: data.success,
    message: data.message,
  };
}

