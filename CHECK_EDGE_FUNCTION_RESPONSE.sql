-- Check the actual response from the Edge Function call
-- This will show us if the Edge Function was called and what it returned

-- Check the response for the most recent request (id: 5 from the manual test)
SELECT 
  'Edge Function Response' as check_type,
  rq.id as request_id,
  rq.url,
  rq.method,
  r.status_code,
  r.content::text as response_body,
  r.headers::text as response_headers,
  r.created_at as response_time,
  CASE 
    WHEN r.status_code IS NULL THEN '⏳ Request still pending (check again in a few seconds)'
    WHEN r.status_code = 200 THEN '✅ Request succeeded - Check response_body for details'
    WHEN r.status_code >= 400 THEN '❌ Request failed - Check response_body for error'
    ELSE '⚠️ Unexpected status code'
  END as status
FROM net.http_request_queue rq
LEFT JOIN net.http_response r ON r.request_id = rq.id
WHERE rq.id = 5  -- The request ID from the manual test
ORDER BY rq.id DESC 
LIMIT 1;

-- Also check all recent responses to see the pattern
SELECT 
  'All Recent Responses' as check_type,
  rq.id,
  rq.url,
  r.status_code,
  LEFT(r.content::text, 200) as response_preview,  -- First 200 chars
  r.created_at
FROM net.http_request_queue rq
LEFT JOIN net.http_response r ON r.request_id = rq.id
WHERE rq.url LIKE '%send-parent-account-email%'
ORDER BY rq.id DESC 
LIMIT 5;

































