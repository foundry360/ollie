-- Fix: Check if location column exists, if not make location filtering optional
-- If users table doesn't have location column, we can't filter by distance
-- So we'll notify all teenlancers with push tokens (location filtering disabled)

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
  v_has_location_column BOOLEAN := false;
BEGIN
  -- Check if location column exists in users table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'location'
  ) INTO v_has_location_column;

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
    
    -- Notify teenlancers with OneSignal IDs
    -- Location filtering: Only notify users with coordinates AND within radius
    FOR v_teenlancer IN
      SELECT DISTINCT 
        u.id, 
        u.onesignal_user_id,
        u.location,
        COALESCE(u.notification_radius, 25) as radius
      FROM public.users u
      WHERE u.role = 'teen'
        -- User must have OneSignal ID (OneSignal only, no Expo fallback)
        AND u.onesignal_user_id IS NOT NULL 
        AND u.onesignal_user_id != ''
        AND NOT (u.id = ANY(v_notified_users)) -- Skip if already notified in this execution
    LOOP
      -- Location filtering: User MUST have coordinates to receive notifications
      -- If location column doesn't exist or user has no coordinates, skip them
      IF v_has_location_column THEN
        IF v_teenlancer.location IS NULL 
           OR v_teenlancer.location->>'latitude' IS NULL 
           OR v_teenlancer.location->>'longitude' IS NULL THEN
          -- User doesn't have coordinates - skip them (as per requirement)
          CONTINUE;
        END IF;
        
        -- User has coordinates - check distance if gig also has coordinates
        IF v_gig_lat IS NOT NULL AND v_gig_lon IS NOT NULL THEN
          v_user_lat := (v_teenlancer.location->>'latitude')::DOUBLE PRECISION;
          v_user_lon := (v_teenlancer.location->>'longitude')::DOUBLE PRECISION;
          v_radius := v_teenlancer.radius;
          
          v_distance := calculate_distance_miles(v_user_lat, v_user_lon, v_gig_lat, v_gig_lon);
          
          IF v_distance > v_radius THEN
            CONTINUE; -- Skip this user (too far)
          END IF;
        END IF;
      ELSE
        -- Location column doesn't exist - notify all users (fallback)
        -- This shouldn't happen if migration 101 was applied
      END IF;
      
      -- ADDITIONAL DEDUPLICATION: Check if notification already exists before calling send_push_notification
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

