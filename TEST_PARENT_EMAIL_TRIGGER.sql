-- Test the parent email trigger manually
-- This will help us see if the function works and what errors occur

-- First, let's check the most recent parent user
DO $$
DECLARE
  v_parent_id UUID;
  v_parent_email TEXT;
  v_temp_password TEXT;
  v_teen_name TEXT;
  v_config RECORD;
BEGIN
  -- Get the most recent parent user
  SELECT id, email INTO v_parent_id, v_parent_email
  FROM public.users 
  WHERE role = 'parent' 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF v_parent_id IS NULL THEN
    RAISE NOTICE 'No parent user found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing with parent user: % (%)', v_parent_email, v_parent_id;
  
  -- Check if temp password exists in metadata
  SELECT 
    (raw_user_meta_data->>'temp_password')::TEXT,
    (raw_user_meta_data->>'teen_name')::TEXT
  INTO v_temp_password, v_teen_name
  FROM auth.users
  WHERE id = v_parent_id;
  
  RAISE NOTICE 'Temp password found: %', CASE WHEN v_temp_password IS NOT NULL THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'Teen name: %', COALESCE(v_teen_name, 'NULL');
  
  -- Check config
  SELECT * INTO v_config FROM public.parent_email_config WHERE id = 'default';
  
  IF v_config IS NULL THEN
    RAISE WARNING 'Config not found!';
  ELSE
    RAISE NOTICE 'Config found:';
    RAISE NOTICE '  Supabase URL: %', v_config.supabase_url;
    RAISE NOTICE '  Service role key: %', CASE 
      WHEN v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' 
      THEN 'NOT SET' 
      ELSE 'SET (length: ' || length(v_config.service_role_key) || ')'
    END;
    RAISE NOTICE '  Web app URL: %', v_config.web_app_url;
  END IF;
  
  -- Now try to manually call the Edge Function (simulating what the trigger does)
  IF v_config IS NOT NULL AND v_temp_password IS NOT NULL THEN
    DECLARE
      v_function_url TEXT;
      v_response_id BIGINT;
    BEGIN
      v_function_url := v_config.supabase_url || '/functions/v1/send-parent-account-email';
      RAISE NOTICE 'Calling Edge Function: %', v_function_url;
      
      SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_config.service_role_key,
          'apikey', v_config.service_role_key
        ),
        body := jsonb_build_object(
          'parentEmail', v_parent_email,
          'tempPassword', v_temp_password,
          'teenName', COALESCE(v_teen_name, 'Your Teen'),
          'webAppUrl', COALESCE(v_config.web_app_url, 'http://localhost:8081')
        )
      ) INTO v_response_id;
      
      RAISE NOTICE 'Edge Function call queued with request ID: %', v_response_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to call Edge Function: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Cannot call Edge Function - missing config or temp password';
  END IF;
END $$;

-- Check pg_net request queue to see if the call was made
-- Note: Column names may vary depending on pg_net version
SELECT 
  id,
  url,
  method,
  created_at
FROM net.http_request_queue 
ORDER BY created_at DESC 
LIMIT 5;

-- Alternative: Check if pg_net extension is working
SELECT * FROM pg_extension WHERE extname = 'pg_net';

