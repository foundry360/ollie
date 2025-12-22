-- Check if the Edge Function is accessible and if pg_net requests are being processed
-- This will help diagnose why the Edge Function isn't being called

-- 1. Check the most recent HTTP requests and their responses
SELECT 
  rq.id as request_id,
  rq.url,
  rq.method,
  rq.created_at as request_created,
  r.status_code,
  r.content as response_content,
  r.created_at as response_created,
  CASE 
    WHEN r.status_code IS NULL THEN '⏳ Pending'
    WHEN r.status_code >= 200 AND r.status_code < 300 THEN '✅ Success'
    ELSE '❌ Error'
  END as status
FROM net.http_request_queue rq
LEFT JOIN net.http_response r ON r.request_id = rq.id
ORDER BY rq.id DESC 
LIMIT 5;

-- 2. Check if pg_net extension is enabled
SELECT 
  'pg_net Extension' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ Enabled'
    ELSE '❌ Not Enabled'
  END as status;

-- 3. Verify the Edge Function URL from config
SELECT 
  'Config Check' as check_type,
  id,
  supabase_url || '/functions/v1/send-parent-account-email' as function_url,
  CASE 
    WHEN service_role_key IS NULL OR service_role_key = '' OR service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' 
    THEN '❌ Service key not set'
    ELSE '✅ Service key configured'
  END as service_key_status
FROM public.parent_email_config 
WHERE id = 'default';

-- 4. Test a simple HTTP call to verify pg_net is working
-- This will call a public endpoint to verify connectivity
SELECT 
  'Connectivity Test' as test_type,
  net.http_post(
    url := 'https://httpbin.org/post',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('test', 'pg_net connectivity')
  ) as test_request_id;























