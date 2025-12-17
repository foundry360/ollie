-- Create configuration table for parent email settings
CREATE TABLE IF NOT EXISTS public.parent_email_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  web_app_url TEXT DEFAULT 'http://localhost:8081',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.parent_email_config ENABLE ROW LEVEL SECURITY;

-- Allow service role and SECURITY DEFINER functions to read config
-- Note: SECURITY DEFINER functions bypass RLS, but we'll add a policy anyway for safety
CREATE POLICY "Allow config read for functions" ON public.parent_email_config
  FOR SELECT USING (true);

-- Insert default config if it doesn't exist (you'll need to update these values)
INSERT INTO public.parent_email_config (id, supabase_url, service_role_key, web_app_url)
VALUES (
  'default',
  'https://enxxlckxhcttvsxnjfnw.supabase.co',  -- Your Supabase URL
  'YOUR_SERVICE_ROLE_KEY_HERE',                -- Get from Settings → API → service_role key
  'http://localhost:8081'
)
ON CONFLICT (id) DO NOTHING;

-- Update the function to use the config table instead of database settings
CREATE OR REPLACE FUNCTION send_parent_account_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_temp_password TEXT;
  v_teen_name TEXT;
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- Only process if this is a parent user
  IF NEW.role != 'parent' THEN
    RETURN NEW;
  END IF;

  -- Get temp password and teen name from auth.users metadata
  -- Use SECURITY DEFINER to access auth.users
  BEGIN
    SELECT 
      (raw_user_meta_data->>'temp_password')::TEXT,
      (raw_user_meta_data->>'teen_name')::TEXT
    INTO v_temp_password, v_teen_name
    FROM auth.users
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Trigger fired for parent user: % (email: %)', NEW.id, NEW.email;
    RAISE NOTICE 'Temp password found: %', CASE WHEN v_temp_password IS NOT NULL THEN 'YES' ELSE 'NO' END;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error reading auth.users metadata for user %: %', NEW.id, SQLERRM;
      RETURN NEW;
  END;

  -- If temp password is not found, skip email (account might already exist)
  IF v_temp_password IS NULL OR v_temp_password = '' THEN
    RAISE WARNING 'No temp password found for parent user % (email: %), skipping email', NEW.id, NEW.email;
    RETURN NEW;
  END IF;
  
  RAISE NOTICE 'Processing email for parent user: % (email: %)', NEW.id, NEW.email;

  -- Get configuration from config table
  SELECT * INTO v_config FROM public.parent_email_config WHERE id = 'default';

  -- If config is not found, log and return
  IF v_config IS NULL THEN
    RAISE WARNING 'Parent email config not found. Email will not be sent.';
    RAISE WARNING 'Please insert a row into public.parent_email_config with id=''default''';
    RETURN NEW;
  END IF;

  -- Validate config values
  IF v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured in parent_email_config. Email will not be sent.';
    RETURN NEW;
  END IF;

  IF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RAISE WARNING 'Service role key not configured in parent_email_config. Email will not be sent.';
    RETURN NEW;
  END IF;

  -- Construct Edge Function URL
  v_function_url := v_config.supabase_url || '/functions/v1/send-parent-account-email';

  -- Call the Edge Function using pg_net
  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_config.service_role_key,
        'apikey', v_config.service_role_key
      ),
      body := jsonb_build_object(
        'parentEmail', NEW.email,
        'tempPassword', v_temp_password,
        'teenName', COALESCE(v_teen_name, 'Your Teen'),
        'webAppUrl', COALESCE(v_config.web_app_url, 'http://localhost:8081')
      )
    ) INTO v_response_id;

    RAISE NOTICE '✅ Parent account welcome email queued for % (request ID: %)', NEW.email, v_response_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Failed to queue email for %: %', NEW.email, SQLERRM;
      -- Don't re-raise - allow user creation to succeed even if email fails
  END;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- If function fails, log error but don't block user creation
    RAISE WARNING 'Failed to queue parent account email for %. Error: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Note: After running this migration, update the config table with your actual values:
-- UPDATE public.parent_email_config 
-- SET 
--   supabase_url = 'https://enxxlckxhcttvsxnjfnw.supabase.co',
--   service_role_key = 'your-actual-service-role-key',
--   web_app_url = 'http://localhost:8081'
-- WHERE id = 'default';

