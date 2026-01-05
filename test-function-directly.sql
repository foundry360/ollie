-- Test the send_push_notification function directly
-- This bypasses triggers and tests the function itself

-- Step 1: Find a user with a push token
SELECT 
  id,
  full_name,
  role,
  expo_push_token IS NOT NULL as has_token,
  LENGTH(expo_push_token) as token_length
FROM public.users
WHERE expo_push_token IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Enable verbose logging
SET client_min_messages TO NOTICE;

-- Step 3: Test the function directly (replace with user ID from Step 1)
DO $$
DECLARE
  v_test_user_id UUID := 'REPLACE-WITH-USER-ID-FROM-STEP-1';
  v_result TEXT;
BEGIN
  RAISE NOTICE 'Testing send_push_notification function...';
  RAISE NOTICE 'User ID: %', v_test_user_id;
  
  -- Call the function
  PERFORM send_push_notification(
    p_recipient_id := v_test_user_id,
    p_title := 'Direct Function Test',
    p_body := 'This is a test notification from the database function',
    p_data := '{"type": "test", "source": "direct_function_call"}'::JSONB,
    p_priority := 'high'
  );
  
  RAISE NOTICE 'Function call completed. Check Edge Function logs now!';
  RAISE NOTICE 'If you see this message, the function executed without errors.';
  RAISE NOTICE 'If you see warnings above, check the configuration.';
END $$;

-- Step 4: Check what happened
-- After running the above, immediately check:
-- 1. Edge Function logs: Dashboard → Edge Functions → send-push-notification → Logs
-- 2. Look for the request in the logs
-- 3. Check if the user received a notification

-- Step 5: Verify configuration is correct
SELECT 
  id,
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL 
      AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
      AND LENGTH(service_role_key) > 20
    THEN '✓ Configured (' || LENGTH(service_role_key) || ' characters)'
    ELSE '✗ Not configured properly'
  END as key_status
FROM public.push_notification_config
WHERE id = 'default';

