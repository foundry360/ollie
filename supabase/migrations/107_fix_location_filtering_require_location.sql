-- Fix: Require location for teenlancers - only notify if they have coordinates AND are within radius
-- Current issue: Users without location are still getting notifications

CREATE OR REPLACE FUNCTION notify_new_gig_created()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
  v_teenlancer RECORD;
  v_trigger_log_id UUID;
  v_already_processed BOOLEAN := false;
  v_notified_users UUID[] := ARRAY[]::UUID[]; -- Track which users we've already notified
  v_gig_lat DOUBLE PRECISION;
  v_gig_lon DOUBLE PRECISION;
  v_user_lat DOUBLE PRECISION;
  v_user_lon DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
  v_distance DOUBLE PRECISION;
  v_dedupe_hash TEXT;
  v_existing_notification_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    -- Check if we've already processed this gig
    SELECT EXISTS (
      SELECT 1 FROM public.notification_trigger_log
      WHERE trigger_name = 'notify_new_gig_created'
        AND gig_id = NEW.id
    ) INTO v_already_processed;
    
    IF v_already_processed THEN
      RAISE NOTICE '[notify_new_gig_created] Already processed gig %, skipping', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Try to insert trigger log
    BEGIN
      INSERT INTO public.notification_trigger_log (trigger_name, gig_id, executed_at)
      VALUES ('notify_new_gig_created', NEW.id, NOW())
      RETURNING id INTO v_trigger_log_id;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE '[notify_new_gig_created] Trigger log insert failed - gig % already processed, skipping', NEW.id;
        RETURN NEW;
      WHEN OTHERS THEN
        RAISE WARNING '[notify_new_gig_created] Error inserting trigger log: %', SQLERRM;
        RETURN NEW;
    END;
    
    v_gig_title := NEW.title;
    
    -- Extract gig location
    v_gig_lat := (NEW.location->>'latitude')::DOUBLE PRECISION;
    v_gig_lon := (NEW.location->>'longitude')::DOUBLE PRECISION;
    
    -- CRITICAL: Only notify teenlancers who have a location AND are within radius
    -- Skip users without location coordinates
    FOR v_teenlancer IN
      SELECT DISTINCT 
        u.id, 
        u.expo_push_token,
        u.onesignal_user_id,
        u.location,
        COALESCE(u.notification_radius, 25) as radius
      FROM public.users u
      WHERE u.role = 'teen'
        -- User must have at least one push token (Expo OR OneSignal)
        AND (u.expo_push_token IS NOT NULL AND u.expo_push_token != '' 
             OR u.onesignal_user_id IS NOT NULL AND u.onesignal_user_id != '')
        -- CRITICAL: User MUST have location coordinates
        AND u.location IS NOT NULL
        AND u.location->>'latitude' IS NOT NULL
        AND u.location->>'longitude' IS NOT NULL
        AND NOT (u.id = ANY(v_notified_users)) -- Skip if already notified in this execution
    LOOP
      -- Location filtering - REQUIRED: Both gig and user must have valid coordinates
      IF v_gig_lat IS NOT NULL AND v_gig_lon IS NOT NULL THEN
        v_user_lat := (v_teenlancer.location->>'latitude')::DOUBLE PRECISION;
        v_user_lon := (v_teenlancer.location->>'longitude')::DOUBLE PRECISION;
        v_radius := v_teenlancer.radius;
        
        v_distance := calculate_distance_miles(v_user_lat, v_user_lon, v_gig_lat, v_gig_lon);
        
        IF v_distance > v_radius THEN
          CONTINUE; -- Skip this user (too far)
        END IF;
      ELSE
        -- Gig doesn't have valid coordinates, skip
        CONTINUE;
      END IF;
      
      -- ADDITIONAL DEDUPLICATION: Check if notification already exists before calling send_push_notification
      -- This prevents the trigger from calling send_push_notification if a notification already exists
      v_dedupe_hash := MD5(v_teenlancer.id::TEXT || '|' || 'new_gig_available' || '|' || NEW.id::TEXT);
      
      SELECT id INTO v_existing_notification_id
      FROM public.notifications
      WHERE dedupe_hash = v_dedupe_hash
      LIMIT 1;
      
      -- If notification already exists, skip this user
      IF v_existing_notification_id IS NOT NULL THEN
        RAISE NOTICE '[notify_new_gig_created] Notification already exists for user % and gig %, skipping', v_teenlancer.id, NEW.id;
        CONTINUE;
      END IF;
      
      -- CRITICAL: Mark this user as notified BEFORE calling send_push_notification
      v_notified_users := array_append(v_notified_users, v_teenlancer.id);
      
      -- Send notification to each teenlancer
      -- The send_push_notification function will handle its own deduplication
      PERFORM send_push_notification(
        p_recipient_id := v_teenlancer.id,
        p_title := 'New Gig Available',
        p_body := v_gig_title || ' - $' || NEW.pay,
        p_data := jsonb_build_object(
          'type', 'new_gig_available',
          'gig_id', NEW.id,
          'poster_id', NEW.poster_id,
          'pay', NEW.pay
        ),
        p_priority := 'default'
      );
    END LOOP;
    
    RAISE NOTICE '[notify_new_gig_created] Notified % teenlancers about new gig: %', array_length(v_notified_users, 1), v_gig_title;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

