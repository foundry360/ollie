// Twilio Conversations REST API implementation for React Native
// Using REST API instead of SDK due to React Native compatibility issues
import { getOrCreateConversation, getTwilioAccessToken } from '@/lib/api/twilio';
import { supabase } from '@/lib/supabase';

export interface TwilioMessage {
  sid: string;
  index: number;
  author: string;
  body: string;
  dateCreated: Date;
  dateUpdated: Date;
  attributes: any;
}

let pollingInterval: NodeJS.Timeout | null = null;
let lastMessageIndex: number = 0;

// Get messages from Twilio Conversations REST API
export async function fetchMessages(conversationSid: string, serviceSid: string): Promise<TwilioMessage[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Fetch messages via REST API through Edge Function
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-twilio-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_sid: conversationSid,
      service_sid: serviceSid,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch messages');
  }

  const data = await response.json();
  return data.messages || [];
}

// Send message via REST API
export async function sendTwilioMessage(
  conversationSid: string,
  serviceSid: string,
  content: string,
  authorIdentity: string
): Promise<TwilioMessage> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-twilio-message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_sid: conversationSid,
      service_sid: serviceSid,
      body: content,
      author: authorIdentity,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  const data = await response.json();
  return data.message;
}

// Get or create conversation and return SID
export async function getTwilioConversationSid(
  gigId: string,
  participant1Id: string,
  participant2Id: string
): Promise<string> {
  const { conversation_sid } = await getOrCreateConversation(gigId, participant1Id, participant2Id);
  return conversation_sid;
}

// Note: Polling is now handled in the hook directly
// These functions are kept for backwards compatibility but not actively used
export function startMessagePolling(
  conversationSid: string,
  serviceSid: string,
  onNewMessages: (messages: TwilioMessage[]) => void,
  intervalMs: number = 2000
): void {
  // Implementation moved to hook
}

export function stopMessagePolling(): void {
  // Implementation moved to hook
}
