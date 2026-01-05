-- ============================================================================
-- Push Notifications Setup Script
-- Run this in your Supabase SQL Editor to configure push notifications
-- ============================================================================

-- Step 1: Update the configuration table with your Supabase project URL and service role key
-- Replace the placeholders with your actual values:
--   - 'https://your-project.supabase.co' → Your Supabase URL (from Dashboard → Settings → API → Project URL)
--   - 'your-service-role-key' → Your service role key (from Dashboard → Settings → API → service_role key)
-- ⚠️ WARNING: Keep the service role key secret! Never commit it to git.

UPDATE public.push_notification_config
SET 
  supabase_url = 'https://your-project.supabase.co',
  service_role_key = 'your-service-role-key',
  updated_at = NOW()
WHERE id = 'default';

-- If the config doesn't exist yet, insert it:
INSERT INTO public.push_notification_config (id, supabase_url, service_role_key)
VALUES (
  'default',
  'https://your-project.supabase.co',
  'your-service-role-key'
)
ON CONFLICT (id) DO UPDATE
SET 
  supabase_url = EXCLUDED.supabase_url,
  service_role_key = EXCLUDED.service_role_key,
  updated_at = NOW();

-- Step 2: Verify the settings were applied
SELECT 
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
    THEN '✓ Configured (hidden for security)'
    ELSE '✗ Not configured - please update the values above'
  END as service_role_key_status,
  updated_at
FROM public.push_notification_config
WHERE id = 'default';

-- Step 4: Verify triggers are created
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%' OR trigger_name LIKE '%push%'
ORDER BY event_object_table, trigger_name;

-- Step 5: Verify functions are created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%notify%' OR routine_name LIKE 'send_push_notification')
ORDER BY routine_name;

-- ============================================================================
-- Test Queries (Optional - for verification)
-- ============================================================================

-- Check if users have push tokens
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN expo_push_token IS NOT NULL THEN '✓ Has token'
    ELSE '✗ No token'
  END as push_token_status
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- Check recent gigs that could trigger notifications
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

