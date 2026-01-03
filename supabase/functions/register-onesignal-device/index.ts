import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || '';
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') || '';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/players';

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

    const { user_id, push_token, platform, location } = await req.json();

    if (!user_id || !push_token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, push_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OneSignal credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role, location')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine device type
    const deviceType = platform === 'ios' ? 0 : 1; // 0 = iOS, 1 = Android

    // Prepare tags for location-based targeting
    const tags: Record<string, string> = {
      user_id: user_id,
      role: user.role || 'unknown',
      expo_push_token: push_token, // Store Expo token as tag for reference
    };

    // Add location tags if available
    if (location?.latitude && location?.longitude) {
      tags.location_lat = location.latitude.toString();
      tags.location_lon = location.longitude.toString();
    }

    // Register device with OneSignal
    // IMPORTANT: OneSignal REST API doesn't work with Expo push tokens directly
    // Expo tokens are not valid APN/FCM tokens that OneSignal expects
    // 
    // Solution: We'll create a player with a generated identifier based on user_id
    // This allows OneSignal to create a player, but we'll still use Expo for actual sending
    // The OneSignal player ID will be stored for potential future use
    const generatedIdentifier = `expo_${user_id}_${Date.now()}`;
    
    const playerData = {
      app_id: ONESIGNAL_APP_ID,
      device_type: deviceType,
      identifier: generatedIdentifier, // Generated identifier since Expo token isn't valid
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tags: tags,
    };

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(ONESIGNAL_REST_API_KEY + ':')}`,
      },
      body: JSON.stringify(playerData),
    });

    const result = await response.json();

    if (!response.ok || result.errors) {
      console.error('OneSignal registration error:', result);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to register device with OneSignal', 
          details: result 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save OneSignal user ID (player ID) to database
    const onesignalUserId = result.id;
    const { error: updateError } = await supabase
      .from('users')
      .update({ onesignal_user_id: onesignalUserId })
      .eq('id', user_id);

    if (updateError) {
      console.error('Error updating user with OneSignal ID:', updateError);
      // Still return success since OneSignal registration worked
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        onesignal_user_id: onesignalUserId,
        player_id: onesignalUserId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in register-onesignal-device:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

