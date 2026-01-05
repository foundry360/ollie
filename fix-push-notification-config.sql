-- Fix push_notification_config table - ensure only one row exists
-- This script will clean up duplicate rows and keep only the 'default' row

-- Step 1: See what rows exist
SELECT id, supabase_url, 
       CASE 
         WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
         THEN '✓ Configured'
         ELSE '✗ Not configured'
       END as key_status,
       updated_at
FROM public.push_notification_config
ORDER BY updated_at DESC;

-- Step 2: Delete all rows except the most recent one (or the one with 'default' id)
-- Option A: Keep only the 'default' row, delete others
DELETE FROM public.push_notification_config
WHERE id != 'default';

-- If 'default' doesn't exist, we'll need to create it
-- First, let's see if 'default' exists:
-- SELECT COUNT(*) FROM public.push_notification_config WHERE id = 'default';

-- Step 3: If no 'default' row exists, create it from the most recent row
-- (Uncomment and run if needed)
/*
INSERT INTO public.push_notification_config (id, supabase_url, service_role_key)
SELECT 'default', supabase_url, service_role_key
FROM public.push_notification_config
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;
*/

-- Step 4: Delete all non-default rows
DELETE FROM public.push_notification_config
WHERE id != 'default';

-- Step 5: Verify only one row exists
SELECT 
  id,
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
    THEN '✓ Configured'
    ELSE '✗ Not configured - please update'
  END as key_status,
  updated_at
FROM public.push_notification_config;

-- Step 6: Update the default row with your actual values
-- (Replace the placeholders with your actual values)
UPDATE public.push_notification_config
SET 
  supabase_url = 'https://your-project.supabase.co',
  service_role_key = 'your-service-role-key',
  updated_at = NOW()
WHERE id = 'default';

