-- Migration: Verify and ensure notify_gig_completed function is correct
-- This migration checks if the function exists and has the correct logic

-- First, let's check what function currently exists
DO $$
DECLARE
  v_function_source TEXT;
BEGIN
  -- Get the current function definition
  SELECT pg_get_functiondef(oid) INTO v_function_source
  FROM pg_proc
  WHERE proname = 'notify_gig_completed'
  LIMIT 1;
  
  IF v_function_source IS NULL THEN
    RAISE NOTICE 'Function notify_gig_completed does not exist!';
  ELSE
    RAISE NOTICE 'Current function exists. Checking if it has the correct variables...';
    -- Check if it has the explicit variables
    IF v_function_source NOT LIKE '%v_neighbor_recipient_id%' OR v_function_source NOT LIKE '%v_teen_recipient_id%' THEN
      RAISE WARNING 'Function exists but does not have explicit recipient ID variables! Replacing...';
    ELSE
      RAISE NOTICE 'Function has correct variables.';
    END IF;
  END IF;
END $$;

-- Force replace the function with the correct version
DROP FUNCTION IF EXISTS notify_gig_completed() CASCADE;

CREATE OR REPLACE FUNCTION notify_gig_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_poster_name TEXT;
  v_gig_title TEXT;
  v_poster_has_token BOOLEAN;
  v_teen_has_token BOOLEAN;
  v_config_exists BOOLEAN;
  v_config_url TEXT;
  v_neighbor_recipient_id UUID;
  v_teen_recipient_id UUID;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL THEN
    -- Get user names
    SELECT full_name INTO v_teen_name FROM public.users WHERE id = NEW.teen_id;
    SELECT full_name INTO v_poster_name FROM public.users WHERE id = NEW.poster_id;
    v_gig_title := NEW.title;
    
    -- CRITICAL: Store recipient IDs in explicit variables IMMEDIATELY
    -- This prevents any possibility of variable confusion
    v_neighbor_recipient_id := NEW.poster_id;
    v_teen_recipient_id := NEW.teen_id;
    
    -- Log that we're attempting to send notifications
    RAISE NOTICE '=== GIG COMPLETED TRIGGER FIRED ===';
    RAISE NOTICE 'Gig: % (ID: %)', v_gig_title, NEW.id;
    RAISE NOTICE 'Teen: % (ID: %)', v_teen_name, NEW.teen_id;
    RAISE NOTICE 'Poster: % (ID: %)', v_poster_name, NEW.poster_id;
    RAISE NOTICE 'Stored recipient IDs - Neighbor: %, Teen: %', v_neighbor_recipient_id, v_teen_recipient_id;
    
    -- CRITICAL VALIDATION: Verify variables match NEW values
    IF v_neighbor_recipient_id != NEW.poster_id THEN
      RAISE EXCEPTION 'CRITICAL: v_neighbor_recipient_id (%) != NEW.poster_id (%)', v_neighbor_recipient_id, NEW.poster_id;
    END IF;
    IF v_teen_recipient_id != NEW.teen_id THEN
      RAISE EXCEPTION 'CRITICAL: v_teen_recipient_id (%) != NEW.teen_id (%)', v_teen_recipient_id, NEW.teen_id;
    END IF;
    
    -- Check if users have push tokens
    SELECT (expo_push_token IS NOT NULL AND expo_push_token != '') INTO v_poster_has_token
    FROM public.users WHERE id = NEW.poster_id;
    
    SELECT (expo_push_token IS NOT NULL AND expo_push_token != '') INTO v_teen_has_token
    FROM public.users WHERE id = NEW.teen_id;
    
    RAISE NOTICE 'Push token status - Poster %: %, Teen %: %', NEW.poster_id, v_poster_has_token, NEW.teen_id, v_teen_has_token;
    
    -- Check push notification config
    SELECT EXISTS(SELECT 1 FROM public.push_notification_config WHERE id = 'default') INTO v_config_exists;
    IF v_config_exists THEN
      SELECT supabase_url INTO v_config_url FROM public.push_notification_config WHERE id = 'default';
      RAISE NOTICE 'Push notification config found. URL: %', v_config_url;
    ELSE
      RAISE WARNING 'Push notification config NOT found in push_notification_config table!';
    END IF;
    
    -- Create notification record for neighbor (shows in notification bell)
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      read
    ) VALUES (
      v_neighbor_recipient_id,  -- Use explicit variable
      'gig_completed',
      'Gig Completed! ✅',
      v_teen_name || ' completed: ' || v_gig_title,
      jsonb_build_object(
        'gig_id', NEW.id,
        'amount', NEW.pay,
        'teen_id', NEW.teen_id,
        'recipient_role', 'neighbor'
      ),
      FALSE
    );
    
    -- Create notification record for teen
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      read
    ) VALUES (
      v_teen_recipient_id,  -- Use explicit variable
      'gig_completed',
      'Gig Completed! 💰',
      'You completed: ' || v_gig_title || ' - Payment pending',
      jsonb_build_object(
        'gig_id', NEW.id,
        'amount', NEW.pay,
        'recipient_role', 'teen'
      ),
      FALSE
    );
    
    -- Notify neighbor via push notification
    -- CRITICAL: Use explicit variable v_neighbor_recipient_id
    -- DOUBLE CHECK: Verify v_neighbor_recipient_id matches NEW.poster_id before sending
    IF v_neighbor_recipient_id != NEW.poster_id THEN
      RAISE EXCEPTION 'CRITICAL ERROR: v_neighbor_recipient_id (%) does not match NEW.poster_id (%)', v_neighbor_recipient_id, NEW.poster_id;
    END IF;
    
    RAISE NOTICE '=== SENDING NOTIFICATION TO NEIGHBOR ===';
    RAISE NOTICE 'Recipient ID: % (using v_neighbor_recipient_id, verified against NEW.poster_id: %)', v_neighbor_recipient_id, NEW.poster_id;
    RAISE NOTICE 'Title: Gig Completed! ✅';
    RAISE NOTICE 'Body: % completed: %', v_teen_name, v_gig_title;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_neighbor_recipient_id,  -- EXPLICIT: Use stored variable
        p_title := 'Gig Completed! ✅',
        p_body := v_teen_name || ' completed: ' || v_gig_title,
        p_data := jsonb_build_object(
          'type', 'gig_completed',
          'gig_id', NEW.id,
          'amount', NEW.pay,
          'recipient_role', 'neighbor'  -- Explicit role marker
        ),
        p_priority := 'high'
      );
      RAISE NOTICE 'send_push_notification() completed for neighbor %', v_neighbor_recipient_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Exception sending push notification to neighbor %: % (SQLSTATE: %)', v_neighbor_recipient_id, SQLERRM, SQLSTATE;
    END;
    
    -- Notify teen via push notification
    -- CRITICAL: Use explicit variable v_teen_recipient_id
    -- DOUBLE CHECK: Verify v_teen_recipient_id matches NEW.teen_id before sending
    IF v_teen_recipient_id != NEW.teen_id THEN
      RAISE EXCEPTION 'CRITICAL ERROR: v_teen_recipient_id (%) does not match NEW.teen_id (%)', v_teen_recipient_id, NEW.teen_id;
    END IF;
    
    RAISE NOTICE '=== SENDING NOTIFICATION TO TEEN ===';
    RAISE NOTICE 'Recipient ID: % (using v_teen_recipient_id, verified against NEW.teen_id: %)', v_teen_recipient_id, NEW.teen_id;
    RAISE NOTICE 'Title: Gig Completed! 💰';
    RAISE NOTICE 'Body: You completed: % - Payment pending', v_gig_title;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_teen_recipient_id,  -- EXPLICIT: Use stored variable
        p_title := 'Gig Completed! 💰',
        p_body := 'You completed: ' || v_gig_title || ' - Payment pending',
        p_data := jsonb_build_object(
          'type', 'gig_completed',
          'gig_id', NEW.id,
          'amount', NEW.pay,
          'recipient_role', 'teen'  -- Explicit role marker
        ),
        p_priority := 'high'
      );
      RAISE NOTICE 'send_push_notification() completed for teen %', v_teen_recipient_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Exception sending push notification to teen %: % (SQLSTATE: %)', v_teen_recipient_id, SQLERRM, SQLSTATE;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (it was dropped with CASCADE above)
DROP TRIGGER IF EXISTS on_gig_completed_notify ON public.gigs;
CREATE TRIGGER on_gig_completed_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION notify_gig_completed();

