-- Migration: Update create_earnings_on_completion to call process-payment Edge Function
-- This ensures payment processing is triggered when a gig is completed

-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the function to call the payment processing Edge Function
CREATE OR REPLACE FUNCTION create_earnings_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_earnings_id UUID;
  v_config RECORD;
  v_function_url TEXT;
  v_request_body JSONB;
  v_response_id BIGINT;
BEGIN
  -- When gig is marked as completed, create earnings record
  IF NEW.status = 'completed' AND NEW.teen_id IS NOT NULL THEN
    -- Log that trigger is firing
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'create_earnings_on_completion',
      'TRIGGER FIRED - GIG COMPLETED',
      jsonb_build_object(
        'gig_id', NEW.id,
        'teen_id', NEW.teen_id,
        'pay', NEW.pay,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
    
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
    
    -- Log earnings creation
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'create_earnings_on_completion',
      'EARNINGS RECORD CREATED/UPDATED',
      jsonb_build_object(
        'gig_id', NEW.id,
        'earnings_id', v_earnings_id,
        'amount', NEW.pay
      )
    );

    -- Get Supabase configuration from push_notification_config table (reuse existing config)
    SELECT supabase_url, service_role_key INTO v_config
    FROM public.push_notification_config
    WHERE id = 'default'
    LIMIT 1;

    -- Only call Edge Function if config is available and earnings_id exists
    IF v_config.supabase_url IS NOT NULL 
       AND v_config.service_role_key IS NOT NULL 
       AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
       AND v_earnings_id IS NOT NULL THEN
      
      -- Construct Edge Function URL
      v_function_url := v_config.supabase_url || '/functions/v1/process-payment';
      
      -- Build request body
      v_request_body := jsonb_build_object(
        'gig_id', NEW.id::text,
        'earnings_id', v_earnings_id::text
      );
      
      RAISE NOTICE '[create_earnings_on_completion] Calling process-payment Edge Function';
      RAISE NOTICE '  gig_id: %, earnings_id: %', NEW.id, v_earnings_id;
      RAISE NOTICE '  function_url: %', v_function_url;
      
      -- Log to debug_logs table
      INSERT INTO public.debug_logs (function_name, message, data)
      VALUES (
        'create_earnings_on_completion',
        'CALLING process-payment EDGE FUNCTION',
        jsonb_build_object(
          'gig_id', NEW.id,
          'earnings_id', v_earnings_id,
          'function_url', v_function_url
        )
      );
      
      -- Call Edge Function asynchronously
      BEGIN
        SELECT net.http_post(
          url := v_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_config.service_role_key,
            'apikey', v_config.service_role_key
          ),
          body := v_request_body
        ) INTO v_response_id;
        
        RAISE NOTICE '[create_earnings_on_completion] Payment function called successfully. Request ID: %', v_response_id;
        
        -- Log success
        INSERT INTO public.debug_logs (function_name, message, data)
        VALUES (
          'create_earnings_on_completion',
          'PAYMENT FUNCTION CALLED SUCCESSFULLY',
          jsonb_build_object(
            'gig_id', NEW.id,
            'earnings_id', v_earnings_id,
            'request_id', v_response_id
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '[create_earnings_on_completion] Error calling process-payment Edge Function: %', SQLERRM;
          RAISE WARNING '[create_earnings_on_completion] Error details: %', SQLSTATE;
          
          -- Log error
          INSERT INTO public.debug_logs (function_name, log_level, message, data)
          VALUES (
            'create_earnings_on_completion',
            'error',
            'ERROR CALLING PAYMENT FUNCTION',
            jsonb_build_object(
              'gig_id', NEW.id,
              'earnings_id', v_earnings_id,
              'error', SQLERRM,
              'sqlstate', SQLSTATE
            )
          );
      END;
    ELSE
      RAISE WARNING '[create_earnings_on_completion] Payment function not called - config missing or earnings_id is NULL';
      RAISE WARNING '  supabase_url: %, service_role_key configured: %, earnings_id: %', 
        v_config.supabase_url IS NOT NULL,
        v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE',
        v_earnings_id IS NOT NULL;
      
      -- Log warning with detailed diagnostics
      INSERT INTO public.debug_logs (function_name, log_level, message, data)
      VALUES (
        'create_earnings_on_completion',
        'warning',
        'PAYMENT FUNCTION NOT CALLED - CONFIG MISSING OR EARNINGS_ID NULL',
        jsonb_build_object(
          'gig_id', NEW.id,
          'earnings_id', v_earnings_id,
          'has_supabase_url', v_config.supabase_url IS NOT NULL,
          'has_service_role_key', v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE',
          'supabase_url_value', CASE WHEN v_config.supabase_url IS NOT NULL THEN 'SET' ELSE 'NULL' END,
          'service_role_key_value', CASE WHEN v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'SET' ELSE 'NOT_SET' END,
          'earnings_id_value', CASE WHEN v_earnings_id IS NOT NULL THEN 'SET' ELSE 'NULL' END,
          'diagnosis', CASE 
            WHEN v_earnings_id IS NULL THEN 'EARNINGS_ID_IS_NULL'
            WHEN v_config.supabase_url IS NULL THEN 'SUPABASE_URL_MISSING'
            WHEN v_config.service_role_key IS NULL OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'SERVICE_ROLE_KEY_MISSING'
            ELSE 'UNKNOWN'
          END
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger should already exist from migration 002, but ensure it's there
DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.gigs;
CREATE TRIGGER on_task_completed_create_earnings
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL)
  EXECUTE FUNCTION create_earnings_on_completion();


