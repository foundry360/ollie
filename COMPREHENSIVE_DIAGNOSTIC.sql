-- Comprehensive diagnostic to find why Edge Function isn't being called
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Check pg_net extension status
SELECT 
  '1. pg_net Extension' as diagnostic_step,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ Enabled'
    ELSE '❌ NOT ENABLED - Run: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as status;

-- 2. Check config table
SELECT 
  '2. Config Table' as diagnostic_step,
  id,
  CASE 
    WHEN supabase_url IS NULL OR supabase_url = '' THEN '❌ Missing URL'
    WHEN supabase_url = 'YOUR_SUPABASE_URL_HERE' THEN '❌ Placeholder URL'
    ELSE '✅ URL configured'
  END as url_status,
  CASE 
    WHEN service_role_key IS NULL OR service_role_key = '' THEN '❌ Missing key'
    WHEN service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN '❌ Placeholder key'
    ELSE '✅ Key configured'
  END as key_status,
  supabase_url || '/functions/v1/send-parent-account-email' as function_url
FROM public.parent_email_config 
WHERE id = 'default';

-- 3. Check trigger exists
SELECT 
  '3. Trigger Check' as diagnostic_step,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  CASE 
    WHEN trigger_name = 'on_parent_user_created_send_email' THEN '✅ Trigger exists'
    ELSE '⚠️ Different trigger'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%parent%email%';

-- 4. Check function exists
SELECT 
  '4. Function Check' as diagnostic_step,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name = 'send_parent_account_welcome_email' THEN '✅ Function exists'
    ELSE '⚠️ Different function'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'send_parent_account_welcome_email';

-- 5. Check recent HTTP requests and responses
SELECT 
  '5. Recent HTTP Requests' as diagnostic_step,
  rq.id as request_id,
  rq.url,
  rq.method,
  rq.created_at as queued_at,
  r.status_code,
  r.content::text as response_preview,
  r.created_at as responded_at,
  CASE 
    WHEN r.status_code IS NULL THEN '⏳ Still pending'
    WHEN r.status_code >= 200 AND r.status_code < 300 THEN '✅ Success'
    WHEN r.status_code >= 400 AND r.status_code < 500 THEN '❌ Client error'
    WHEN r.status_code >= 500 THEN '❌ Server error'
    ELSE '⚠️ Unknown status'
  END as status
FROM net.http_request_queue rq
LEFT JOIN net.http_response r ON r.request_id = rq.id
WHERE rq.url LIKE '%send-parent-account-email%'
ORDER BY rq.id DESC 
LIMIT 5;

-- 6. Check if there are any parent users with temp passwords
SELECT 
  '6. Parent Users with Temp Passwords' as diagnostic_step,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Found parent users'
    ELSE '⚠️ No parent users found'
  END as status
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.role = 'parent'
  AND (au.raw_user_meta_data->>'temp_password')::TEXT IS NOT NULL
  AND (au.raw_user_meta_data->>'temp_password')::TEXT != '';

-- 7. Test pg_net connectivity with a simple public endpoint
SELECT 
  '7. pg_net Connectivity Test' as diagnostic_step,
  net.http_post(
    url := 'https://httpbin.org/post',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('test', 'connectivity', 'timestamp', NOW()::text)
  ) as test_request_id,
  '⏳ Check http_response table in a few seconds' as note;





















