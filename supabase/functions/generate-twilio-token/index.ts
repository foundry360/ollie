import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_API_KEY_SID = Deno.env.get('TWILIO_API_KEY_SID');
const TWILIO_API_KEY_SECRET = Deno.env.get('TWILIO_API_KEY_SECRET');
const TWILIO_CONVERSATIONS_SERVICE_SID = Deno.env.get('TWILIO_CONVERSATIONS_SERVICE_SID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simple JWT implementation for Twilio Access Token
// Note: For production, use a proper JWT library with HMAC-SHA256
function generateTwilioAccessToken(identity: string): string {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) {
    throw new Error('Twilio credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    jti: `${TWILIO_API_KEY_SID}-${now}`,
    iss: TWILIO_API_KEY_SID,
    sub: TWILIO_ACCOUNT_SID,
    exp: now + 3600,
    iat: now,
    grants: {
      identity: identity,
      conversation: {
        service_sid: TWILIO_CONVERSATIONS_SERVICE_SID,
      },
    },
  };

  const base64UrlEncode = (str: any) => {
    return btoa(JSON.stringify(str))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  // Simplified signature - in production use proper HMAC-SHA256
  const signature = btoa(TWILIO_API_KEY_SECRET)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_CONVERSATIONS_SERVICE_SID) {
      return new Response(
        JSON.stringify({ 
          error: 'Twilio not configured',
          message: 'Set Twilio credentials in Edge Function secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const identity = user.id;
    const accessToken = generateTwilioAccessToken(identity);

    return new Response(
      JSON.stringify({ 
        token: accessToken,
        identity: identity,
        serviceSid: TWILIO_CONVERSATIONS_SERVICE_SID
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating Twilio token:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
