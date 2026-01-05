-- Debug Push Notifications
-- Run these queries to diagnose why notifications aren't working

-- ============================================================================
-- 1. Verify Configuration
-- ============================================================================
SELECT 
  id,
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL 
      AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
      AND LENGTH(service_role_key) > 20
    THEN '✓ Configured (' || LENGTH(service_role_key) || ' chars)'
    ELSE '✗ Not configured properly'
  END as key_status,
  updated_at
FROM public.push_notification_config
WHERE id = 'default';

-- ============================================================================
-- 2. Test the send_push_notification function directly
-- ============================================================================
-- Replace with a real user ID that has a push token
-- This will test if the function can call the Edge Function
/*
DO $$
DECLARE
  v_test_user_id UUID := 'user-id-with-push-token-here';
BEGIN
  PERFORM send_push_notification(
    p_recipient_id := v_test_user_id,
    p_title := 'Direct Function Test',
    p_body := 'Testing the function directly',
    p_data := '{"type": "test"}'::JSONB,
    p_priority := 'high'
  );
  RAISE NOTICE 'Function called - check Edge Function logs';
END $$;
*/

-- ============================================================================
-- 3. Check if triggers are enabled and exist
-- ============================================================================
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%' OR trigger_name LIKE '%push%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 4. Check if the function exists and is accessible
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'send_push_notification';

-- ============================================================================
-- 5. Test trigger manually by inserting a message
-- ============================================================================
-- First, get a user with a push token and a gig ID
/*
SELECT 
  u.id as user_id,
  u.full_name,
  u.expo_push_token IS NOT NULL as has_token,
  g.id as gig_id,
  g.title
FROM public.users u
CROSS JOIN public.gigs g
WHERE u.expo_push_token IS NOT NULL
  AND g.status IN ('open', 'accepted')
LIMIT 1;
*/

-- Then test by creating a message (this should trigger the notification)
-- Replace with actual IDs from the query above
/*
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES (
  'gig-id-here',
  'sender-id-here',
  'recipient-id-here',
  'Test notification trigger'
);
*/

-- ============================================================================
-- 6. Check pg_net extension is enabled
-- ============================================================================
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname = 'pg_net';

-- ============================================================================
-- 7. Check recent messages to see if triggers fired
-- ============================================================================
SELECT 
  id,
  gig_id,
  sender_id,
  recipient_id,
  content,
  created_at
FROM public.messages
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 8. Check for any errors in function execution
-- ============================================================================
-- Enable more verbose logging temporarily
SET client_min_messages TO NOTICE;

-- Then try to trigger a notification and watch for NOTICE messages
-- The function uses RAISE NOTICE for logging

-- ============================================================================
-- 9. Verify Edge Function URL construction
-- ============================================================================
-- This will show what URL the function is trying to call
DO $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
BEGIN
  SELECT supabase_url INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default';
  
  IF v_config.supabase_url IS NOT NULL THEN
    v_function_url := v_config.supabase_url || '/functions/v1/send-push-notification';
    RAISE NOTICE 'Edge Function URL: %', v_function_url;
  ELSE
    RAISE NOTICE 'ERROR: supabase_url is NULL';
  END IF;
END $$;

