-- Check the response for request #5 using the correct function
-- This will show if the Edge Function was called and what it returned

-- 1. Check if request #5 exists
SELECT 
  '1. Request #5 Status' as check_type,
  id,
  url,
  method,
  CASE 
    WHEN EXISTS (SELECT 1 FROM net.http_request_queue WHERE id = 5) THEN '✅ Request found in queue'
    ELSE '❌ Request not found'
  END as status
FROM net.http_request_queue
WHERE id = 5;

-- 2. Try to collect the response using http_collect_response
SELECT 
  '2. Response for Request #5' as check_type,
  status_code,
  LEFT(content::text, 500) as response_preview,
  CASE 
    WHEN status_code IS NULL THEN '⏳ Still processing (wait a few seconds and check again)'
    WHEN status_code = 200 THEN '✅ Success - Check response_preview for details'
    WHEN status_code >= 400 THEN '❌ HTTP Error ' || status_code || ' - Check response_preview'
    ELSE '⚠️ Unknown status'
  END as status
FROM net.http_collect_response(5);

-- 3. Check worker status
SELECT 
  '3. Worker Status' as check_type,
  CASE 
    WHEN check_worker_is_up() THEN '✅ Worker is running'
    ELSE '❌ Worker is NOT running - Run: SELECT net.worker_restart();'
  END as status;

-- 4. Check all recent requests for the Edge Function
SELECT 
  '4. Recent Requests' as check_type,
  id,
  url,
  method
FROM net.http_request_queue
WHERE url LIKE '%send-parent-account-email%'
ORDER BY id DESC 
LIMIT 5;























