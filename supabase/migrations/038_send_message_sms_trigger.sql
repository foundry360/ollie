-- Function to trigger SMS notification via Edge Function when a new message is received
-- This sends an SMS to the recipient using Twilio
-- Note: Requires pg_net extension to be enabled in Supabase

-- Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send SMS notification via Edge Function
CREATE OR REPLACE FUNCTION send_message_sms_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_function_url TEXT;
  v_recipient_phone TEXT;
  v_sender_name TEXT;
  v_gig_title TEXT;
  v_request_body JSONB;
  v_response_id BIGINT;
BEGIN
  -- Only send SMS if this is a new message (not an update)
  IF TG_OP = 'INSERT' THEN
    -- Get recipient's phone number
    SELECT phone INTO v_recipient_phone
    FROM public.users
    WHERE id = NEW.recipient_id;
    
    -- Skip if recipient doesn't have a phone number
    IF v_recipient_phone IS NULL OR v_recipient_phone = '' THEN
      RETURN NEW;
    END IF;
    
    -- Get sender's name
    SELECT full_name INTO v_sender_name
    FROM public.users
    WHERE id = NEW.sender_id;
    
    -- Get gig title (optional, for context)
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    -- Get Supabase URL and service role key from settings
    -- These should be set in Supabase Dashboard → Settings → Database → Custom Config
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    
    -- If settings are not configured, log and return (don't fail message insert)
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      RAISE NOTICE 'Supabase URL not configured. SMS will not be sent.';
      RAISE NOTICE 'To configure: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://your-project.supabase.co'';';
      RETURN NEW;
    END IF;
    
    -- Construct Edge Function URL
    v_function_url := v_supabase_url || '/functions/v1/send-message-sms';
    
    -- Prepare request body
    v_request_body := jsonb_build_object(
      'recipient_phone', v_recipient_phone,
      'sender_name', COALESCE(v_sender_name, 'Someone'),
      'message_content', NEW.content,
      'gig_title', v_gig_title
    );
    
    -- Call the Edge Function using pg_net (async, non-blocking)
    -- Note: net.http_post returns a request ID, the actual HTTP call happens asynchronously
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
      ),
      body := v_request_body
    ) INTO v_response_id;
    
    -- Log the response (optional, for debugging)
    -- You can check Edge Function logs in Supabase Dashboard
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Error sending SMS notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to send SMS when a new message is inserted
DROP TRIGGER IF EXISTS on_message_insert_send_sms ON public.messages;
CREATE TRIGGER on_message_insert_send_sms
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION send_message_sms_notification();

-- Instructions:
-- 1. Deploy the Edge Function: supabase functions deploy send-message-sms
-- 2. Set Edge Function secrets:
--    - TWILIO_ACCOUNT_SID
--    - TWILIO_AUTH_TOKEN
--    - TWILIO_PHONE_NUMBER
-- 3. Set database settings:
--    - ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--    - ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
-- 4. Test by sending a message - recipient should receive SMS if they have a phone number







