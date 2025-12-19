import { supabase } from '@/lib/supabase';

export type ActivityType = 'task_completed' | 'payment_received' | 'review_received' | 'message_received';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  gig_id?: string;
  amount?: number;
  rating?: number;
  sender_name?: string;
}

// Get recent activity for a teen
export async function getRecentActivity(limit: number = 5): Promise<Activity[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const activities: Activity[] = [];

  // Get completed tasks
  const { data: completedTasks, error: tasksError } = await supabase
    .from('gigs')
    .select('id, title, updated_at')
    .eq('teen_id', user.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (tasksError) {
    console.error('Error fetching completed tasks:', tasksError);
    throw tasksError;
  }

  if (completedTasks && completedTasks.length > 0) {
    completedTasks.forEach(task => {
      activities.push({
        id: `task-${task.id}`,
        type: 'task_completed',
        title: 'Gig Completed',
        description: task.title,
        timestamp: task.updated_at,
        gig_id: task.id,
      });
    });
  }

  // Get paid earnings
  const { data: paidEarnings, error: earningsError } = await supabase
    .from('earnings')
    .select(`
      id,
      amount,
      paid_at,
      gig_id
    `)
    .eq('teen_id', user.id)
    .eq('status', 'paid')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (earningsError) {
    console.error('Error fetching paid earnings:', earningsError);
    // Don't throw, just continue without earnings
  } else if (paidEarnings && paidEarnings.length > 0) {
    // Fetch gig titles separately if needed, or use a simpler description
    (paidEarnings || []).forEach((earning: any) => {
      activities.push({
        id: `payment-${earning.id}`,
        type: 'payment_received',
        title: 'Payment Received',
        description: `$${parseFloat(earning.amount.toString()).toFixed(2)}`,
        timestamp: earning.paid_at,
        gig_id: earning.gig_id,
        amount: parseFloat(earning.amount.toString()),
      });
    });
  }

  // Get unread messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      id,
      created_at,
      sender_id,
      gig_id,
      sender:users!messages_sender_id_fkey(full_name)
    `)
    .eq('recipient_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    // Don't throw, just continue without messages
  } else if (messages && messages.length > 0) {
    (messages || []).forEach((msg: any) => {
      activities.push({
        id: `message-${msg.id}`,
        type: 'message_received',
        title: 'New Message',
        description: `From ${msg.sender?.full_name || 'someone'}`,
        timestamp: msg.created_at,
        gig_id: msg.gig_id,
        sender_name: msg.sender?.full_name,
      });
    });
  }

  // Note: review_received would require a reviews table
  // For now, we'll skip it or use placeholder

  // Sort by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, limit);
}





