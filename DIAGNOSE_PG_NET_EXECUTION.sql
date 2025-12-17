-- Diagnose why pg_net requests are queued but not executing
-- This will check if requests are being processed and what errors might be occurring

-- 1. Check if pg_net worker is running
SELECT 
  '1. pg_net Worker Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Worker is running (PID: ' || string_agg(pid::text, ', ') || ')'
    ELSE '❌ Worker is NOT running - Run: SELECT net.worker_restart();'
  END as status
FROM pg_stat_activity 
WHERE backend_type ILIKE '%pg_net%';

-- 2. Check the response for request ID 5 (from manual test)
SELECT 
  '2. Request #5 Response' as check_type,
  5 as request_id,
  (SELECT url FROM net.http_request_queue WHERE id = 5) as url,
  CASE 
    WHEN EXISTS (SELECT 1 FROM net.http_request_queue WHERE id = 5) THEN '✅ Request found in queue'
    ELSE '❌ Request not found'
  END as queue_status;

-- 3. Get response using http_collect_response function
SELECT 
  '3. Response for Request #5' as check_type,
  status_code,
  LEFT(content::text, 500) as response_preview,
  CASE 
    WHEN status_code IS NULL THEN '⏳ Still processing (wait a few seconds and check again)'
    WHEN status_code = 200 THEN '✅ Success - Check response_preview for details'
    WHEN status_code >= 400 THEN '❌ HTTP Error ' || status_code || ' - Check response_preview'
    ELSE '⚠️ Unknown status'
  END as status
FROM net.http_collect_response(5);

-- 4. Check all recent requests (just queue info)
SELECT 
  '4. Recent Requests in Queue' as check_type,
  id,
  url,
  method,
  'Check Edge Function logs for response details' as note
FROM net.http_request_queue
WHERE url LIKE '%send-parent-account-email%'
ORDER BY id DESC 
LIMIT 10;

-- 5. Verify the Edge Function URL format matches what's expected
SELECT 
  'URL Verification' as check_type,
  c.supabase_url || '/functions/v1/send-parent-account-email' as constructed_url,
  CASE 
    WHEN c.supabase_url LIKE 'https://%' THEN '✅ HTTPS URL'
    WHEN c.supabase_url LIKE 'http://%' THEN '⚠️ HTTP URL (should be HTTPS)'
    ELSE '❌ Invalid URL format'
  END as url_status
FROM public.parent_email_config c
WHERE c.id = 'default';

