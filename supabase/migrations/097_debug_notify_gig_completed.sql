-- Migration: Add comprehensive debugging to notify_gig_completed
-- This will help us identify exactly where the issue occurs

DROP TRIGGER IF EXISTS on_gig_completed_notify ON public.gigs;
DROP FUNCTION IF EXISTS notify_gig_completed() CASCADE;

CREATE OR REPLACE FUNCTION notify_gig_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_poster_name TEXT;
  v_gig_title TEXT;
  v_neighbor_recipient_id UUID;
  v_teen_recipient_id UUID;
  v_neighbor_body TEXT;
  v_teen_body TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL THEN
    -- Get user names
    SELECT full_name INTO v_teen_name FROM public.users WHERE id = NEW.teen_id;
    SELECT full_name INTO v_poster_name FROM public.users WHERE id = NEW.poster_id;
    v_gig_title := NEW.title;
    
    -- CRITICAL: Store recipient IDs IMMEDIATELY in explicit variables
    v_neighbor_recipient_id := NEW.poster_id;
    v_teen_recipient_id := NEW.teen_id;
    
    -- Build notification bodies
    v_neighbor_body := v_teen_name || ' completed: ' || v_gig_title;
    v_teen_body := 'You completed: ' || v_gig_title || ' - Payment pending';
    
    -- COMPREHENSIVE LOGGING (both RAISE NOTICE and table logging)
    RAISE NOTICE '========================================';
    RAISE NOTICE '[notify_gig_completed] TRIGGER FIRED';
    RAISE NOTICE 'Gig ID: %, Title: %', NEW.id, v_gig_title;
    RAISE NOTICE 'NEW.poster_id: %, NEW.teen_id: %', NEW.poster_id, NEW.teen_id;
    RAISE NOTICE 'v_neighbor_recipient_id: % (should equal NEW.poster_id: %)', v_neighbor_recipient_id, NEW.poster_id;
    RAISE NOTICE 'v_teen_recipient_id: % (should equal NEW.teen_id: %)', v_teen_recipient_id, NEW.teen_id;
    RAISE NOTICE 'Neighbor body: %', v_neighbor_body;
    RAISE NOTICE 'Teen body: %', v_teen_body;
    RAISE NOTICE '========================================';
    
    -- Log to table for easier access
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'notify_gig_completed',
      'TRIGGER FIRED',
      jsonb_build_object(
        'gig_id', NEW.id,
        'gig_title', v_gig_title,
        'poster_id', NEW.poster_id,
        'teen_id', NEW.teen_id,
        'v_neighbor_recipient_id', v_neighbor_recipient_id,
        'v_teen_recipient_id', v_teen_recipient_id,
        'v_neighbor_body', v_neighbor_body,
        'v_teen_body', v_teen_body
      )
    );
    
    -- VALIDATION: Verify variables match NEW values
    IF v_neighbor_recipient_id != NEW.poster_id THEN
      RAISE EXCEPTION 'CRITICAL: v_neighbor_recipient_id (%) != NEW.poster_id (%)', v_neighbor_recipient_id, NEW.poster_id;
    END IF;
    IF v_teen_recipient_id != NEW.teen_id THEN
      RAISE EXCEPTION 'CRITICAL: v_teen_recipient_id (%) != NEW.teen_id (%)', v_teen_recipient_id, NEW.teen_id;
    END IF;
    
    -- Create notification records
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES 
      (v_neighbor_recipient_id, 'gig_completed', 'Gig Completed! ✅', 
       v_neighbor_body,
       jsonb_build_object('gig_id', NEW.id, 'amount', NEW.pay, 'teen_id', NEW.teen_id, 'recipient_role', 'neighbor'),
       FALSE),
      (v_teen_recipient_id, 'gig_completed', 'Gig Completed! 💰',
       v_teen_body,
       jsonb_build_object('gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'teen'),
       FALSE);
    
    -- Send push notification to NEIGHBOR
    RAISE NOTICE '--- CALLING send_push_notification FOR NEIGHBOR ---';
    RAISE NOTICE 'p_recipient_id := %', v_neighbor_recipient_id;
    RAISE NOTICE 'p_title := Gig Completed! ✅';
    RAISE NOTICE 'p_body := %', v_neighbor_body;
    RAISE NOTICE 'p_data.recipient_role := neighbor';
    
    -- Log to table before calling
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'notify_gig_completed',
      'CALLING send_push_notification FOR NEIGHBOR',
      jsonb_build_object(
        'p_recipient_id', v_neighbor_recipient_id,
        'p_title', 'Gig Completed! ✅',
        'p_body', v_neighbor_body,
        'p_data_recipient_role', 'neighbor',
        'gig_id', NEW.id
      )
    );
    
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_neighbor_recipient_id,
        p_title := 'Gig Completed! ✅',
        p_body := v_neighbor_body,
        p_data := jsonb_build_object('type', 'gig_completed', 'gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'neighbor', 'recipient_id', v_neighbor_recipient_id),
        p_priority := 'high'
      );
      RAISE NOTICE 'send_push_notification() completed for neighbor';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_gig_completed] Error sending to neighbor: %', SQLERRM;
      INSERT INTO public.debug_logs (function_name, log_level, message, data)
      VALUES ('notify_gig_completed', 'error', 'Error sending to neighbor', jsonb_build_object('error', SQLERRM));
    END;
    
    -- Send push notification to TEEN
    RAISE NOTICE '--- CALLING send_push_notification FOR TEEN ---';
    RAISE NOTICE 'p_recipient_id := %', v_teen_recipient_id;
    RAISE NOTICE 'p_title := Gig Completed! 💰';
    RAISE NOTICE 'p_body := %', v_teen_body;
    RAISE NOTICE 'p_data.recipient_role := teen';
    
    -- Log to table before calling
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'notify_gig_completed',
      'CALLING send_push_notification FOR TEEN',
      jsonb_build_object(
        'p_recipient_id', v_teen_recipient_id,
        'p_title', 'Gig Completed! 💰',
        'p_body', v_teen_body,
        'p_data_recipient_role', 'teen',
        'gig_id', NEW.id
      )
    );
    
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_teen_recipient_id,
        p_title := 'Gig Completed! 💰',
        p_body := v_teen_body,
        p_data := jsonb_build_object('type', 'gig_completed', 'gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'teen', 'recipient_id', v_teen_recipient_id),
        p_priority := 'high'
      );
      RAISE NOTICE 'send_push_notification() completed for teen';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_gig_completed] Error sending to teen: %', SQLERRM;
      INSERT INTO public.debug_logs (function_name, log_level, message, data)
      VALUES ('notify_gig_completed', 'error', 'Error sending to teen', jsonb_build_object('error', SQLERRM));
    END;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '[notify_gig_completed] COMPLETED';
    RAISE NOTICE '========================================';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_gig_completed_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION notify_gig_completed();

