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
  if (!session) {
    throw new Error('User not authenticated');
  }
  const { data, error } = await supabase.functions.invoke('create-setup-intent', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw error;
  }
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

  if (error) {
    console.error('Error from add-payment-method function:', error);
    throw error;
  }
  
  // Check if the response contains an error
  if (data?.error) {
    console.error('Error in response data:', data.error);
    throw new Error(data.error || 'Failed to add payment method');
  }
  
  // The edge function should return { payment_method: ... }
  // If we get payment_methods (plural), something is wrong - don't silently handle it
  if (data?.payment_methods) {
    console.error('ERROR: Received payment_methods (plural) instead of payment_method (singular). This indicates the wrong function was called or the response was transformed incorrectly.');
    console.error('Full response data:', JSON.stringify(data, null, 2));
    throw new Error('Invalid response format: received payment_methods instead of payment_method. The payment method was not saved.');
  }
  
  if (!data?.payment_method) {
    console.error('No payment_method in response:', JSON.stringify(data, null, 2));
    throw new Error('Failed to add payment method: No payment method returned');
  }

  // Verify the payment method has required fields
  if (!data.payment_method.id || !data.payment_method.stripe_payment_method_id) {
    console.error('Payment method missing required fields:', data.payment_method);
    throw new Error('Failed to add payment method: Invalid payment method data returned');
  }

  console.log('Successfully added payment method:', data.payment_method.id);
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
 * Deletes from both Stripe and the database
 */
export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('remove-payment-method', {
    body: {
      payment_method_id: paymentMethodId,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error('Failed to remove payment method');
  }
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
  parent_email_masked?: string;
}

/**
 * Request parent to set up bank account
 * Sends an email to the parent with a secure link to enter bank account details
 */
export async function requestBankAccountSetup(): Promise<{
  success: boolean;
  expires_at: string;
  parent_email_masked?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Get teen user profile to find parent
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not found');

  const { data: teenUser, error: teenError } = await supabase
    .from('users')
    .select('id, parent_id, role, full_name')
    .eq('id', user.id)
    .single();

  if (teenError || !teenUser) {
    throw new Error('User profile not found');
  }

  if (teenUser.role !== 'teen') {
    throw new Error('Only teens can request bank account setup');
  }

  if (!teenUser.parent_id) {
    throw new Error('No parent associated with this account');
  }

  // Get parent's information (email, phone, full_name) using database function
  const { data: parentInfoResult, error: parentInfoError } = await supabase
    .rpc('get_parent_info_for_bank_setup');

  if (parentInfoError) {
    console.error('Error fetching parent info:', parentInfoError);
    throw new Error(`Failed to fetch parent information: ${parentInfoError.message}`);
  }

  // The function returns a single row with email, phone, full_name
  if (!parentInfoResult || parentInfoResult.length === 0 || !parentInfoResult[0]?.email) {
    throw new Error('Parent email not found. Please ensure the parent account exists and has an email address.');
  }

  const parentEmail = parentInfoResult[0].email;
  const parentPhone = parentInfoResult[0].phone || null;

  // Generate secure token for email link
  const { randomUUID } = await import('expo-crypto');
  const setupToken = randomUUID();
  
  // Set expiration to 7 days from now (email links last longer than OTP)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const tokenExpiresAt = expiresAt.toISOString();

  // Create or update approval record with token
  const { data: approval, error: approvalError } = await supabase
    .from('bank_account_approvals')
    .upsert({
      teen_id: teenUser.id,
      parent_phone: parentPhone, // Keep for reference, but not required
      setup_token: setupToken,
      token_expires_at: tokenExpiresAt,
      status: 'pending',
      expires_at: tokenExpiresAt, // Use same expiration for consistency
      attempts: 0,
      verified_at: null,
      otp_code: null, // Not used in email flow
    }, {
      onConflict: 'teen_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (approvalError) {
    console.error('Error creating approval record:', approvalError);
    throw new Error('Failed to create approval record');
  }

  // Send email via Edge Function
  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://olliejobs.com';
  
  try {
    const { data: emailResult, error: emailError } = await supabase.functions.invoke(
      'send-bank-account-setup-email',
      {
        body: {
          parent_email: parentEmail,
          teen_name: teenUser.full_name,
          setup_token: setupToken,
          web_app_url: webAppUrl,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (emailError) {
      console.error('Error sending email:', emailError);
      // Update approval status to reflect failure
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id);
      throw new Error('Failed to send setup email');
    }

    if (!emailResult?.success) {
      // Update approval status to reflect failure
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id);
      throw new Error(emailResult?.error || 'Failed to send setup email');
    }
    
    // Mask email for display
    const maskedEmail = parentEmail.replace(/(.{2})(.*)(@.*)/, (match, start, middle, domain) => {
      return `${start}***${domain}`;
    });
    
    return {
      success: true,
      expires_at: tokenExpiresAt,
      parent_email_masked: maskedEmail,
    };
  } catch (error: any) {
    // Update approval status to reflect failure
    await supabase
      .from('bank_account_approvals')
      .update({ status: 'expired' })
      .eq('id', approval.id);
    
    throw error;
  }
}

/**
 * Get the current bank account approval/setup status for the teen
 */
export async function getBankAccountApprovalStatus(): Promise<BankAccountApprovalStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Query the bank_account_approvals table
  // Get parent email from users table via parent_id
  const { data: approvalData, error: approvalError } = await supabase
    .from('bank_account_approvals')
    .select('status, expires_at, attempts, verified_at, token_expires_at')
    .eq('teen_id', user.id)
    .single();

  if (approvalError) {
    // If no record found, return 'none' status
    if (approvalError.code === 'PGRST116') {
      return { status: 'none' };
    }
    throw approvalError;
  }

  // Get parent email for masking (using RPC function to bypass RLS)
  let parentEmailMasked: string | undefined;
  try {
    const { data: parentInfo } = await supabase.rpc('get_parent_info_for_bank_setup');
    if (parentInfo && parentInfo.length > 0 && parentInfo[0]?.email) {
      const email = parentInfo[0].email;
      parentEmailMasked = email.replace(/(.{2})(.*)(@.*)/, (match, start, middle, domain) => {
        return `${start}***${domain}`;
      });
    }
  } catch (error) {
    console.warn('Could not fetch parent email for masking:', error);
  }

  // Check if expired (use token_expires_at if available, otherwise expires_at)
  const expirationDate = approvalData.token_expires_at || approvalData.expires_at;
  if (approvalData.status === 'pending' && expirationDate) {
    const expiresAt = new Date(expirationDate);
    const now = new Date();
    if (expiresAt <= now) {
      return {
        status: 'expired',
        expires_at: expirationDate,
        attempts: approvalData.attempts,
        parent_email_masked: parentEmailMasked,
      };
    }
  }

  return {
    status: approvalData.status as 'pending' | 'approved' | 'expired',
    expires_at: expirationDate,
    attempts: approvalData.attempts,
    verified_at: approvalData.verified_at,
    parent_email_masked: parentEmailMasked,
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

