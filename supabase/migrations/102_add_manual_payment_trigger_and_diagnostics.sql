-- Migration: Add manual payment trigger function and diagnostic helpers
-- This allows manually triggering payment processing for existing earnings records

-- Function to manually trigger payment processing for an earnings record
CREATE OR REPLACE FUNCTION trigger_payment_manually(p_earnings_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
  v_request_body JSONB;
  v_response_id BIGINT;
  v_earnings RECORD;
BEGIN
  -- Get earnings record
  SELECT * INTO v_earnings
  FROM public.earnings
  WHERE id = p_earnings_id;
  
  IF v_earnings IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Earnings record not found',
      'earnings_id', p_earnings_id
    );
  END IF;
  
  -- Get Supabase configuration
  SELECT supabase_url, service_role_key INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default'
  LIMIT 1;
  
  IF v_config.supabase_url IS NULL 
     OR v_config.service_role_key IS NULL 
     OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Push notification config not set up correctly',
      'has_url', v_config.supabase_url IS NOT NULL,
      'has_key', v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
    );
  END IF;
  
  -- Construct Edge Function URL
  v_function_url := v_config.supabase_url || '/functions/v1/process-payment';
  
  -- Build request body
  v_request_body := jsonb_build_object(
    'gig_id', v_earnings.gig_id::text,
    'earnings_id', p_earnings_id::text
  );
  
  -- Log attempt
  INSERT INTO public.debug_logs (function_name, message, data)
  VALUES (
    'trigger_payment_manually',
    'MANUALLY TRIGGERING PAYMENT',
    jsonb_build_object(
      'earnings_id', p_earnings_id,
      'gig_id', v_earnings.gig_id,
      'function_url', v_function_url
    )
  );
  
  -- Call Edge Function
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
    
    -- Log success
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'trigger_payment_manually',
      'PAYMENT FUNCTION CALLED SUCCESSFULLY',
      jsonb_build_object(
        'earnings_id', p_earnings_id,
        'request_id', v_response_id
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment function called successfully',
      'request_id', v_response_id,
      'earnings_id', p_earnings_id
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error
      INSERT INTO public.debug_logs (function_name, log_level, message, data)
      VALUES (
        'trigger_payment_manually',
        'error',
        'ERROR CALLING PAYMENT FUNCTION',
        jsonb_build_object(
          'earnings_id', p_earnings_id,
          'error', SQLERRM,
          'sqlstate', SQLSTATE
        )
      );
      
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE,
        'earnings_id', p_earnings_id
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to diagnose payment issues for a completed gig
CREATE OR REPLACE FUNCTION diagnose_payment_issue(p_gig_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_gig RECORD;
  v_earnings RECORD;
  v_config RECORD;
  v_logs JSONB;
  v_result JSONB;
BEGIN
  -- Get gig info
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id;
  
  IF v_gig IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gig not found',
      'gig_id', p_gig_id
    );
  END IF;
  
  -- Get earnings record
  SELECT * INTO v_earnings
  FROM public.earnings
  WHERE gig_id = p_gig_id AND teen_id = v_gig.teen_id;
  
  -- Get config
  SELECT * INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default';
  
  -- Get recent debug logs for this gig
  SELECT jsonb_agg(
    jsonb_build_object(
      'created_at', log_entry.created_at,
      'function_name', log_entry.function_name,
      'log_level', log_entry.log_level,
      'message', log_entry.message,
      'data', log_entry.data
    ) ORDER BY log_entry.created_at DESC
  ) INTO v_logs
  FROM (
    SELECT created_at, function_name, log_level, message, data
    FROM public.debug_logs
    WHERE function_name IN ('create_earnings_on_completion', 'trigger_payment_manually')
      AND (data->>'gig_id' = p_gig_id::text OR data->>'earnings_id' = COALESCE(v_earnings.id::text, ''))
    ORDER BY created_at DESC
    LIMIT 20
  ) AS log_entry;
  
  -- Build diagnostic result
  v_result := jsonb_build_object(
    'gig', jsonb_build_object(
      'id', v_gig.id,
      'status', v_gig.status,
      'teen_id', v_gig.teen_id,
      'pay', v_gig.pay,
      'completed', v_gig.status = 'completed'
    ),
    'earnings', CASE 
      WHEN v_earnings IS NULL THEN jsonb_build_object('exists', false)
      ELSE jsonb_build_object(
        'exists', true,
        'id', v_earnings.id,
        'status', v_earnings.status,
        'payment_status', v_earnings.payment_status,
        'payment_failed_reason', v_earnings.payment_failed_reason,
        'stripe_payment_intent_id', v_earnings.stripe_payment_intent_id,
        'created_at', v_earnings.created_at
      )
    END,
    'config', jsonb_build_object(
      'has_url', v_config.supabase_url IS NOT NULL,
      'has_key', v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE',
      'url_set', CASE WHEN v_config.supabase_url IS NOT NULL THEN 'YES' ELSE 'NO' END,
      'key_set', CASE WHEN v_config.service_role_key IS NOT NULL AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'YES' ELSE 'NO' END
    ),
    'debug_logs', COALESCE(v_logs, '[]'::jsonb),
    'recommendations', jsonb_build_array(
      CASE 
        WHEN v_gig.status != 'completed' THEN 'Gig is not completed yet'
        WHEN v_earnings IS NULL THEN 'Earnings record was not created - check trigger'
        WHEN v_config.supabase_url IS NULL THEN 'Supabase URL not configured in push_notification_config'
        WHEN v_config.service_role_key IS NULL OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'Service role key not configured in push_notification_config'
        WHEN v_earnings.payment_status = 'pending' THEN 'Payment is pending - try calling trigger_payment_manually(' || v_earnings.id::text || ')'
        WHEN v_earnings.payment_status = 'failed' THEN 'Payment failed: ' || COALESCE(v_earnings.payment_failed_reason, 'Unknown reason')
        ELSE 'Check debug_logs for details'
      END
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_payment_manually(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION diagnose_payment_issue(UUID) TO authenticated;

