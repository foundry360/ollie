-- Manual test to trigger the email function
-- This simulates what happens when a parent user is inserted

-- First, get the most recent parent user
WITH latest_parent AS (
  SELECT 
    u.id,
    u.email,
    u.role,
    (au.raw_user_meta_data->>'temp_password')::TEXT as temp_password,
    (au.raw_user_meta_data->>'teen_name')::TEXT as teen_name
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.role = 'parent' 
  ORDER BY u.created_at DESC 
  LIMIT 1
)
-- Manually call the Edge Function (what the trigger should do)
SELECT 
  'Manual Test' as test_type,
  lp.email as parent_email,
  CASE 
    WHEN lp.temp_password IS NULL THEN '❌ No temp password found'
    ELSE '✅ Temp password found'
  END as temp_password_status,
  lp.teen_name,
  c.supabase_url,
  CASE 
    WHEN c.service_role_key IS NULL OR c.service_role_key = '' OR c.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' 
    THEN '❌ Service role key not set'
    ELSE '✅ Service role key is set'
  END as config_status,
  -- Try to call the Edge Function
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
CROSS JOIN public.parent_email_config c
WHERE c.id = 'default'
  AND lp.temp_password IS NOT NULL;





















