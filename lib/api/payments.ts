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
 * Sends an OTP code to the parent's phone number using Supabase auth (same as neighbor signup)
 */
export async function requestBankAccountApproval(): Promise<{
  success: boolean;
  expires_at: string;
  parent_phone_masked?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Get teen user profile to find parent
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not found');

  const { data: teenUser, error: teenError } = await supabase
    .from('users')
    .select('id, parent_id, role')
    .eq('id', user.id)
    .single();

  if (teenError || !teenUser) {
    throw new Error('User profile not found');
  }

  if (teenUser.role !== 'teen') {
    throw new Error('Only teens can request bank account approval');
  }

  if (!teenUser.parent_id) {
    throw new Error('No parent associated with this account');
  }

  // Get parent's phone number using database function (bypasses RLS)
  // Migration 032 removed parent-child queries from RLS to avoid recursion
  // So we use a SECURITY DEFINER function to safely get the parent's phone
  const { data: parentPhoneResult, error: parentPhoneError } = await supabase
    .rpc('get_parent_phone_for_bank_approval');

  if (parentPhoneError) {
    console.error('Error fetching parent phone:', parentPhoneError);
    throw new Error(`Failed to fetch parent phone: ${parentPhoneError.message}`);
  }

  // The function returns a single TEXT value (the phone number)
  const parentPhone = parentPhoneResult?.trim() || '';
  if (!parentPhone) {
    throw new Error('Parent phone number not found. Please ensure the parent account exists and has a phone number.');
  }

  // Normalize phone number (ensure E.164 format)
  const normalizedPhone = parentPhone.trim().replace(/\s+/g, '');
  const finalParentPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

  // Set expiration to 15 minutes from now
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  // Create or update approval record
  const { data: approval, error: approvalError } = await supabase
    .from('bank_account_approvals')
    .upsert({
      teen_id: teenUser.id,
      parent_phone: finalParentPhone,
      otp_code: null, // Will be set after OTP is sent (if needed for tracking)
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified_at: null,
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

  // Send OTP using Supabase auth (same as neighbor signup)
  // This uses Twilio Verify automatically through Supabase's phone provider
  const { sendPhoneOTP } = await import('@/lib/supabase');
  
  try {
    await sendPhoneOTP(finalParentPhone);
    
    // Mask phone number for display
    const maskedPhone = finalParentPhone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****');
    
    return {
      success: true,
      expires_at: expiresAt.toISOString(),
      parent_phone_masked: maskedPhone,
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
 * Verify the OTP code for bank account approval
 * Uses Supabase auth.verifyOtp (same as neighbor signup)
 * @param otpCode - The 6-digit OTP code received by the parent
 */
export async function verifyBankAccountApprovalOTP(otpCode: string): Promise<{
  approved: boolean;
  verified_at: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Get teen user profile to find parent
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not found');

  const { data: teenUser, error: teenError } = await supabase
    .from('users')
    .select('id, parent_id, role')
    .eq('id', user.id)
    .single();

  if (teenError || !teenUser) {
    throw new Error('User profile not found');
  }

  if (teenUser.role !== 'teen') {
    throw new Error('Only teens can verify bank account approval OTP');
  }

  // Get pending approval
  const { data: approval, error: approvalError } = await supabase
    .from('bank_account_approvals')
    .select('*')
    .eq('teen_id', teenUser.id)
    .single();

  if (approvalError || !approval) {
    throw new Error('No approval request found. Please request a new OTP code.');
  }

  // Check if already approved
  if (approval.status === 'approved') {
    return {
      approved: true,
      verified_at: approval.verified_at || new Date().toISOString(),
    };
  }

  // Check if expired
  const expiresAt = new Date(approval.expires_at);
  if (expiresAt <= new Date()) {
    await supabase
      .from('bank_account_approvals')
      .update({ status: 'expired' })
      .eq('id', approval.id);
    throw new Error('OTP code has expired. Please request a new code.');
  }

  // Check max attempts
  if (approval.attempts >= 5) {
    await supabase
      .from('bank_account_approvals')
      .update({ status: 'expired' })
      .eq('id', approval.id);
    throw new Error('Maximum verification attempts reached. Please request a new OTP code.');
  }

  // Verify OTP using Supabase auth, but restore session immediately to prevent redirect
  // Since we're using sendPhoneOTP (Supabase auth), we need to verify with verifyPhoneOTP
  // However, this might create a session for the parent's phone, so we restore the teen's session after
  const { verifyPhoneOTP } = await import('@/lib/supabase');

  // Save current session and user ID before verification
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) throw new Error('User not authenticated');
  
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id;

  // Set flag to suppress navigation during OTP verification
  const { useAuthStore } = await import('@/stores/authStore');
  useAuthStore.getState().setSuppressingNavigation(true);

  try {
    // Verify the code - this uses Twilio Verify through Supabase
    // It might create a session for the parent's phone, so we'll restore the teen's session after
    await verifyPhoneOTP(approval.parent_phone, otpCode);
    
    // Check if session changed (user ID might have changed)
    const { data: { user: userAfterVerify } } = await supabase.auth.getUser();
    const userIdAfterVerify = userAfterVerify?.id;
    
    // If the user ID changed, we need to restore the original session immediately
    if (userIdAfterVerify !== currentUserId) {
      console.log('Session changed after OTP verification, restoring original session...');
      
      // Immediately restore the original session to prevent navigation
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });
      
      if (restoreError) {
        console.error('Failed to restore session after OTP verification:', restoreError);
        // Try to sign out and sign back in with the original session
        await supabase.auth.signOut();
        const { error: restoreError2 } = await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
        
        if (restoreError2) {
          console.error('Failed to restore session on second attempt:', restoreError2);
          throw new Error('Session restoration failed. Please try again.');
        }
      }
      
      // Verify we're back to the original user
      const { data: { user: userAfterRestore } } = await supabase.auth.getUser();
      if (userAfterRestore?.id !== currentUserId) {
        console.error('Session restoration failed - user ID mismatch');
        throw new Error('Session restoration failed. Please try again.');
      }
      
      // Refresh user profile in auth store immediately to prevent navigation issues
      // The onAuthStateChange listener might have updated it with the wrong user
      if (currentUserId) {
        try {
          const { getUserProfile } = await import('@/lib/supabase');
          const refreshedProfile = await getUserProfile(currentUserId);
          // Immediately update auth store to prevent navigation redirects
          // Update store BEFORE clearing suppression flag
          useAuthStore.getState().setUser(refreshedProfile);
          
          // Small delay to ensure store update is processed
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (profileError) {
          console.warn('Failed to refresh user profile after session restoration:', profileError);
          // Continue anyway - the session is restored
        }
      }
      
      // Clear navigation suppression flag AFTER auth store is updated
      useAuthStore.getState().setSuppressingNavigation(false);
    }
    
    // OTP is valid! Update approval status
    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('bank_account_approvals')
      .update({
        status: 'approved',
        verified_at: verifiedAt,
        attempts: approval.attempts + 1,
      })
      .eq('id', approval.id);

    if (updateError) {
      console.error('Error updating approval:', updateError);
      throw new Error('Failed to update approval status');
    }

    return {
      approved: true,
      verified_at: verifiedAt,
    };
  } catch (error: any) {
    // Always clear navigation suppression flag on error
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().setSuppressingNavigation(false);
    
    // Increment attempts
    const newAttempts = approval.attempts + 1;
    await supabase
      .from('bank_account_approvals')
      .update({
        attempts: newAttempts,
        status: newAttempts >= 5 ? 'expired' : approval.status,
      })
      .eq('id', approval.id);

    // Re-throw with helpful message
    if (error.message?.toLowerCase().includes('expired')) {
      throw new Error('This verification code has expired. Please request a new one.');
    }
    if (error.message?.toLowerCase().includes('invalid')) {
      throw new Error('Invalid verification code. Please check and try again.');
    }
    throw error;
  }
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

