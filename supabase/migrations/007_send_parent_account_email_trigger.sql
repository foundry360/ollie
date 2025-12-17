-- Function to trigger parent account welcome email via Edge Function
-- This function calls the Supabase Edge Function when a parent account is created
-- Note: Requires pg_net extension to be enabled in Supabase

-- Enable pg_net extension (if not already enabled)
-- This extension allows calling HTTP endpoints from database functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send parent account welcome email via Edge Function
CREATE OR REPLACE FUNCTION send_parent_account_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_temp_password TEXT;
  v_teen_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- Only process if this is a parent user
  IF NEW.role != 'parent' THEN
    RETURN NEW;
  END IF;

  -- Get temp password and teen name from auth.users metadata
  -- We need to query auth.users to get the raw_user_meta_data
  SELECT 
    (raw_user_meta_data->>'temp_password')::TEXT,
    (raw_user_meta_data->>'teen_name')::TEXT
  INTO v_temp_password, v_teen_name
  FROM auth.users
  WHERE id = NEW.id;

  -- If temp password is not found, skip email (account might already exist)
  IF v_temp_password IS NULL OR v_temp_password = '' THEN
    RAISE NOTICE 'No temp password found for parent user %, skipping email', NEW.id;
    RETURN NEW;
  END IF;

  -- Get Supabase URL and service role key from settings
  -- These should be set in Supabase Dashboard → Settings → Database → Custom Config
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, log and return
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE NOTICE 'Supabase URL not configured. Email will not be sent.';
    RAISE NOTICE 'To configure: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://your-project.supabase.co'';';
    RETURN NEW;
  END IF;

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE NOTICE 'Service role key not configured. Email will not be sent.';
    RAISE NOTICE 'To configure: ALTER DATABASE postgres SET app.settings.service_role_key = ''your-service-role-key'';';
    RETURN NEW;
  END IF;

  -- Construct Edge Function URL
  v_function_url := v_supabase_url || '/functions/v1/send-parent-account-email';

  -- Call the Edge Function using pg_net
  SELECT net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key,
      'apikey', v_service_role_key
    ),
    body := jsonb_build_object(
      'parentEmail', NEW.email,
      'tempPassword', v_temp_password,
      'teenName', COALESCE(v_teen_name, 'Your Teen'),
      'webAppUrl', COALESCE(current_setting('app.settings.web_app_url', true), 'http://localhost:8081')
    )
  ) INTO v_response_id;

  RAISE NOTICE 'Parent account welcome email queued for % (request ID: %)', NEW.email, v_response_id;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- If function fails, log error but don't block user creation
    RAISE WARNING 'Failed to queue parent account email for %. Error: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to send email when parent user is created
DROP TRIGGER IF EXISTS on_parent_user_created_send_email ON public.users;
CREATE TRIGGER on_parent_user_created_send_email
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'parent')
  EXECUTE FUNCTION send_parent_account_welcome_email();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_parent_account_welcome_email() TO anon, authenticated;

-- Note: To use this trigger, you need to:
-- 1. Enable pg_net extension: CREATE EXTENSION IF NOT EXISTS pg_net; (already done above)
-- 2. Set Supabase URL: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- 3. Set service role key: ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
-- 4. (Optional) Set web app URL: ALTER DATABASE postgres SET app.settings.web_app_url = 'https://your-app-url.com';
-- 5. Deploy the Edge Function: supabase functions deploy send-parent-account-email
-- 6. Ensure RESEND_API_KEY is set in Edge Function secrets









