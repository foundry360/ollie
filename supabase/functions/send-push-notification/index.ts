import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

interface PushNotificationPayload {
  to: string; // Expo push token
  sound?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

serve(async (req) => {
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

    const requestBody = await req.json();
    const { recipient_id, title, body, data, priority = 'default', badge } = requestBody;


    console.log('[send-push-notification] Received request:', { 
      recipient_id, 
      title, 
      body,
      recipient_role: data?.recipient_role || 'unknown',
      full_data: JSON.stringify(data || {}),
      full_request: JSON.stringify(requestBody)
    });

    if (!recipient_id || !title || !body) {
      console.error('[send-push-notification] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recipient's push token
    console.log('[send-push-notification] Fetching user with ID:', recipient_id);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, expo_push_token, full_name, email')
      .eq('id', recipient_id)
      .single();

    if (userError || !user) {
      console.error('[send-push-notification] Error fetching user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }


    console.log('[send-push-notification] Found user:', {
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      has_token: !!user.expo_push_token,
      token_preview: user.expo_push_token ? user.expo_push_token.substring(0, 20) + '...' : 'none',
      expected_recipient_id: recipient_id,
      recipient_role: data?.recipient_role || 'unknown',
      body_text: body
    });

    // CRITICAL: Verify the user ID matches the recipient_id
    if (user.id !== recipient_id) {
      console.error('[send-push-notification] MISMATCH ERROR!', {
        requested_recipient_id: recipient_id,
        found_user_id: user.id,
        found_user_email: user.email,
        found_user_name: user.full_name,
        recipient_role: data?.recipient_role || 'unknown'
      });
      return new Response(
        JSON.stringify({ 
          error: 'User ID mismatch', 
          details: {
            requested: recipient_id,
            found: user.id
          }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify notification content matches recipient role
    // Check if this is a teen notification by body content
    const body_lower = body.toLowerCase();
    const is_teen_notification = body_lower.includes('you completed') || body_lower.includes('payment pending');
    const recipient_role = data?.recipient_role;
    
    // Get user's role from database to verify
    const { data: userRoleData } = await supabase
      .from('users')
      .select('role')
      .eq('id', recipient_id)
      .single();
    
    const user_role = userRoleData?.role;
    
    // CRITICAL CHECK: If body contains teen notification markers, verify it's going to a teen
    // If body contains "You completed" or "Payment pending", it should ONLY go to teens
    if (is_teen_notification) {
      // This is a teen notification - verify it's going to a teen user
      if (user_role !== 'teen') {
        console.error('[send-push-notification] CRITICAL ERROR: Teen notification being sent to non-teen user!', {
          recipient_id,
          user_role,
          recipient_role,
          body,
          title,
          user_email: user.email,
          user_name: user.full_name
        });
        return new Response(
          JSON.stringify({ 
            error: 'Notification mismatch: Teen notification sent to non-teen user',
            details: {
              recipient_id,
              user_role,
              recipient_role,
              body,
              title
            }
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Also check if recipient_role is set and matches
      if (recipient_role && recipient_role !== 'teen') {
        console.error('[send-push-notification] CRITICAL ERROR: Teen notification body but recipient_role is not "teen"!', {
          recipient_id,
          recipient_role,
          body,
          title
        });
        return new Response(
          JSON.stringify({ 
            error: 'Notification role mismatch: Teen notification body but wrong recipient_role',
            details: {
              recipient_id,
              recipient_role,
              body,
              title
            }
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // If recipient_role is 'neighbor', verify body doesn't contain teen markers
    if (recipient_role === 'neighbor' && is_teen_notification) {
      
      console.error('[send-push-notification] CRITICAL ERROR: Teen notification being sent to neighbor!', {
        recipient_id,
        recipient_role,
        body,
        title,
        user_email: user.email,
        user_name: user.full_name,
        user_role
      });
      return new Response(
        JSON.stringify({ 
          error: 'Notification role mismatch: Teen notification sent to neighbor',
          details: {
            recipient_id,
            recipient_role,
            body,
            title,
            user_role
          }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!user.expo_push_token) {
      console.log(`[send-push-notification] User ${recipient_id} does not have a push token`);
      return new Response(
        JSON.stringify({ success: false, message: 'User has no push token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push-notification] Sending to Expo push token: ${user.expo_push_token.substring(0, 20)}...`);

    // Prepare notification payload
    // CRITICAL: Include recipient_id in data so the app can filter notifications by current user
    const notification: PushNotificationPayload = {
      to: user.expo_push_token,
      sound: 'default',
      title,
      body,
      data: {
        ...(data || {}),
        recipient_id: recipient_id, // Add recipient_id so app can filter by current user
      },
      priority,
    };

    if (badge !== undefined) {
      notification.badge = badge;
    }

    console.log('[send-push-notification] Calling Expo Push API:', EXPO_PUSH_API_URL);

    // Send notification via Expo Push API
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

    console.log('[send-push-notification] Expo Push API response:', {
      status: response.status,
      ok: response.ok,
      result: JSON.stringify(result).substring(0, 200),
    });

    if (!response.ok) {
      console.error('[send-push-notification] Expo Push API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification', details: result }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if Expo returned an error in the response
    if (result.data?.status === 'error') {
      console.error('[send-push-notification] Expo Push error:', result.data);
      return new Response(
        JSON.stringify({ error: 'Expo push error', details: result.data }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-push-notification] Successfully sent notification');
    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-push-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

