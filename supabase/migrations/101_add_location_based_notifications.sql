-- Add location-based filtering for push notifications
-- This allows teenlancers to only receive notifications for gigs within a certain radius

-- 1. Add location field to users table (optional - for users who want location-based notifications)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS location JSONB; -- {latitude: number, longitude: number}

-- 2. Add notification_radius preference (default 25 miles, same as "Gigs Near You")
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notification_radius INTEGER DEFAULT 25; -- radius in miles

-- 3. Create PostgreSQL function to calculate distance using Haversine formula
-- Returns distance in miles
CREATE OR REPLACE FUNCTION calculate_distance_miles(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  R DOUBLE PRECISION := 3959; -- Earth's radius in miles
  dLat DOUBLE PRECISION;
  dLon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  -- Convert degrees to radians
  dLat := RADIANS(lat2 - lat1);
  dLon := RADIANS(lon2 - lon1);
  
  -- Haversine formula
  a := SIN(dLat / 2) * SIN(dLat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dLon / 2) * SIN(dLon / 2);
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Update notify_new_gig_created to filter by location
CREATE OR REPLACE FUNCTION notify_new_gig_created()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
  v_teenlancer RECORD;
  v_trigger_log_id UUID;
  v_already_processed BOOLEAN := false;
  v_gig_lat DOUBLE PRECISION;
  v_gig_lon DOUBLE PRECISION;
  v_user_lat DOUBLE PRECISION;
  v_user_lon DOUBLE PRECISION;
  v_distance DOUBLE PRECISION;
  v_radius INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    -- Log trigger call
    INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, message)
    VALUES ('notify_new_gig_created', 'trigger_called', NEW.id, 'Trigger fired for gig: ' || NEW.id);
    
    -- CRITICAL: Check if we've already processed this gig
    SELECT EXISTS (
      SELECT 1 FROM public.notification_trigger_log
      WHERE trigger_name = 'notify_new_gig_created'
        AND gig_id = NEW.id
    ) INTO v_already_processed;
    
    IF v_already_processed THEN
      INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, message)
      VALUES ('notify_new_gig_created', 'already_processed', NEW.id, 'Gig already processed, skipping');
      RAISE NOTICE '[notify_new_gig_created] Already processed gig %, skipping', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Try to insert trigger log - this will fail if another transaction already inserted it
    BEGIN
      INSERT INTO public.notification_trigger_log (trigger_name, gig_id, executed_at)
      VALUES ('notify_new_gig_created', NEW.id, NOW())
      RETURNING id INTO v_trigger_log_id;
      
      -- Log successful trigger log insert
      INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, message, data)
      VALUES ('notify_new_gig_created', 'trigger_log_insert_success', NEW.id, 'Trigger log inserted successfully', jsonb_build_object('trigger_log_id', v_trigger_log_id));
    EXCEPTION
      WHEN unique_violation THEN
        -- Another transaction already processed this gig
        INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, message)
        VALUES ('notify_new_gig_created', 'trigger_log_insert_failed', NEW.id, 'Trigger log insert failed - duplicate, skipping');
        RAISE NOTICE '[notify_new_gig_created] Trigger log insert failed - gig % already processed, skipping', NEW.id;
        RETURN NEW;
      WHEN OTHERS THEN
        -- Unexpected error - log and skip to be safe
        INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, message, data)
        VALUES ('notify_new_gig_created', 'trigger_log_insert_error', NEW.id, 'Error inserting trigger log: ' || SQLERRM, jsonb_build_object('error', SQLERRM));
        RAISE WARNING '[notify_new_gig_created] Error inserting trigger log: %', SQLERRM;
        RETURN NEW;
    END;
    
    v_gig_title := NEW.title;
    
    -- Extract gig location
    v_gig_lat := (NEW.location->>'latitude')::DOUBLE PRECISION;
    v_gig_lon := (NEW.location->>'longitude')::DOUBLE PRECISION;
    
    -- Notify teenlancers who have push tokens
    -- Filter by location if user has location set, otherwise notify all
    FOR v_teenlancer IN
      SELECT DISTINCT 
        u.id, 
        u.expo_push_token,
        u.location,
        COALESCE(u.notification_radius, 25) as radius
      FROM public.users u
      WHERE u.role = 'teen'
        AND u.expo_push_token IS NOT NULL
        AND u.expo_push_token != ''
    LOOP
      -- Check location if both gig and user have location data
      IF v_gig_lat IS NOT NULL AND v_gig_lon IS NOT NULL 
         AND v_teenlancer.location IS NOT NULL 
         AND v_teenlancer.location->>'latitude' IS NOT NULL 
         AND v_teenlancer.location->>'longitude' IS NOT NULL THEN
        
        -- Extract user location
        v_user_lat := (v_teenlancer.location->>'latitude')::DOUBLE PRECISION;
        v_user_lon := (v_teenlancer.location->>'longitude')::DOUBLE PRECISION;
        v_radius := v_teenlancer.radius;
        
        -- Calculate distance
        v_distance := calculate_distance_miles(v_user_lat, v_user_lon, v_gig_lat, v_gig_lon);
        
        -- Only notify if within radius
        IF v_distance > v_radius THEN
          -- Log skipped notification due to distance
          INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, user_id, message, data)
          VALUES ('notify_new_gig_created', 'skipped_too_far', NEW.id, v_teenlancer.id, 
                  'User too far from gig', 
                  jsonb_build_object('distance', ROUND(v_distance, 2), 'radius', v_radius));
          CONTINUE; -- Skip this user
        END IF;
      END IF;
      
      -- Log before calling send_push_notification
      INSERT INTO public.notification_debug_log (function_name, event_type, gig_id, user_id, message)
      VALUES ('notify_new_gig_created', 'calling_send_push', NEW.id, v_teenlancer.id, 'About to call send_push_notification for user: ' || v_teenlancer.id);
      
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
    
    RAISE NOTICE '[notify_new_gig_created] Notified teenlancers about new gig: %', v_gig_title;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create index on users.location for performance (if using GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users USING GIN (location);

-- 6. Add comment explaining the feature
COMMENT ON COLUMN public.users.location IS 'User location for location-based push notifications. Format: {"latitude": number, "longitude": number}';
COMMENT ON COLUMN public.users.notification_radius IS 'Maximum distance (in miles) for location-based push notifications. Default: 25 miles.';


