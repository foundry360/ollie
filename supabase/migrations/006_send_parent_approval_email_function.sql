-- Function to trigger parent approval email via Edge Function
-- This function calls the Supabase Edge Function which uses SMTP configuration
-- Note: Requires http extension to be enabled in Supabase

-- Enable http extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS http;

-- Create function to send parent approval email via Edge Function
CREATE OR REPLACE FUNCTION send_parent_approval_email(
  p_parent_email TEXT,
  p_approval_token TEXT,
  p_teen_name TEXT,
  p_teen_age INTEGER,
  p_approval_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response http_response;
  v_supabase_url TEXT;
  v_function_url TEXT;
BEGIN
  -- Get Supabase URL from environment (set in Supabase Dashboard)
  -- For Edge Functions, the URL is: https://[project-ref].supabase.co/functions/v1/send-parent-approval-email
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not set, try to construct from Supabase's internal URL
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Use the Supabase project URL (this should be set in your Supabase project)
    -- You can set it via: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
    RAISE NOTICE 'Supabase URL not configured. Email will be logged only.';
    RAISE NOTICE 'Email to send to %: Subject: Approve %''s Ollie Account, URL: %', 
      p_parent_email, p_teen_name, p_approval_url;
    RETURN;
  END IF;
  
  v_function_url := v_supabase_url || '/functions/v1/send-parent-approval-email';
  
  -- Call the Edge Function
  SELECT * INTO v_response FROM http((
    'POST',
    v_function_url,
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
    ],
    'application/json',
    json_build_object(
      'parentEmail', p_parent_email,
      'token', p_approval_token,
      'teenName', p_teen_name,
      'teenAge', p_teen_age,
      'approvalUrl', p_approval_url
    )::text
  )::http_request);
  
  -- Log the response
  IF v_response.status = 200 THEN
    RAISE NOTICE 'Email sent successfully to %', p_parent_email;
  ELSE
    RAISE WARNING 'Failed to send email. Status: %, Response: %', v_response.status, v_response.content;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- If http extension is not available or function fails, just log
    RAISE NOTICE 'Email function error: %. Email details: To: %, Subject: Approve %''s Ollie Account, URL: %', 
      SQLERRM, p_parent_email, p_teen_name, p_approval_url;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_parent_approval_email TO anon, authenticated;

-- Note: To use this function, you need to:
-- 1. Enable http extension: CREATE EXTENSION IF NOT EXISTS http;
-- 2. Set Supabase URL: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- 3. Set service role key: ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
-- 4. Configure SMTP in Supabase Dashboard → Settings → Auth → SMTP Settings
-- 5. Deploy the Edge Function: supabase functions deploy send-parent-approval-email

