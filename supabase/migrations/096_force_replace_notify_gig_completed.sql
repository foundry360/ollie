-- Migration: Force complete replacement of notify_gig_completed function
-- This ensures no cached versions remain

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_gig_completed_notify ON public.gigs;

-- Drop the function completely (CASCADE to remove any dependencies)
DROP FUNCTION IF EXISTS notify_gig_completed() CASCADE;

-- Wait a moment to ensure cleanup (PostgreSQL doesn't have sleep, but we can use a dummy query)
DO $$ BEGIN END $$;

-- Now create the function with the CORRECT logic
CREATE OR REPLACE FUNCTION notify_gig_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_poster_name TEXT;
  v_gig_title TEXT;
  v_neighbor_recipient_id UUID;
  v_teen_recipient_id UUID;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL THEN
    -- Get user names
    SELECT full_name INTO v_teen_name FROM public.users WHERE id = NEW.teen_id;
    SELECT full_name INTO v_poster_name FROM public.users WHERE id = NEW.poster_id;
    v_gig_title := NEW.title;
    
    -- CRITICAL: Store recipient IDs IMMEDIATELY in explicit variables
    -- DO NOT use NEW.poster_id or NEW.teen_id after this point
    v_neighbor_recipient_id := NEW.poster_id;
    v_teen_recipient_id := NEW.teen_id;
    
    -- Log for debugging
    RAISE NOTICE '[notify_gig_completed] Gig: %, Teen: % (%), Poster: % (%)', 
      v_gig_title, v_teen_name, v_teen_recipient_id, v_poster_name, v_neighbor_recipient_id;
    
    -- Create notification records
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES 
      (v_neighbor_recipient_id, 'gig_completed', 'Gig Completed! ✅', 
       v_teen_name || ' completed: ' || v_gig_title,
       jsonb_build_object('gig_id', NEW.id, 'amount', NEW.pay, 'teen_id', NEW.teen_id, 'recipient_role', 'neighbor'),
       FALSE),
      (v_teen_recipient_id, 'gig_completed', 'Gig Completed! 💰',
       'You completed: ' || v_gig_title || ' - Payment pending',
       jsonb_build_object('gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'teen'),
       FALSE);
    
    -- Send push notification to NEIGHBOR (poster)
    -- Use v_neighbor_recipient_id - this is the poster_id
    RAISE NOTICE '[notify_gig_completed] Sending to NEIGHBOR: %', v_neighbor_recipient_id;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_neighbor_recipient_id,
        p_title := 'Gig Completed! ✅',
        p_body := v_teen_name || ' completed: ' || v_gig_title,
        p_data := jsonb_build_object('type', 'gig_completed', 'gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'neighbor'),
        p_priority := 'high'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_gig_completed] Error sending to neighbor: %', SQLERRM;
    END;
    
    -- Send push notification to TEEN
    -- Use v_teen_recipient_id - this is the teen_id
    RAISE NOTICE '[notify_gig_completed] Sending to TEEN: %', v_teen_recipient_id;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_teen_recipient_id,
        p_title := 'Gig Completed! 💰',
        p_body := 'You completed: ' || v_gig_title || ' - Payment pending',
        p_data := jsonb_build_object('type', 'gig_completed', 'gig_id', NEW.id, 'amount', NEW.pay, 'recipient_role', 'teen'),
        p_priority := 'high'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_gig_completed] Error sending to teen: %', SQLERRM;
    END;
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

-- Verify the function was created correctly
DO $$
DECLARE
  v_has_variables BOOLEAN;
  v_func_source TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_func_source
  FROM pg_proc
  WHERE proname = 'notify_gig_completed';
  
  IF v_func_source LIKE '%v_neighbor_recipient_id%' AND v_func_source LIKE '%v_teen_recipient_id%' THEN
    RAISE NOTICE 'SUCCESS: Function created with correct variables';
  ELSE
    RAISE WARNING 'WARNING: Function may not have correct variables!';
  END IF;
END $$;


