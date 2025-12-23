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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/twilio.ts:41',message:'getOrCreateConversation called',data:{gigId,participant1Id,participant2Id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const { data: { session } } = await supabase.auth.getSession();
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/twilio.ts:45',message:'Session check',data:{hasSession:!!session,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length || 0,tokenPrefix:session?.access_token?.substring(0,20) || 'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  if (!session) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/twilio.ts:49',message:'ERROR: No session',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw new Error('Not authenticated');
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/twilio.ts:53',message:'Making request to manage-twilio-conversation',data:{url:`${SUPABASE_URL}/functions/v1/manage-twilio-conversation`,hasToken:!!session.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/twilio.ts:65',message:'Response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

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

  console.log('[DEBUG] Calling sync-twilio-messages:', { conversationSid, gigId });
  
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
    console.error('[DEBUG] Sync response not JSON:', responseText);
    throw new Error(`Failed to sync messages: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    console.error('[DEBUG] Sync failed:', {
      status: response.status,
      statusText: response.statusText,
      error: responseData
    });
    throw new Error(responseData.error || responseData.message || 'Failed to sync messages');
  }

  console.log('[DEBUG] Sync response:', responseData);
  return responseData;
}
