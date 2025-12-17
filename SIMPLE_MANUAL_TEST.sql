-- Simple manual test to call the Edge Function directly
-- This will help us see if the Edge Function can be called and if there are any errors

WITH latest_parent AS (
  SELECT 
    u.id,
    u.email,
    (au.raw_user_meta_data->>'temp_password')::TEXT as temp_password,
    (au.raw_user_meta_data->>'teen_name')::TEXT as teen_name
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.role = 'parent' 
  ORDER BY u.created_at DESC 
  LIMIT 1
),
config AS (
  SELECT * FROM public.parent_email_config WHERE id = 'default'
)
SELECT 
  'Test Result' as test_type,
  lp.email as parent_email,
  CASE 
    WHEN lp.temp_password IS NULL THEN '❌ No temp password'
    ELSE '✅ Has temp password'
  END as temp_password_status,
  c.supabase_url || '/functions/v1/send-parent-account-email' as function_url,
  CASE 
    WHEN c.service_role_key IS NULL OR c.service_role_key = '' THEN '❌ No service key'
    ELSE '✅ Service key exists'
  END as service_key_status,
  -- Call the Edge Function
  net.http_post(
    url := c.supabase_url || '/functions/v1/send-parent-account-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || c.service_role_key,
      'apikey', c.service_role_key
    ),
    body := jsonb_build_object(
      'parentEmail', lp.email,
      'tempPassword', lp.temp_password,
      'teenName', COALESCE(lp.teen_name, 'Your Teen'),
      'webAppUrl', COALESCE(c.web_app_url, 'http://localhost:8081')
    )
  ) as http_request_id
FROM latest_parent lp
CROSS JOIN config c;

-- Check the request queue to see if it was queued
-- Note: Column names may vary - try common variations
SELECT 
  id,
  url,
  method
FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 3;

