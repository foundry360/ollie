import { supabase } from '@/lib/supabase';

export interface ParentApproval {
  id: string;
  teen_id: string;
  gig_id: string;
  task_title: string;
  parent_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  created_at: string;
  updated_at: string;
}

// Get parent approvals for a parent
export async function getParentApprovals(): Promise<ParentApproval[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('parent_approvals')
    .select(`
      *,
      task:tasks!inner(id, title)
    `)
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    teen_id: item.teen_id,
    gig_id: item.gig_id,
    task_title: item.task?.title || 'Unknown Task',
    parent_id: item.parent_id,
    status: item.status,
    reason: item.reason,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

// Get pending approvals for a parent
export async function getPendingApprovals(): Promise<ParentApproval[]> {
  const approvals = await getParentApprovals();
  return approvals.filter(a => a.status === 'pending');
}

// Approve a task
export async function approveTask(approvalId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('parent_approvals')
    .update({ status: 'approved' })
    .eq('id', approvalId)
    .eq('parent_id', user.id);

  if (error) throw error;
}

// Reject a task
export async function rejectTask(approvalId: string, reason?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('parent_approvals')
    .update({ status: 'rejected', reason })
    .eq('id', approvalId)
    .eq('parent_id', user.id);

  if (error) throw error;
}

