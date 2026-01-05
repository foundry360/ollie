-- Test Push Notifications Setup
-- Run these queries to verify and test your push notification setup

-- ============================================================================
-- 1. Verify Configuration
-- ============================================================================
SELECT 
  id,
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
    THEN '✓ Configured'
    ELSE '✗ Not configured'
  END as key_status,
  updated_at
FROM public.push_notification_config
WHERE id = 'default';

-- ============================================================================
-- 2. Check Users with Push Tokens
-- ============================================================================
-- See which users have registered for push notifications
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN expo_push_token IS NOT NULL THEN '✓ Has token'
    ELSE '✗ No token'
  END as push_token_status,
  created_at
FROM public.users
WHERE expo_push_token IS NOT NULL
ORDER BY created_at DESC;

-- ============================================================================
-- 3. Verify Triggers Exist
-- ============================================================================
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%' OR trigger_name LIKE '%push%'
ORDER BY event_object_table, trigger_name;

-- You should see 9 triggers:
-- - on_gig_accepted_notify
-- - on_gig_started_notify
-- - on_gig_completed_notify
-- - on_gig_cancelled_notify
-- - on_parent_approval_needed_notify
-- - on_parent_approved_notify
-- - on_parent_rejected_notify
-- - on_new_message_notify
-- - on_payment_received_notify

-- ============================================================================
-- 4. Verify Functions Exist
-- ============================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%notify%' OR routine_name = 'send_push_notification')
ORDER BY routine_name;

-- ============================================================================
-- 5. Test Notification (Manual Test)
-- ============================================================================
-- Replace the UUIDs with actual IDs from your database
-- This will send a test notification to a user

-- First, get a user ID and their push token:
-- SELECT id, full_name, expo_push_token FROM public.users WHERE expo_push_token IS NOT NULL LIMIT 1;

-- Then test by creating a message (this will trigger the notification):
/*
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES (
  'gig-id-here',           -- Replace with actual gig ID
  'sender-user-id-here',   -- Replace with actual sender user ID
  'recipient-user-id-here', -- Replace with actual recipient user ID (must have push token)
  'Test notification message!'
);
*/

-- ============================================================================
-- 6. Check Recent Gigs (for testing gig notifications)
-- ============================================================================
SELECT 
  id,
  title,
  status,
  poster_id,
  teen_id,
  created_at
FROM public.gigs
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 7. Check Edge Function Logs
-- ============================================================================
-- Go to: Supabase Dashboard → Edge Functions → send-push-notification → Logs
-- After triggering a notification, check the logs for any errors

