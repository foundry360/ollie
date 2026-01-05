-- Migration: Create notification record when gig is completed
-- This ensures neighbors see a notification in their notification bell when a gig is completed

-- Update notify_gig_completed function to create notification records
-- Assumes notifications table already exists
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
    
    -- Log that we're attempting to send notifications
    RAISE NOTICE '=== GIG COMPLETED TRIGGER FIRED ===';
    RAISE NOTICE 'Gig: % (ID: %)', v_gig_title, NEW.id;
    RAISE NOTICE 'Teen: % (ID: %)', v_teen_name, NEW.teen_id;
    RAISE NOTICE 'Poster: % (ID: %)', v_poster_name, NEW.poster_id;
    
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
    -- Using standard notification table structure
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      read
    ) VALUES (
      NEW.poster_id,
      'gig_completed',
      'Gig Completed! ✅',
      v_teen_name || ' completed: ' || v_gig_title,
      jsonb_build_object(
        'gig_id', NEW.id,
        'amount', NEW.pay,
        'teen_id', NEW.teen_id
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
      NEW.teen_id,
      'gig_completed',
      'Gig Completed! 💰',
      'You completed: ' || v_gig_title || ' - Payment pending',
      jsonb_build_object(
        'gig_id', NEW.id,
        'amount', NEW.pay
      ),
      FALSE
    );
    
    -- Store recipient IDs in explicit variables to prevent any confusion
    v_neighbor_recipient_id := NEW.poster_id;
    v_teen_recipient_id := NEW.teen_id;
    
    -- Notify neighbor via push notification
    RAISE NOTICE '=== SENDING NOTIFICATION TO NEIGHBOR ===';
    RAISE NOTICE 'Recipient ID: % (poster_id, stored in v_neighbor_recipient_id)', v_neighbor_recipient_id;
    RAISE NOTICE 'Title: Gig Completed! ✅';
    RAISE NOTICE 'Body: % completed: %', v_teen_name, v_gig_title;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_neighbor_recipient_id,
        p_title := 'Gig Completed! ✅',
        p_body := v_teen_name || ' completed: ' || v_gig_title,
        p_data := jsonb_build_object(
          'type', 'gig_completed',
          'gig_id', NEW.id,
          'amount', NEW.pay,
          'recipient_role', 'neighbor'
        ),
        p_priority := 'high'
      );
      RAISE NOTICE 'send_push_notification() completed for neighbor %', v_neighbor_recipient_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Exception sending push notification to neighbor %: % (SQLSTATE: %)', v_neighbor_recipient_id, SQLERRM, SQLSTATE;
    END;
    
    -- Notify teen via push notification
    RAISE NOTICE '=== SENDING NOTIFICATION TO TEEN ===';
    RAISE NOTICE 'Recipient ID: % (teen_id, stored in v_teen_recipient_id)', v_teen_recipient_id;
    RAISE NOTICE 'Title: Gig Completed! 💰';
    RAISE NOTICE 'Body: You completed: % - Payment pending', v_gig_title;
    BEGIN
      PERFORM send_push_notification(
        p_recipient_id := v_teen_recipient_id,
        p_title := 'Gig Completed! 💰',
        p_body := 'You completed: ' || v_gig_title || ' - Payment pending',
        p_data := jsonb_build_object(
          'type', 'gig_completed',
          'gig_id', NEW.id,
          'amount', NEW.pay,
          'recipient_role', 'teen'
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
