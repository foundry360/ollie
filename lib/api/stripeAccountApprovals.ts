import { supabase } from '@/lib/supabase';

// Helper to send Stripe account approval email to parent
async function sendStripeApprovalEmail(
  parentEmail: string,
  teenName: string,
  approvalId: string
): Promise<{ success: boolean; error?: string; dashboardUrl?: string }> {
  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://localhost:8082';
  const dashboardUrl = `${webAppUrl}/parent/dashboard`;
  
  try {
    // Get session for Authorization header
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');

    // Use Supabase Edge Function with Resend
    // Explicitly pass Authorization header - functions.invoke() doesn't always include it automatically in React Native
    const { data, error } = await supabase.functions.invoke('send-stripe-approval-email', {
      body: {
        parentEmail,
        teenName,
        approvalId,
        dashboardUrl,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    // Log full response for debugging
    console.log('📧 Stripe Approval Email Edge Function response:', { 
      hasData: !!data, 
      hasError: !!error,
      dataKeys: data ? Object.keys(data) : null,
      errorType: error?.name,
      errorStatus: (error as any)?.context?.status,
    });

    // If we have data, use it (even if there's also an error)
    if (data) {
      console.log('✅ Stripe Approval Email Edge Function returned data:', data);
      if (data.success === true || data.success === false) {
        return { success: data.success, dashboardUrl: data.dashboardUrl || dashboardUrl };
      }
      return { success: true, dashboardUrl: data.dashboardUrl || dashboardUrl };
    }

    // Handle 404 specifically - function not found
    if (error && (error as any).context?.status === 404) {
      console.error('❌ Stripe Approval Email Edge Function returned 404 (Not Found)');
      console.error('Function URL attempted:', (error as any).context?.url);
      console.error('This means the function is not deployed or has a different name.');
      console.error('');
      console.error('To fix:');
      console.error('   1. Go to Supabase Dashboard → Edge Functions → Functions');
      console.error('   2. Verify the function name is exactly: send-stripe-approval-email');
      console.error('   3. Deploy the function: supabase functions deploy send-stripe-approval-email');
      
      return { 
        success: false, 
        error: 'Edge Function not found (404). Check function name matches exactly.',
        dashboardUrl,
      };
    }

    if (error) {
      console.error('❌ Error calling Stripe approval email function:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        dashboardUrl,
      };
    }

    // If we get here with no data and no error, something unexpected happened
    console.warn('⚠️ Stripe Approval Email Edge Function returned no data and no error');
    return { success: false, error: 'No response from Edge Function', dashboardUrl };
  } catch (error: any) {
    console.error('❌ Exception calling Stripe Approval Email Edge Function:', error);
    return { 
      success: false, 
      error: error?.message || String(error),
      dashboardUrl,
    };
  }
}

export interface StripeAccountApproval {
  id: string;
  teen_id: string;
  parent_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  created_at: string;
  updated_at: string;
  teen_name?: string;
  teen_email?: string;
}

// Check if teen needs parent approval (under 18 and has parent)
export async function needsParentApprovalForStripe(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: profile, error } = await supabase
    .from('users')
    .select('date_of_birth, parent_id, role')
    .eq('id', user.id)
    .single();

  if (error || !profile) throw error || new Error('User profile not found');

  // Only teens need approval
  if (profile.role !== 'teen') return false;

  // If no parent, no approval needed
  if (!profile.parent_id) return false;

  // If no birthdate, assume approval needed (better safe than sorry)
  if (!profile.date_of_birth) return true;

  // Calculate age
  const birthDate = new Date(profile.date_of_birth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Under 18 needs approval
  return age < 18;
}

// Get Stripe account approval status for current user (teen)
export async function getStripeAccountApprovalStatus(): Promise<StripeAccountApproval | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('stripe_account_approvals')
    .select('*')
    .eq('teen_id', user.id)
    .single();

  if (error) {
    // If no approval record exists, return null (not an error)
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

// Request parent approval for Stripe account
export async function requestStripeAccountApproval(): Promise<StripeAccountApproval> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get user profile to find parent
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('parent_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw profileError || new Error('User profile not found');
  }

  if (profile.role !== 'teen') {
    throw new Error('Only teens can request Stripe account approval');
  }

  if (!profile.parent_id) {
    throw new Error('No parent linked to account');
  }

  // Check if approval already exists
  const existing = await getStripeAccountApprovalStatus();
  if (existing) {
    // If already approved, return existing
    if (existing.status === 'approved') {
      return existing;
    }
    // If pending or rejected, update to pending
    const { data, error } = await supabase
      .from('stripe_account_approvals')
      .update({ status: 'pending', reason: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    // Send email to parent if updating (don't block if email fails)
    try {
      // Get teen's name and parent's email
      const { data: teenProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: parentProfile } = await supabase
        .from('users')
        .select('email')
        .eq('id', profile.parent_id)
        .single();

      if (parentProfile?.email && teenProfile?.full_name) {
        await sendStripeApprovalEmail(
          parentProfile.email,
          teenProfile.full_name,
          data.id
        );
      }
    } catch (emailError) {
      // Log but don't throw - approval request was updated successfully
      console.error('Failed to send Stripe approval email:', emailError);
    }

    return data;
  }

  // Get teen's name for the email
  const { data: teenProfile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Create new approval request
  const { data, error } = await supabase
    .from('stripe_account_approvals')
    .insert({
      teen_id: user.id,
      parent_id: profile.parent_id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Send email to parent (don't block if email fails)
  try {
    // Get parent email
    const { data: parentProfile } = await supabase
      .from('users')
      .select('email')
      .eq('id', profile.parent_id)
      .single();

    if (parentProfile?.email && teenProfile?.full_name) {
      await sendStripeApprovalEmail(
        parentProfile.email,
        teenProfile.full_name,
        data.id
      );
    }
  } catch (emailError) {
    // Log but don't throw - approval request was created successfully
    console.error('Failed to send Stripe approval email:', emailError);
  }

  return data;
}

// Get all Stripe account approvals for a parent
export async function getStripeAccountApprovalsForParent(): Promise<StripeAccountApproval[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('stripe_account_approvals')
    .select(`
      *,
      teen:users!stripe_account_approvals_teen_id_fkey(id, full_name, email)
    `)
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any): StripeAccountApproval => ({
    id: item.id,
    teen_id: item.teen_id,
    parent_id: item.parent_id,
    status: item.status,
    reason: item.reason,
    created_at: item.created_at,
    updated_at: item.updated_at,
    teen_name: item.teen?.full_name || 'Unknown',
    teen_email: item.teen?.email || '',
  }));
}

// Get pending Stripe account approvals for a parent
export async function getPendingStripeAccountApprovals(): Promise<StripeAccountApproval[]> {
  const approvals = await getStripeAccountApprovalsForParent();
  return approvals.filter(a => a.status === 'pending');
}

// Approve Stripe account setup
export async function approveStripeAccount(approvalId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('stripe_account_approvals')
    .update({ status: 'approved' })
    .eq('id', approvalId)
    .eq('parent_id', user.id);

  if (error) throw error;
}

// Reject Stripe account setup
export async function rejectStripeAccount(approvalId: string, reason?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('stripe_account_approvals')
    .update({ status: 'rejected', reason })
    .eq('id', approvalId)
    .eq('parent_id', user.id);

  if (error) throw error;
}

