-- Check the status of the HTTP request that was queued
-- This will show if the request was processed or if there were errors

-- Check the most recent requests
SELECT 
  id,
  url,
  method,
  -- Try to get status if the column exists
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'net' AND table_name = 'http_request_queue' AND column_name = 'status')
    THEN (SELECT status FROM net.http_request_queue WHERE id = rq.id)
    ELSE 'Status column not available'
  END as status,
  -- Try to get error if the column exists
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'net' AND table_name = 'http_request_queue' AND column_name = 'error_msg')
    THEN (SELECT error_msg FROM net.http_request_queue WHERE id = rq.id)
    ELSE NULL
  END as error_msg
FROM net.http_request_queue rq
ORDER BY id DESC 
LIMIT 5;

-- Alternative: Just get all columns to see what's available
SELECT * FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 3;




















