-- Update the create_earnings_on_completion function to trigger payment processing
-- This function will create an earnings record and then call the process-payment Edge Function

-- First, ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the function to call the payment processing Edge Function
CREATE OR REPLACE FUNCTION create_earnings_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_earnings_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- When gig is marked as completed, create earnings record
  IF NEW.status = 'completed' AND NEW.teen_id IS NOT NULL THEN
    INSERT INTO public.earnings (teen_id, gig_id, amount, status, payment_status)
    VALUES (NEW.teen_id, NEW.id, NEW.pay, 'pending', 'pending')
    ON CONFLICT (teen_id, gig_id) DO UPDATE
    SET amount = NEW.pay, status = 'pending', payment_status = 'pending', updated_at = NOW()
    RETURNING id INTO v_earnings_id;

    -- Get the earnings ID (either from insert or conflict update)
    IF v_earnings_id IS NULL THEN
      SELECT id INTO v_earnings_id
      FROM public.earnings
      WHERE teen_id = NEW.teen_id AND gig_id = NEW.id;
    END IF;

    -- Call the process-payment Edge Function asynchronously
    -- Note: This requires pg_net extension and proper configuration
    -- The Edge Function URL should be set as a database setting or environment variable
    -- For now, we'll use a placeholder that should be configured in Supabase settings
    
    -- Get Supabase URL from current_setting (should be set via ALTER DATABASE)
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
    END;

    -- Only call Edge Function if URL is configured
    IF v_supabase_url IS NOT NULL AND v_earnings_id IS NOT NULL THEN
      -- Use pg_net to call the Edge Function
      -- Note: This requires the Edge Function to be deployed and accessible
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/process-payment',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'gig_id', NEW.id::text,
          'earnings_id', v_earnings_id::text
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative approach: Use a simpler trigger that just creates the earnings
-- and rely on a separate scheduled job or manual trigger to process payments
-- This is more reliable if pg_net is not available or configured

-- Create a function to manually trigger payment processing (can be called from application)
CREATE OR REPLACE FUNCTION trigger_payment_processing(p_earnings_id UUID, p_gig_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
BEGIN
  -- Get Supabase URL from current_setting
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
  END;

  -- Call Edge Function if URL is configured
  IF v_supabase_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/process-payment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'gig_id', p_gig_id::text,
        'earnings_id', p_earnings_id::text
      )
    );
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION trigger_payment_processing(UUID, UUID) TO authenticated;

-- Note: To configure the Supabase URL and service role key, run:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
-- 
-- Or set them via Supabase Dashboard → Database → Settings → Database Settings


