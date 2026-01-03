import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || '';
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') || '';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

// Fallback to Expo if OneSignal not configured
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const USE_ONESIGNAL = !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);

// Log OneSignal configuration status (for debugging)
console.log('[Edge Function] OneSignal config check:', {
  has_app_id: !!ONESIGNAL_APP_ID,
  app_id: ONESIGNAL_APP_ID,
  has_api_key: !!ONESIGNAL_REST_API_KEY,
  api_key_length: ONESIGNAL_REST_API_KEY?.length || 0,
  USE_ONESIGNAL
});

serve(async (req) => {
  const callId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { recipient_id, title, body, data, priority = 'default', badge } = await req.json();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:34',message:'[Edge Function] Received request',data:{recipient_id, title, body, data, priority, badge, call_id:callId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Log Edge Function call
    console.log(`[Edge Function] Call ID: ${callId}, Recipient: ${recipient_id}, Title: ${title}, Data:`, JSON.stringify(data));

    if (!recipient_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recipient's push token and OneSignal user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('expo_push_token, onesignal_user_id, full_name')
      .eq('id', recipient_id)
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:52',message:'[Edge Function] User fetched',data:{recipient_id, user_found: !!user, has_token: !!user?.expo_push_token, has_onesignal: !!user?.onesignal_user_id, use_onesignal: USE_ONESIGNAL, call_id:callId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log decision-making info
    console.log(`[Edge Function] Call ID: ${callId}, OneSignal check:`, {
      USE_ONESIGNAL,
      has_onesignal_id: !!user.onesignal_user_id,
      onesignal_user_id: user.onesignal_user_id,
      has_expo_token: !!user.expo_push_token,
      will_use: USE_ONESIGNAL && user.onesignal_user_id ? 'OneSignal' : 'Expo'
    });

    // OneSignal only - no Expo fallback
    if (USE_ONESIGNAL && user.onesignal_user_id) {
      // Send via OneSignal
      console.log(`[Edge Function] Call ID: ${callId}, Using OneSignal for user: ${recipient_id}`);
      return await sendViaOneSignal(user.onesignal_user_id, title, body, data, priority, callId);
    } else {
      // OneSignal only - skip users without OneSignal ID
      console.log(`[Edge Function] Call ID: ${callId}, Skipping notification for user: ${recipient_id} - OneSignal only (no OneSignal ID)`);
      return new Response(
        JSON.stringify({ success: false, message: 'OneSignal only - user has no OneSignal ID' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Edge Function] Call ID: ${callId}, Error after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Send notification via OneSignal
async function sendViaOneSignal(
  onesignalUserId: string,
  title: string,
  body: string,
  data: Record<string, any> | undefined,
  priority: string,
  callId: string
) {
  // Create collapse_id for duplicate prevention
  // OneSignal limit: 64 bytes max
  // Use MD5 hash of user_id + gig_id to keep it short and unique per user per gig
  let collapseId: string | undefined;
  if (data?.gig_id) {
    // Create a short hash: first 32 chars of MD5 hash of user_id + gig_id
    const hashInput = `${onesignalUserId}_${data.gig_id}`;
    // Simple hash function (since we can't use crypto in Deno easily, use a shorter format)
    // Use first 8 chars of user_id + first 8 chars of gig_id = 16 chars + "g_" = 18 chars total
    collapseId = `g_${onesignalUserId.substring(0, 8)}_${data.gig_id.substring(0, 8)}`;
  } else {
    // For non-gig notifications, use timestamp-based short ID
    collapseId = `n_${onesignalUserId.substring(0, 8)}_${Date.now().toString().slice(-8)}`;
  }
  
  // Create idempotency_key to prevent duplicates even if API is called multiple times
  // OneSignal requires idempotency_key to be a valid UUID
  // Use callId which is already a UUID and unique per API call
  const idempotencyKey = callId;
  
  const notification = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [onesignalUserId],
    headings: { en: title },
    contents: { en: body },
    data: {
      ...(data || {}),
      notification_id: callId, // Add unique notification ID for client-side deduplication
    },
    priority: priority === 'high' ? 10 : 5,
    collapse_id: collapseId, // Prevents duplicates - unique per user per gig
    idempotency_key: idempotencyKey, // Prevents duplicate API calls (must be valid UUID)
  };

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:sendViaOneSignal',message:'[Edge Function] About to send via OneSignal',data:{onesignal_user_id:onesignalUserId, call_id:callId, gig_id:data?.gig_id, collapse_id:collapseId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  console.log(`[Edge Function] Call ID: ${callId}, Sending via OneSignal to user: ${onesignalUserId}`);

  try {
    // Log authorization setup (without exposing full key)
    console.log(`[Edge Function] Call ID: ${callId}, OneSignal auth check:`, {
      has_api_key: !!ONESIGNAL_REST_API_KEY,
      api_key_length: ONESIGNAL_REST_API_KEY?.length || 0,
      api_key_prefix: ONESIGNAL_REST_API_KEY?.substring(0, 10) || 'missing'
    });

    // OneSignal REST API uses "Key" prefix, not Basic auth
    const authHeader = `Key ${ONESIGNAL_REST_API_KEY}`;
    
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:sendViaOneSignal',message:'[Edge Function] OneSignal API response',data:{response_ok: response.ok, status: response.status, result, call_id:callId, onesignal_user_id:onesignalUserId, gig_id:data?.gig_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    console.log(`[Edge Function] Call ID: ${callId}, OneSignal response status: ${response.status}, result:`, JSON.stringify(result));

    if (!response.ok || result.errors) {
      console.error(`[Edge Function] Call ID: ${callId}, OneSignal API error:`, {
        status: response.status,
        statusText: response.statusText,
        result: result,
        errors: result.errors
      });
      
      // If authorization error, log it clearly
      if (response.status === 401 || response.status === 403) {
        console.error(`[Edge Function] Call ID: ${callId}, OneSignal AUTHORIZATION ERROR - Check REST API Key`);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to send notification via OneSignal', details: result, status: response.status }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result, callId, provider: 'onesignal' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error calling OneSignal API:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Send notification via Expo (fallback)
async function sendViaExpo(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, any> | undefined,
  priority: string,
  badge: number | undefined,
  callId: string
) {
  // Create a unique notification ID based on recipient, gig_id, and type to help Expo deduplicate
  const notificationId = (data && data.gig_id)
    ? `notification_${data.gig_id}_${data.type || 'unknown'}`
    : `notification_${Date.now()}`;
  
  // Prepare notification payload
  // Use collapseKey for Android to prevent duplicate notifications
  const collapseKey = (data && data.gig_id)
    ? `notification_${data.type || 'unknown'}_${data.gig_id}`
    : `notification_${data?.type || 'unknown'}_${Date.now()}`;
  
  const notification = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: {
      ...(data || {}),
      notificationId, // Add unique ID for client-side deduplication
    },
    priority,
  };

  // Add collapseKey for Android (prevents duplicate notifications)
  if (data?.gig_id) {
    (notification as any).collapseKey = collapseKey;
  }

  if (badge !== undefined) {
    (notification as any).badge = badge;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:sendViaExpo',message:'[Edge Function] About to send via Expo',data:{expo_push_token:expoPushToken, call_id:callId, gig_id:data?.gig_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
  // #endregion

  console.log(`[Edge Function] Call ID: ${callId}, Sending via Expo to token: ${expoPushToken.substring(0, 20)}...`);
  
  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase/functions/send-push-notification/index.ts:sendViaExpo',message:'[Edge Function] Expo API response',data:{response_ok: response.ok, result, call_id:callId, gig_id:data?.gig_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    console.log(`[Edge Function] Call ID: ${callId}, Expo response:`, JSON.stringify(result));

    if (!response.ok) {
      console.error('Expo Push API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification via Expo', details: result }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if Expo returned an error in the response
    if (result.data?.status === 'error') {
      console.error('Expo Push error:', result.data);
      return new Response(
        JSON.stringify({ error: 'Expo push error', details: result.data }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result, callId, provider: 'expo' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error calling Expo API:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

