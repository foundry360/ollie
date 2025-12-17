-- First, let's see what columns are available in the request queue
-- and what functions are available for getting responses

-- 1. Check the structure of http_request_queue
SELECT 
  'Request Queue Structure' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'net' 
  AND table_name = 'http_request_queue'
ORDER BY ordinal_position;

-- 2. Check available pg_net functions
SELECT 
  'Available Functions' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'net'
ORDER BY routine_name;

-- 3. Check recent requests (just the queue table - without created_at)
SELECT 
  'Recent Requests' as check_type,
  id,
  url,
  method
FROM net.http_request_queue
WHERE url LIKE '%send-parent-account-email%'
ORDER BY id DESC 
LIMIT 5;

