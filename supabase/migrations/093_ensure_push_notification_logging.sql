-- Migration: Ensure push notification function has proper logging
-- This applies the improved logging from migration 086 if not already applied

CREATE OR REPLACE FUNCTION send_push_notification(
  p_recipient_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB,
  p_priority TEXT DEFAULT 'default',
  p_badge INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  RAISE NOTICE '[send_push_notification] Called for recipient % with title: %', p_recipient_id, p_title;
  
  -- Get Supabase configuration from config table
  SELECT supabase_url, service_role_key INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default'
  LIMIT 1;
  
  -- Skip if not configured
  IF v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
    RAISE WARNING '[send_push_notification] Push notification config not set. Update public.push_notification_config table.';
    RETURN;
  END IF;
  
  IF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RAISE WARNING '[send_push_notification] Push notification service_role_key not configured properly.';
    RETURN;
  END IF;
  
  -- Construct Edge Function URL
  v_function_url := v_config.supabase_url || '/functions/v1/send-push-notification';
  
  RAISE NOTICE '[send_push_notification] Sending notification to user % via %', p_recipient_id, v_function_url;
  
  -- Call Edge Function asynchronously
  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_config.service_role_key,
        'apikey', v_config.service_role_key
      ),
      body := jsonb_build_object(
        'recipient_id', p_recipient_id,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'priority', p_priority,
        'badge', p_badge
      )
    ) INTO v_response_id;
    
    RAISE NOTICE '[send_push_notification] Request sent successfully. Request ID: %', v_response_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[send_push_notification] Error calling net.http_post: %', SQLERRM;
      RAISE WARNING '[send_push_notification] Error details: %', SQLSTATE;
      -- Don't re-raise, just log the error
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[send_push_notification] Unexpected error: %', SQLERRM;
    RAISE WARNING '[send_push_notification] Error state: %', SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




















