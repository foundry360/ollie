import { supabase } from '@/lib/supabase';
import type { StripeAccount, PaymentMethod } from '@/types';

// ============================================
// Stripe Account Functions (for Teenlancers)
// ============================================

/**
 * Create a Stripe Connect account for the current user (Teenlancer)
 * Returns the account and onboarding URL
 */
export async function createStripeAccount(): Promise<{
  account: StripeAccount;
  onboarding_url: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('create-stripe-account', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    // Try to extract more details from the error
    const errorMessage = error.message || 'Unknown error';
    const errorDetails = (error as any).context?.message || (error as any).details;
    throw new Error(errorDetails || errorMessage);
  }
  
  if (!data) {
    throw new Error('No response from server');
  }
  
  if (data.error) {
    console.error('Function returned error:', data);
    throw new Error(data.error || 'Failed to create Stripe account');
  }
  
  if (!data?.account || !data?.onboarding_url) {
    console.error('Missing data in response:', data);
    throw new Error(data?.error || 'Failed to create Stripe account - missing account or onboarding URL');
  }

  return {
    account: data.account,
    onboarding_url: data.onboarding_url,
  };
}

/**
 * Get Stripe account status for the current user
 */
export async function getStripeAccountStatus(): Promise<StripeAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Account doesn't exist yet
    }
    throw error;
  }

  return data;
}

/**
 * Delete Stripe account for the current user
 */
export async function deleteStripeAccount(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('delete-stripe-account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge Function error:', error);
    throw new Error(error.message || 'Failed to delete Stripe account');
  }
  
  if (data?.error) {
    throw new Error(data.error);
  }
}

/**
 * Get Stripe onboarding link for the current user
 */
export async function getOnboardingLink(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Check if account exists
  const account = await getStripeAccountStatus();
  
  if (!account) {
    // Create account first
    const { onboarding_url } = await createStripeAccount();
    return onboarding_url;
  }

  // Get new onboarding link for existing account
  // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
  const { data, error } = await supabase.functions.invoke('create-stripe-account', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.onboarding_url) {
    throw new Error('Failed to get onboarding link');
  }

  return data.onboarding_url;
}

/**
 * Refresh Stripe account status from Stripe API
 * This is useful after the user returns from Stripe onboarding
 */
export async function refreshStripeAccountStatus(): Promise<StripeAccount> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Calling create-stripe-account will refresh the status if account exists
  const { data, error } = await supabase.functions.invoke('create-stripe-account', {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.account) {
    throw new Error('No account found');
  }

  return data.account;
}

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

