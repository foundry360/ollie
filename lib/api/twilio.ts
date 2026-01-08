import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export interface TwilioTokenResponse {
  token: string;
  identity: string;
  serviceSid: string;
}

export interface ConversationResponse {
  conversation_sid: string;
  friendly_name: string;
}

// Get Twilio access token
export async function getTwilioAccessToken(): Promise<TwilioTokenResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-twilio-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get Twilio token');
  }

  return response.json();
}

// Get or create Twilio conversation
export async function getOrCreateConversation(
  gigId: string,
  participant1Id: string,
  participant2Id: string
): Promise<ConversationResponse> {
  
  const { data: { session } } = await supabase.auth.getSession();
  
  
  if (!session) {
    throw new Error('Not authenticated');
  }


  const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-twilio-conversation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gig_id: gigId,
      participant1_id: participant1Id,
      participant2_id: participant2Id,
    }),
  });
  

  if (!response.ok) {
    let errorMessage = 'Failed to get/create conversation';
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || JSON.stringify(error);
      console.error('manage-twilio-conversation error:', error);
    } catch (e) {
      const text = await response.text();
      errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
      console.error('manage-twilio-conversation error (non-JSON):', text);
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Sync messages from Twilio to Supabase (manual sync when webhook fails)
export async function syncTwilioMessages(
  conversationSid: string,
  gigId: string
): Promise<{ synced: number; skipped: number; total: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-twilio-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_sid: conversationSid,
      gig_id: gigId,
    }),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    console.error('Sync response not JSON:', responseText);
    throw new Error(`Failed to sync messages: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    console.error('Sync failed:', {
      status: response.status,
      statusText: response.statusText,
      error: responseData
    });
    throw new Error(responseData.error || responseData.message || 'Failed to sync messages');
  }

  return responseData;
}
