-- Add email sending to neighbor approval trigger
-- This ensures emails are sent when applications are approved, even if approved directly in the database
-- Note: Requires pg_net extension to be enabled in Supabase

-- Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create configuration table for neighbor approval email settings
CREATE TABLE IF NOT EXISTS public.neighbor_approval_email_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.neighbor_approval_email_config ENABLE ROW LEVEL SECURITY;

-- Allow SECURITY DEFINER functions to read config
DROP POLICY IF EXISTS "Allow config read for functions" ON public.neighbor_approval_email_config;
CREATE POLICY "Allow config read for functions" ON public.neighbor_approval_email_config
  FOR SELECT USING (true);

-- Insert default config if it doesn't exist (you'll need to update these values)
INSERT INTO public.neighbor_approval_email_config (id, supabase_url, service_role_key)
VALUES (
  'default',
  'https://enxxlckxhcttvsxnjfnw.supabase.co',  -- Your Supabase URL
  'YOUR_SERVICE_ROLE_KEY_HERE'                -- Get from Settings → API → service_role key
)
ON CONFLICT (id) DO NOTHING;

-- Update the function to also send approval email
CREATE OR REPLACE FUNCTION update_user_address_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- When a neighbor application is approved, automatically update the user's address and phone
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    RAISE NOTICE '📧 [update_user_address_on_approval] Application % approved for user % (email: %)', NEW.id, NEW.user_id, NEW.email;
    
    -- Verify that the user_id exists in auth.users before creating the profile
    -- This prevents foreign key constraint errors
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
      RAISE WARNING '❌ [update_user_address_on_approval] User % does not exist in auth.users. Cannot create profile.', NEW.user_id;
      RAISE WARNING 'Application user_id: %, Email: %', NEW.user_id, NEW.email;
      RETURN NEW; -- Don't create profile if auth user doesn't exist
    END IF;
    
    -- First, ensure the user profile exists (it might have been created during signup with only name/email)
    -- If it doesn't exist, create it. If it exists, update it with address and phone.
    BEGIN
      INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        phone,
        address,
        date_of_birth,
        verified,
        updated_at
      )
      VALUES (
        NEW.user_id,
        NEW.email,
        NEW.full_name,
        'poster',
        NEW.phone,
        NEW.address,
        NEW.date_of_birth,
        true,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        -- Always update these fields from the application
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, users.phone),
        address = COALESCE(EXCLUDED.address, users.address),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
        verified = true,
        updated_at = NOW();
      
      -- Log for debugging
      RAISE NOTICE '✅ [update_user_address_on_approval] Updated user % with address: %, phone: %', NEW.user_id, NEW.address, NEW.phone;
    EXCEPTION
      WHEN OTHERS THEN
        -- If profile creation fails, log the error but don't block approval
        RAISE WARNING '❌ [update_user_address_on_approval] Failed to create/update profile for user %. Error: %', NEW.user_id, SQLERRM;
        RAISE WARNING 'Error details: Code: %, Message: %', SQLSTATE, SQLERRM;
    END;
    
    -- Send approval email via Edge Function
    BEGIN
      RAISE NOTICE '📧 [update_user_address_on_approval] Attempting to send email to: %', NEW.email;
      
      -- Get configuration from config table
      SELECT * INTO v_config FROM public.neighbor_approval_email_config WHERE id = 'default';
      
      -- If config is not found, log and return
      IF v_config IS NULL THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Neighbor approval email config not found. Email will not be sent.';
        RAISE WARNING 'Please insert a row into public.neighbor_approval_email_config with id=''default''';
        RETURN NEW;
      END IF;
      
      RAISE NOTICE '📧 [update_user_address_on_approval] Config found. URL: %, Key set: %', 
        v_config.supabase_url, 
        CASE WHEN v_config.service_role_key IS NOT NULL AND v_config.service_role_key != '' AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'YES' ELSE 'NO' END;
      
      -- Validate config values
      IF v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Supabase URL not configured in neighbor_approval_email_config. Email will not be sent.';
        RETURN NEW;
      END IF;
      
      IF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Service role key not configured in neighbor_approval_email_config. Email will not be sent.';
        RAISE WARNING 'Current key value: %', COALESCE(v_config.service_role_key, 'NULL');
        RETURN NEW;
      END IF;
      
      -- Construct Edge Function URL
      v_function_url := v_config.supabase_url || '/functions/v1/send-neighbor-approval-email';
      RAISE NOTICE '📧 [update_user_address_on_approval] Calling Edge Function: %', v_function_url;
      
      -- Call the Edge Function using pg_net (async, non-blocking)
      SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_config.service_role_key,
          'apikey', v_config.service_role_key
        ),
        body := jsonb_build_object(
          'email', NEW.email,
          'fullName', NEW.full_name
        )
      ) INTO v_response_id;
      
      RAISE NOTICE '✅ [update_user_address_on_approval] Neighbor approval email queued for % (request ID: %)', NEW.email, v_response_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- If email sending fails, log error but don't block approval
        RAISE WARNING 'Failed to queue neighbor approval email for %. Error: %', NEW.email, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Note: After running this migration, update the config table with your actual values:
-- UPDATE public.neighbor_approval_email_config 
-- SET 
--   supabase_url = 'https://enxxlckxhcttvsxnjfnw.supabase.co',
--   service_role_key = 'your-actual-service-role-key'
-- WHERE id = 'default';
