-- Diagnostic queries that return visible results

-- 1. Check if config table exists and has data
SELECT 
  'Config Table Check' as check_type,
  CASE 
    WHEN service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' OR service_role_key = '' OR service_role_key IS NULL THEN '⚠️ Service role key not set'
    ELSE '✅ Config table has data'
  END as status,
  supabase_url,
  CASE 
    WHEN service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' OR service_role_key = '' OR service_role_key IS NULL THEN 'NOT SET'
    ELSE 'SET (length: ' || length(service_role_key) || ')'
  END as service_key_status,
  web_app_url
FROM public.parent_email_config 
WHERE id = 'default';

-- 2. Check if trigger exists
SELECT 
  'Trigger Check' as check_type,
  '✅ Trigger exists' as status,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_parent_user_created_send_email'
UNION ALL
SELECT 
  'Trigger Check' as check_type,
  '❌ Trigger does not exist' as status,
  NULL::text as trigger_name,
  NULL::text as event_object_table,
  NULL::text as action_timing,
  NULL::text as event_manipulation
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.triggers 
  WHERE trigger_name = 'on_parent_user_created_send_email'
);

-- 3. Check if function exists
SELECT 
  'Function Check' as check_type,
  '✅ Function exists' as status,
  routine_name
FROM information_schema.routines 
WHERE routine_name = 'send_parent_account_welcome_email'
UNION ALL
SELECT 
  'Function Check' as check_type,
  '❌ Function does not exist' as status,
  NULL::text as routine_name
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'send_parent_account_welcome_email'
);

-- 4. Check if pg_net extension is enabled
SELECT 
  'pg_net Extension' as check_type,
  '✅ pg_net enabled' as status,
  extname,
  extversion::text
FROM pg_extension 
WHERE extname = 'pg_net'
UNION ALL
SELECT 
  'pg_net Extension' as check_type,
  '❌ pg_net not enabled' as status,
  NULL::text as extname,
  NULL::text as extversion
WHERE NOT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
);

-- 5. Check recent parent users and their metadata
SELECT 
  'Parent User Check' as check_type,
  u.id,
  u.email,
  u.role,
  u.created_at,
  CASE 
    WHEN au.raw_user_meta_data->>'temp_password' IS NULL THEN '❌ No temp password'
    WHEN au.raw_user_meta_data->>'temp_password' = '' THEN '❌ Empty temp password'
    ELSE '✅ Has temp password'
  END as temp_password_status,
  (au.raw_user_meta_data->>'teen_name')::TEXT as teen_name
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
WHERE u.role = 'parent' 
ORDER BY u.created_at DESC 
LIMIT 3;

