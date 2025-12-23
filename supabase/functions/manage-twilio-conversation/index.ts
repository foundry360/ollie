import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_CONVERSATIONS_SERVICE_SID = Deno.env.get('TWILIO_CONVERSATIONS_SERVICE_SID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // #region agent log
    console.log('=== AUTH DEBUG ===');
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    console.log('Auth header value:', authHeader ? `${authHeader.substring(0, 20)}...` : 'null');
    // #endregion
    
    if (!authHeader) {
      // #region agent log
      console.log('ERROR: No Authorization header');
      // #endregion
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // #region agent log
    console.log('Supabase URL present:', !!supabaseUrl);
    console.log('Supabase Anon Key present:', !!supabaseAnonKey);
    // #endregion
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace('Bearer ', '');
    
    // #region agent log
    console.log('Token extracted, length:', token.length);
    console.log('Token prefix:', token.substring(0, 20));
    // #endregion
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    // #region agent log
    console.log('Auth result - user present:', !!user);
    console.log('Auth result - error:', authError ? {
      message: authError.message,
      status: authError.status,
      name: authError.name
    } : 'none');
    // #endregion

    if (authError || !user) {
      // #region agent log
      console.log('AUTH FAILED - Returning 401');
      console.log('Auth error details:', JSON.stringify(authError, null, 2));
      console.log('User data:', user ? 'present' : 'null');
      // #endregion
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication',
          details: authError ? {
            message: authError.message,
            status: authError.status,
            name: authError.name
          } : 'No user returned'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // #region agent log
    console.log('AUTH SUCCESS - User ID:', user.id);
    // #endregion

    const { gig_id, participant1_id, participant2_id } = await req.json();

    if (!gig_id || !participant1_id || !participant2_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user.id !== participant1_id && user.id !== participant2_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_CONVERSATIONS_SERVICE_SID) {
      console.error('Twilio credentials missing:', {
        hasAccountSid: !!TWILIO_ACCOUNT_SID,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        hasServiceSid: !!TWILIO_CONVERSATIONS_SERVICE_SID,
      });
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const participants = [participant1_id, participant2_id].sort();
    const friendlyName = `gig-${gig_id}-${participants[0]}-${participants[1]}`;

    const searchUrl = `https://conversations.twilio.com/v1/Services/${TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations?FriendlyName=${encodeURIComponent(friendlyName)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
    });

    let conversationSid: string;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.conversations && searchData.conversations.length > 0) {
        conversationSid = searchData.conversations[0].sid;
      } else {
        const createUrl = `https://conversations.twilio.com/v1/Services/${TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            FriendlyName: friendlyName,
            UniqueName: friendlyName,
          }),
        });

        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(`Failed to create conversation: ${error.message}`);
        }

        const createData = await createResponse.json();
        conversationSid = createData.sid;
      }
    } else {
      const createUrl = `https://conversations.twilio.com/v1/Services/${TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          FriendlyName: friendlyName,
          UniqueName: friendlyName,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        let errorMessage = 'Failed to create conversation';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${createResponse.status}`;
        }
        console.error('Twilio create conversation error:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          error: errorMessage,
          accountSid: TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 4)}...` : 'missing',
        });
        throw new Error(`Failed to create conversation: ${errorMessage}`);
      }

      const createData = await createResponse.json();
      conversationSid = createData.sid;
    }

    const participantsUrl = `https://conversations.twilio.com/v1/Services/${TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationSid}/Participants`;
    
    for (const participantId of [participant1_id, participant2_id]) {
      await fetch(participantsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Identity: participantId,
        }),
      });
    }

    // Store conversation mapping in Supabase (if not exists)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      // Check if conversation SID already exists
      const { data: existingConv } = await supabaseService
        .from('gig_conversations')
        .select('*')
        .eq('twilio_conversation_sid', conversationSid)
        .single();
      
      if (existingConv) {
        // Conversation already exists, use it (this is normal - no action needed)
        // Removed verbose log - this is expected behavior
      } else {
        // Try to upsert by the composite key
        const { error: upsertError } = await supabaseService
          .from('gig_conversations')
          .upsert({
            gig_id: gig_id,
            participant1_id: participant1_id,
            participant2_id: participant2_id,
            twilio_conversation_sid: conversationSid,
          }, {
            onConflict: 'gig_id,participant1_id,participant2_id'
          });
        
        if (upsertError) {
          // If upsert fails, try to update existing record by conversation SID
          const { error: updateError } = await supabaseService
            .from('gig_conversations')
            .update({
              gig_id: gig_id,
              participant1_id: participant1_id,
              participant2_id: participant2_id,
            })
            .eq('twilio_conversation_sid', conversationSid);
          
          if (updateError) {
            console.error('Error storing/updating conversation mapping:', updateError);
            // Continue anyway - conversation exists in Twilio
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        conversation_sid: conversationSid,
        friendly_name: friendlyName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error managing conversation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
