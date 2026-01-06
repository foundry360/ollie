import { supabase } from '@/lib/supabase';

export interface CompletionApproval {
  id: string;
  gig_id: string;
  poster_id: string;
  teen_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  created_at: string;
  updated_at: string;
  gig?: {
    id: string;
    title: string;
    pay: number;
  };
  teen?: {
    id: string;
    full_name: string;
  };
}

// Get pending completion approvals for a neighbor
export async function getPendingCompletionApprovals(): Promise<CompletionApproval[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  console.log('Fetching pending completion approvals for user:', user.id);

  const { data, error } = await supabase
    .from('completion_approvals')
    .select(`
      *,
      gig:gigs!completion_approvals_gig_id_fkey(id, title, pay),
      teen:users!completion_approvals_teen_id_fkey(id, full_name)
    `)
    .eq('poster_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending completion approvals:', error);
    throw error;
  }

  console.log('Found pending completion approvals:', data?.length || 0, data);
  return data || [];
}

// Get completion approval for a specific gig
export async function getCompletionApproval(gigId: string): Promise<CompletionApproval | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('completion_approvals')
    .select(`
      *,
      gig:gigs!completion_approvals_gig_id_fkey(id, title, pay),
      teen:users!completion_approvals_teen_id_fkey(id, full_name)
    `)
    .eq('gig_id', gigId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No approval record found
    }
    throw error;
  }
  return data;
}

// Approve completion
export async function approveCompletion(gigId: string): Promise<void> {
  const { data, error } = await supabase.rpc('approve_completion', {
    p_gig_id: gigId
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to approve completion');
  }
}

// Reject completion
export async function rejectCompletion(gigId: string, reason?: string): Promise<void> {
  const { data, error } = await supabase.rpc('reject_completion', {
    p_gig_id: gigId,
    p_reason: reason || null
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to reject completion');
  }
}

// Create missing completion approval (for fixing records that weren't created by trigger)
export async function createMissingCompletionApproval(gigId: string): Promise<void> {
  const { data, error } = await supabase.rpc('create_missing_completion_approval', {
    p_gig_id: gigId
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to create completion approval');
  }
}

