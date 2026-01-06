-- Migration: Fix trigger to prevent payment on pending_completion_approval
-- This ensures payment ONLY happens when neighbor approves (status = 'completed')

-- First, verify the function only processes when status is 'completed'
-- The function should already be correct from migration 101, but let's be explicit
CREATE OR REPLACE FUNCTION create_earnings_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_earnings_id UUID;
  v_config RECORD;
  v_function_url TEXT;
  v_request_body JSONB;
  v_response_id BIGINT;
BEGIN
  -- CRITICAL: Only process when status is 'completed', NOT 'pending_completion_approval'
  -- This ensures payment only happens after neighbor approval
  -- IMPORTANT: We DO want to process when coming FROM 'pending_completion_approval' TO 'completed'
  IF NEW.status = 'completed' 
     AND OLD.status != 'completed' 
     AND NEW.status != 'pending_completion_approval'  -- Extra safety check (NEW should never be pending here)
     AND NEW.teen_id IS NOT NULL THEN
    
    -- Log that trigger is firing
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'create_earnings_on_completion',
      'TRIGGER FIRED - GIG COMPLETED (AFTER APPROVAL)',
      jsonb_build_object(
        'gig_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'teen_id', NEW.teen_id
      )
    );

    -- Create earnings record
    INSERT INTO public.earnings (teen_id, gig_id, amount, status, payment_status)
    VALUES (NEW.teen_id, NEW.id, NEW.pay, 'pending', 'pending')
    ON CONFLICT (teen_id, gig_id) DO UPDATE
    SET amount = NEW.pay, status = 'pending', payment_status = 'pending', updated_at = NOW()
    RETURNING id INTO v_earnings_id;

    -- Log earnings creation/update
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

    -- Get the earnings ID (either from insert or conflict update)
    IF v_earnings_id IS NULL THEN
      SELECT id INTO v_earnings_id
      FROM public.earnings
      WHERE teen_id = NEW.teen_id AND gig_id = NEW.id;
    END IF;

    -- Get Supabase configuration from push_notification_config table
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
      
      -- Log warning
      INSERT INTO public.debug_logs (function_name, log_level, message, data)
      VALUES (
        'create_earnings_on_completion',
        'warning',
        'PAYMENT FUNCTION NOT CALLED - CONFIG MISSING',
        jsonb_build_object(
          'gig_id', NEW.id,
          'earnings_id', v_earnings_id,
          'has_supabase_url', v_config.supabase_url IS NOT NULL,
          'has_service_role_key', v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE',
          'is_earnings_id_null', v_earnings_id IS NULL
        )
      );
    END IF;
  ELSE
    -- Log when trigger fires but doesn't process (for debugging)
    IF NEW.status = 'pending_completion_approval' THEN
      INSERT INTO public.debug_logs (function_name, message, data)
      VALUES (
        'create_earnings_on_completion',
        'TRIGGER FIRED BUT SKIPPED - STATUS IS pending_completion_approval',
        jsonb_build_object(
          'gig_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'teen_id', NEW.teen_id,
          'reason', 'Waiting for neighbor approval'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger with explicit condition
DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.gigs;

CREATE TRIGGER on_task_completed_create_earnings
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' 
    AND OLD.status != 'completed' 
    AND NEW.teen_id IS NOT NULL
    -- Note: We DO want to fire when OLD.status = 'pending_completion_approval' (after neighbor approval)
    -- We only prevent firing when status is set to 'pending_completion_approval' directly (which shouldn't happen)
  )
  EXECUTE FUNCTION create_earnings_on_completion();

-- Add comment
COMMENT ON TRIGGER on_task_completed_create_earnings ON public.gigs IS 
  'ONLY fires when status changes to completed (after neighbor approval). Does NOT fire for pending_completion_approval.';

