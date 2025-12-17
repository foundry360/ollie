-- Simple check of pg_net requests without trying to join response table
-- This will show what requests are queued and suggest checking Edge Function logs

-- 1. Check if pg_net worker is running
SELECT 
  '1. pg_net Worker Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Worker is running (PID: ' || string_agg(pid::text, ', ') || ')'
    ELSE '❌ Worker is NOT running - Run: SELECT net.worker_restart();'
  END as status
FROM pg_stat_activity 
WHERE backend_type ILIKE '%pg_net%';

-- 2. Check recent requests in queue (without created_at - column may not exist)
SELECT 
  '2. Recent Requests' as check_type,
  id,
  url,
  method,
  CASE 
    WHEN url LIKE '%send-parent-account-email%' THEN '✅ Target function'
    ELSE 'Other request'
  END as request_type
FROM net.http_request_queue
ORDER BY id DESC 
LIMIT 10;

-- 3. Check request #5 specifically
SELECT 
  '3. Request #5 Details' as check_type,
  id,
  url,
  method,
  'Check Supabase Dashboard → Edge Functions → send-parent-account-email → Logs' as next_step
FROM net.http_request_queue
WHERE id = 5;

-- 4. Verify config
SELECT 
  '4. Config Check' as check_type,
  id,
  supabase_url || '/functions/v1/send-parent-account-email' as function_url,
  CASE 
    WHEN service_role_key IS NULL OR service_role_key = '' OR service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' 
    THEN '❌ Service key not set'
    ELSE '✅ Service key configured'
  END as service_key_status
FROM public.parent_email_config 
WHERE id = 'default';

