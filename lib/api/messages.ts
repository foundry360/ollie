import { supabase } from '@/lib/supabase';
import { Message } from '@/types';

export interface CreateMessageData {
  task_id: string;
  recipient_id: string;
  content: string;
}

// Create a new message
export async function createMessage(data: CreateMessageData): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      ...data,
      sender_id: user.id,
      read: false,
    })
    .select()
    .single();

  if (error) throw error;
  return message;
}

// Get messages for a task
export async function getTaskMessages(taskId: string): Promise<Message[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get conversations (grouped by task)
export async function getConversations(): Promise<Array<{
  task_id: string;
  task_title: string;
  other_user_id: string;
  other_user_name: string;
  last_message: Message | null;
  unread_count: number;
}>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get all messages where user is sender or recipient
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      *,
      task:tasks!inner(id, title, poster_id, teen_id)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group by task_id
  const conversationsMap = new Map<string, {
    task_id: string;
    task_title: string;
    other_user_id: string;
    other_user_name: string;
    last_message: Message | null;
    unread_count: number;
  }>();

  for (const msg of messages || []) {
    const task = (msg as any).task;
    if (!task) continue;

    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const key = `${task.id}-${otherUserId}`;

    if (!conversationsMap.has(key)) {
      // Get other user's name
      const { data: otherUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', otherUserId)
        .single();

      conversationsMap.set(key, {
        task_id: task.id,
        task_title: task.title,
        other_user_id: otherUserId,
        other_user_name: otherUser?.full_name || 'Unknown',
        last_message: null,
        unread_count: 0,
      });
    }

    const conv = conversationsMap.get(key)!;
    if (!conv.last_message || new Date(msg.created_at) > new Date(conv.last_message.created_at)) {
      conv.last_message = msg;
    }
    if (msg.recipient_id === user.id && !msg.read) {
      conv.unread_count++;
    }
  }

  return Array.from(conversationsMap.values()).sort((a, b) => {
    if (!a.last_message) return 1;
    if (!b.last_message) return -1;
    return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
  });
}

// Mark messages as read
export async function markMessagesAsRead(taskId: string, senderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('task_id', taskId)
    .eq('sender_id', senderId)
    .eq('recipient_id', user.id)
    .eq('read', false);

  if (error) throw error;
}

