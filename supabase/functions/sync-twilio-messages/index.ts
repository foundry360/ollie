import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_CONVERSATIONS_SERVICE_SID = Deno.env.get('TWILIO_CONVERSATIONS_SERVICE_SID');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

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

    const { conversation_sid, gig_id } = await req.json();

    if (!conversation_sid || !gig_id) {
      return new Response(
        JSON.stringify({ error: 'Missing conversation_sid or gig_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_CONVERSATIONS_SERVICE_SID) {
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch messages from Twilio
    const messagesUrl = `https://conversations.twilio.com/v1/Services/${TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversation_sid}/Messages`;
    const response = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch messages: ${error.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const twilioMessages = data.messages || [];

    // Get conversation mapping
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: gigConversation, error: convError } = await supabaseService
      .from('gig_conversations')
      .select('gig_id, participant1_id, participant2_id')
      .eq('twilio_conversation_sid', conversation_sid)
      .single();

    if (convError || !gigConversation) {
      console.error('Conversation mapping error:', {
        error: convError,
        conversation_sid,
        gig_id,
      });
      return new Response(
        JSON.stringify({ 
          error: 'Conversation mapping not found',
          details: convError?.message,
          conversation_sid,
          gig_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use gig_id from the mapping if provided, otherwise use the one from request
    const finalGigId = gigConversation.gig_id || gig_id;
    
    console.log('Syncing messages for:', {
      conversation_sid,
      gig_id: finalGigId,
      participant1: gigConversation.participant1_id,
      participant2: gigConversation.participant2_id,
      twilioMessageCount: twilioMessages.length
    });

    // Sync messages to Supabase
    let syncedCount = 0;
    let skippedCount = 0;

    for (const twilioMsg of twilioMessages) {
      // Check if message already exists
      const { data: existing } = await supabaseService
        .from('messages')
        .select('id')
        .eq('twilio_message_sid', twilioMsg.sid)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Check if this message was previously deleted
      // Use a more robust check that works even if table doesn't exist
      let isDeleted = false;
      try {
        console.log(`[SYNC] Checking if message ${twilioMsg.sid} was deleted...`);
        const { data: deletedRecords, error: deletedError } = await supabaseService
          .from('deleted_twilio_messages')
          .select('twilio_message_sid, deleted_at')
          .eq('twilio_message_sid', twilioMsg.sid)
          .limit(1);

        console.log(`[SYNC] Deleted check result for ${twilioMsg.sid}:`, {
          found: deletedRecords?.length || 0,
          error: deletedError?.code || null,
          errorMessage: deletedError?.message || null
        });

        // If we get results, message was deleted
        if (deletedRecords && deletedRecords.length > 0) {
          isDeleted = true;
          console.log(`⚠️ [SYNC] SKIPPING deleted message: ${twilioMsg.sid} (deleted at: ${deletedRecords[0].deleted_at})`);
        } else if (deletedError) {
          // Check if error is because table doesn't exist (code 42P01)
          if (deletedError.code === '42P01' || deletedError.message?.includes('does not exist')) {
            console.error('❌ [SYNC] deleted_twilio_messages table does not exist - run migration 041');
            // Continue processing - migration not run yet
          } else {
            console.error('❌ [SYNC] Error checking deleted messages:', {
              code: deletedError.code,
              message: deletedError.message,
              details: deletedError.details
            });
            // Continue processing on other errors
          }
        } else {
          console.log(`✅ [SYNC] Message ${twilioMsg.sid} not found in deleted_messages - will insert`);
        }
      } catch (deletedCheckError: any) {
        // Table might not exist yet (migration not run) - continue processing
        console.error('❌ [SYNC] Exception checking deleted messages:', {
          message: deletedCheckError.message,
          code: deletedCheckError.code,
          stack: deletedCheckError.stack?.substring(0, 200)
        });
        if (deletedCheckError.message?.includes('does not exist') || deletedCheckError.code === '42P01') {
          console.error('❌ [SYNC] deleted_twilio_messages table does not exist - run migration 041');
        }
      }

      // Skip deleted messages
      if (isDeleted) {
        skippedCount++;
        console.log(`[SYNC] Skipped deleted message ${twilioMsg.sid} - continuing to next message`);
        continue;
      }

      // Determine sender and recipient
      const senderId = twilioMsg.author;
      const recipientId = 
        gigConversation.participant1_id === senderId
          ? gigConversation.participant2_id
          : gigConversation.participant1_id;

      // Insert message
      const { data: insertedMessage, error: insertError } = await supabaseService
        .from('messages')
        .insert({
          gig_id: finalGigId,
          sender_id: senderId,
          recipient_id: recipientId,
          content: twilioMsg.body || '',
          read: false,
          twilio_message_sid: twilioMsg.sid,
          created_at: twilioMsg.date_created || new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting message:', {
          error: insertError,
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
          gig_id: finalGigId,
          sender_id: senderId,
          recipient_id: recipientId,
          twilio_message_sid: twilioMsg.sid,
          content_length: twilioMsg.body?.length || 0,
        });
        // Continue processing other messages even if one fails
      } else {
        console.log('Message inserted successfully:', {
          messageId: insertedMessage?.id,
          gig_id: finalGigId,
          sender_id: senderId,
          recipient_id: recipientId,
          twilio_message_sid: twilioMsg.sid,
        });
        syncedCount++;
      }
    }

    console.log('Sync complete:', {
      synced: syncedCount,
      skipped: skippedCount,
      total: twilioMessages.length,
      gig_id: finalGigId,
      conversation_sid
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        synced: syncedCount,
        skipped: skippedCount,
        total: twilioMessages.length,
        gig_id: finalGigId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error syncing messages:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});







