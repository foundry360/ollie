import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Verify Twilio webhook signature (optional but recommended for production)
function verifyTwilioSignature(
  url: string,
  params: string,
  signature: string
): boolean {
  if (!TWILIO_AUTH_TOKEN) return true; // Skip verification if no auth token
  
  // In production, implement proper signature verification
  // For now, we'll trust the request (you should add proper verification)
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Log ALL incoming requests for debugging
  console.log('=== WEBHOOK REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    // Get Twilio signature from headers (for verification)
    const signature = req.headers.get('X-Twilio-Signature');
    const url = req.url;

    // Try to parse as form data first (Twilio sends form-encoded data)
    let formData: FormData;
    let eventType: string | null = null;
    
    try {
      formData = await req.formData();
      eventType = formData.get('EventType') as string;
      console.log('Parsed as FormData, EventType:', eventType);
    } catch (e) {
      // If not form data, try JSON
      try {
        const json = await req.json();
        console.log('Parsed as JSON:', json);
        eventType = json.EventType || null;
      } catch (e2) {
        // Try text
        const text = await req.text();
        console.log('Parsed as text:', text);
        return new Response(
          JSON.stringify({ message: 'Webhook received but format not recognized', text: text.substring(0, 200) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('Twilio webhook received:', { eventType, hasFormData: !!formData });

    // Handle different event types
    if (eventType === 'onMessageAdded' || eventType === 'onMessageUpdated') {
      const messageSid = formData.get('MessageSid') as string;
      const conversationSid = formData.get('ConversationSid') as string;
      const author = formData.get('Author') as string;
      const body = formData.get('Body') as string;
      const index = formData.get('Index') as string;
      const dateCreated = formData.get('DateCreated') as string;

      if (!messageSid || !conversationSid || !author || !body) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get Supabase client with service role (to bypass RLS)
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Find the gig_conversation to get gig_id and participants
      const { data: gigConversation, error: convError } = await supabase
        .from('gig_conversations')
        .select('gig_id, participant1_id, participant2_id')
        .eq('twilio_conversation_sid', conversationSid)
        .single();

      if (convError || !gigConversation) {
        console.error('Conversation not found in database:', conversationSid);
        // Return 200 to prevent Twilio from retrying
        return new Response(
          JSON.stringify({ message: 'Conversation not found, skipping' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine sender and recipient
      const senderId = author; // Twilio uses user ID as identity
      const recipientId = 
        gigConversation.participant1_id === senderId
          ? gigConversation.participant2_id
          : gigConversation.participant1_id;

      // Check if message already exists (deduplication)
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('twilio_message_sid', messageSid)
        .single();

      if (existingMessage) {
        console.log('Message already exists, skipping:', messageSid);
        return new Response(
          JSON.stringify({ message: 'Message already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert message into Supabase using service role (bypasses RLS)
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          gig_id: gigConversation.gig_id,
          sender_id: senderId,
          recipient_id: recipientId,
          content: body,
          read: false,
          twilio_message_sid: messageSid,
          created_at: dateCreated || new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting message:', insertError);
        // Return 200 to prevent Twilio from retrying
        // Service role should bypass RLS, so this shouldn't happen
        return new Response(
          JSON.stringify({ 
            message: 'Message insert failed',
            error: insertError.message 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Message synced to Supabase:', message.id);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          messageId: message.id,
          twilioMessageSid: messageSid
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle other event types (typing indicators, etc.)
    return new Response(
      JSON.stringify({ message: 'Event type not handled', eventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing Twilio webhook:', error);
    // Return 200 to prevent Twilio from retrying
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});







