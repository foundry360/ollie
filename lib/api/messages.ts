import { supabase } from '@/lib/supabase';
import { Message } from '@/types';

export interface CreateMessageData {
  gig_id: string;
  recipient_id: string;
  content: string;
  sender_id?: string; // Optional - if provided, skip getUser() call
}

// Track a deleted message to prevent sync from re-inserting it
export async function trackDeletedMessage(twilioMessageSid: string): Promise<void> {
  if (!twilioMessageSid) return;
  
  try {
    const { error } = await supabase
      .from('deleted_twilio_messages')
      .insert({
        twilio_message_sid: twilioMessageSid,
        deleted_by: (await supabase.auth.getUser()).data.user?.id || null,
      })
      .select();
    
    if (error) {
      // If table doesn't exist, log but don't throw
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('deleted_twilio_messages table does not exist - run migration 041');
      } else {
        console.error('Error tracking deleted message:', error);
      }
    } else {
      console.log('✅ Tracked deleted message:', twilioMessageSid);
    }
  } catch (err: any) {
    console.error('Error tracking deleted message:', err);
  }
}

// Delete a message and track it
export async function deleteMessage(messageId: string, twilioMessageSid?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // First, get the message to check if it has a twilio_message_sid
  const { data: message } = await supabase
    .from('messages')
    .select('twilio_message_sid')
    .eq('id', messageId)
    .single();

  const sidToTrack = twilioMessageSid || message?.twilio_message_sid;

  // Delete the message
  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (deleteError) {
    throw deleteError;
  }

  // Track the deletion to prevent sync from re-inserting
  if (sidToTrack) {
    await trackDeletedMessage(sidToTrack);
  }
}

// Create a new message using database function (bypasses RLS)
export async function createMessage(data: CreateMessageData): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const senderId = data.sender_id || user.id;

  // Call database function via RPC (bypasses RLS)
  const { data: messageData, error } = await supabase.rpc('create_message', {
    p_gig_id: data.gig_id,
    p_sender_id: senderId,
    p_recipient_id: data.recipient_id,
    p_content: data.content,
  });

  if (error) {
    console.error('createMessage: Error calling function:', error);
    throw error;
  }

  if (!messageData) {
    throw new Error('Message creation failed - no message returned');
  }

  // Convert JSONB to Message object
  return messageData as Message;
}

// Get messages for a task
// If recipientId is provided, only return messages between current user and that recipient
export async function getTaskMessages(taskId: string, recipientId?: string): Promise<Message[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('gig_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  
  // If recipientId is provided, filter to only show messages between current user and that recipient
  // This allows neighbors to have separate conversations with different applicants on the same gig
  let filteredMessages = data || [];
  if (recipientId && data) {
    filteredMessages = data.filter(msg => 
      (msg.sender_id === user.id && msg.recipient_id === recipientId) ||
      (msg.sender_id === recipientId && msg.recipient_id === user.id)
    );
  }
  
  return filteredMessages;
}

// Get conversations (grouped by task)
export async function getConversations(): Promise<Array<{
  gig_id: string;
  task_title: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string | null;
  other_user_verified?: boolean;
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
      task:gigs!inner(id, title, poster_id, teen_id)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  

  // Group by task_id
  const conversationsMap = new Map<string, {
    gig_id: string;
    task_title: string;
    other_user_id: string;
    other_user_name: string;
    other_user_photo?: string | null;
    other_user_verified?: boolean;
    last_message: Message | null;
    unread_count: number;
  }>();

  // Track seen keys to prevent duplicates
  const seenKeys = new Set<string>();
  
  
  for (const msg of messages || []) {
    const task = (msg as any).task;
    if (!task) continue;

    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const key = `${task.id}-${otherUserId}`;


    // Skip if we've already processed this conversation (prevent duplicates)
    if (seenKeys.has(key)) {
      // Update existing conversation if this message is newer
      const conv = conversationsMap.get(key);
      if (conv) {
        if (!conv.last_message || new Date(msg.created_at) > new Date(conv.last_message.created_at)) {
          conv.last_message = msg;
        }
        if (msg.recipient_id === user.id && !msg.read) {
          conv.unread_count++;
        }
      }
      continue;
    }

    seenKeys.add(key);

    if (!conversationsMap.has(key)) {
      // Get other user's name, profile photo, and verified status
      const { data: otherUser } = await supabase
        .from('users')
        .select('full_name, profile_photo_url, verified')
        .eq('id', otherUserId)
        .single();

      conversationsMap.set(key, {
        gig_id: task.id,
        task_title: task.title,
        other_user_id: otherUserId,
        other_user_name: otherUser?.full_name || 'Unknown',
        other_user_photo: otherUser?.profile_photo_url || null,
        other_user_verified: otherUser?.verified || false,
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

  const conversations = Array.from(conversationsMap.values()).sort((a, b) => {
    if (!a.last_message) return 1;
    if (!b.last_message) return -1;
    return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
  });
  
  
  return conversations;
}

// Mark messages as read
export async function markMessagesAsRead(taskId: string, senderId: string): Promise<void> {
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');


  const { data, error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('gig_id', taskId)
    .eq('sender_id', senderId)
    .eq('recipient_id', user.id)
    .eq('read', false)
    .select();


  if (error) throw error;
}
