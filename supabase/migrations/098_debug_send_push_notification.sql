-- Migration: Add comprehensive debugging to send_push_notification
-- This will log exactly what parameters are being passed to the Edge Function

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
  v_request_body JSONB;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '[send_push_notification] FUNCTION CALLED';
  RAISE NOTICE 'p_recipient_id: %', p_recipient_id;
  RAISE NOTICE 'p_title: %', p_title;
  RAISE NOTICE 'p_body: %', p_body;
  RAISE NOTICE 'p_data: %', p_data;
  RAISE NOTICE 'p_priority: %', p_priority;
  RAISE NOTICE 'p_data.recipient_role: %', p_data->>'recipient_role';
  RAISE NOTICE '========================================';
  
  -- Log to table for easier access
  INSERT INTO public.debug_logs (function_name, message, data)
  VALUES (
    'send_push_notification',
    'FUNCTION CALLED',
    jsonb_build_object(
      'p_recipient_id', p_recipient_id,
      'p_title', p_title,
      'p_body', p_body,
      'p_data', p_data,
      'p_data_recipient_role', p_data->>'recipient_role',
      'p_priority', p_priority
    )
  );
  
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
  
  -- Build request body
  v_request_body := jsonb_build_object(
    'recipient_id', p_recipient_id,
    'title', p_title,
    'body', p_body,
    'data', p_data,
    'priority', p_priority,
    'badge', p_badge
  );
  
  RAISE NOTICE '[send_push_notification] Request body being sent:';
  RAISE NOTICE '  recipient_id: %', v_request_body->>'recipient_id';
  RAISE NOTICE '  title: %', v_request_body->>'title';
  RAISE NOTICE '  body: %', v_request_body->>'body';
  RAISE NOTICE '  data.recipient_role: %', v_request_body->'data'->>'recipient_role';
  RAISE NOTICE '[send_push_notification] Sending to Edge Function: %', v_function_url;
  
  -- Log request body to table
  INSERT INTO public.debug_logs (function_name, message, data)
  VALUES (
    'send_push_notification',
    'SENDING TO EDGE FUNCTION',
    jsonb_build_object(
      'request_body_recipient_id', v_request_body->>'recipient_id',
      'request_body_title', v_request_body->>'title',
      'request_body_body', v_request_body->>'body',
      'request_body_data_recipient_role', v_request_body->'data'->>'recipient_role',
      'function_url', v_function_url
    )
  );
  
  -- Call Edge Function asynchronously
  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_config.service_role_key,
        'apikey', v_config.service_role_key
      ),
      body := v_request_body
    ) INTO v_response_id;
    
    RAISE NOTICE '[send_push_notification] Request sent successfully. Request ID: %', v_response_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[send_push_notification] Error calling net.http_post: %', SQLERRM;
      RAISE WARNING '[send_push_notification] Error details: %', SQLSTATE;
      -- Don't re-raise, just log the error
  END;
  
  RAISE NOTICE '[send_push_notification] FUNCTION COMPLETED';
  RAISE NOTICE '========================================';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[send_push_notification] Unexpected error: %', SQLERRM;
    RAISE WARNING '[send_push_notification] Error state: %', SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

