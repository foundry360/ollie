-- Diagnostic queries to troubleshoot parent account email trigger

-- 1. Check if the config table exists and has data
SELECT * FROM public.parent_email_config WHERE id = 'default';

-- 2. Check if the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_parent_user_created_send_email';

-- 3. Check if the function exists
SELECT 
  routine_name, 
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'send_parent_account_welcome_email';

-- 4. Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 5. Check recent parent users created
SELECT 
  id, 
  email, 
  role, 
  created_at,
  (SELECT raw_user_meta_data->>'temp_password' FROM auth.users WHERE id = users.id) as has_temp_password,
  (SELECT raw_user_meta_data->>'teen_name' FROM auth.users WHERE id = users.id) as teen_name
FROM public.users 
WHERE role = 'parent' 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check database logs for trigger execution (if accessible)
-- Note: You'll need to check Supabase Dashboard → Database → Logs for NOTICE/WARNING messages

-- 7. Test the function manually (replace USER_ID with an actual parent user ID)
-- SELECT send_parent_account_welcome_email() FROM (SELECT * FROM public.users WHERE role = 'parent' LIMIT 1) as test_user;

-- 8. Check if there are any pg_net requests
SELECT * FROM net.http_request_queue ORDER BY created_at DESC LIMIT 10;




































