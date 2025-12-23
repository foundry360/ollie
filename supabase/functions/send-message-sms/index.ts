import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

interface MessageSMSRequest {
  recipient_phone: string;
  sender_name: string;
  message_content: string;
  gig_title?: string;
}

serve(async (req) => {
  try {
    const { recipient_phone, sender_name, message_content, gig_title }: MessageSMSRequest = await req.json();

    if (!recipient_phone || !sender_name || !message_content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_phone, sender_name, message_content' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if Twilio is configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Edge Function secrets.');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Twilio not configured. SMS will not be sent.',
          note: 'Configure Twilio credentials in Edge Function secrets to enable SMS notifications.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format SMS message
    const smsBody = gig_title 
      ? `New message from ${sender_name} about "${gig_title}": ${message_content.substring(0, 100)}${message_content.length > 100 ? '...' : ''}`
      : `New message from ${sender_name}: ${message_content.substring(0, 100)}${message_content.length > 100 ? '...' : ''}`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('To', recipient_phone);
    formData.append('Body', smsBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send SMS',
          twilioError: twilioData.message || twilioData.error_message
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully:', {
      to: recipient_phone,
      messageSid: twilioData.sid,
      status: twilioData.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        status: twilioData.status
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});







