-- Migration: Fix profile completion notification clearing
-- Ensures that "Complete your profile" notifications are deleted when profile is completed,
-- regardless of whether they've been read or not

-- ============================================================================
-- FUNCTION: Notify when profile is completed (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_profile_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_has_photo BOOLEAN;
  v_has_bio BOOLEAN;
  v_has_address BOOLEAN;
  v_is_complete BOOLEAN;
  v_previous_photo TEXT;
  v_previous_bio TEXT;
  v_previous_address TEXT;
  v_was_complete BOOLEAN;
BEGIN
  -- Check current state
  v_has_photo := NEW.profile_photo_url IS NOT NULL AND NEW.profile_photo_url != '';
  v_has_bio := NEW.bio IS NOT NULL AND NEW.bio != '';
  v_has_address := NEW.address IS NOT NULL AND NEW.address != '';
  
  -- Get previous values
  v_previous_photo := OLD.profile_photo_url;
  v_previous_bio := OLD.bio;
  v_previous_address := OLD.address;
  
  -- Check if profile was complete before
  v_was_complete := (v_previous_photo IS NOT NULL AND v_previous_photo != '')
                 AND (v_previous_bio IS NOT NULL AND v_previous_bio != '')
                 AND (v_previous_address IS NOT NULL AND v_previous_address != '');
  
  -- Profile is complete if it has photo, bio, and address
  v_is_complete := v_has_photo AND v_has_bio AND v_has_address;
  
  -- Notify when profile becomes fully complete (all three fields)
  IF v_is_complete AND NOT v_was_complete THEN
    -- Delete any incomplete profile notifications since they've now completed it
    -- FIX: Delete regardless of read status to ensure notification clears from UI
    DELETE FROM public.notifications
    WHERE user_id = NEW.id
      AND type = 'profile_incomplete';
    
    -- Check if notification already exists for this milestone
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.id
        AND type = 'profile_completed'
        AND read = FALSE
    ) THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data,
        read
      ) VALUES (
        NEW.id,
        'profile_completed',
        'Profile Completed! ✅',
        'Your profile is now complete with photo, bio, and address',
        jsonb_build_object(
          'user_id', NEW.id,
          'role', NEW.role
        ),
        FALSE
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Notify users to complete their profile (ENHANCED)
-- ============================================================================
-- Also ensure we delete incomplete notifications when profile becomes complete
CREATE OR REPLACE FUNCTION notify_profile_incomplete()
RETURNS TRIGGER AS $$
DECLARE
  v_has_photo BOOLEAN;
  v_has_bio BOOLEAN;
  v_has_address BOOLEAN;
  v_is_complete BOOLEAN;
  v_missing_items TEXT[];
  v_message TEXT;
BEGIN
  -- Check current state
  v_has_photo := NEW.profile_photo_url IS NOT NULL AND NEW.profile_photo_url != '';
  v_has_bio := NEW.bio IS NOT NULL AND NEW.bio != '';
  v_has_address := NEW.address IS NOT NULL AND NEW.address != '';
  
  -- Profile is complete if it has photo, bio, and address
  v_is_complete := v_has_photo AND v_has_bio AND v_has_address;
  
  -- Always delete existing incomplete notifications when profile is updated
  -- This ensures we update the notification even if profile becomes complete
  -- FIX: Delete regardless of read status
  DELETE FROM public.notifications
  WHERE user_id = NEW.id
    AND type = 'profile_incomplete';
  
  -- Only notify if profile is incomplete
  IF NOT v_is_complete THEN
    -- Build list of missing items
    v_missing_items := ARRAY[]::TEXT[];
    IF NOT v_has_photo THEN
      v_missing_items := array_append(v_missing_items, 'profile photo');
    END IF;
    IF NOT v_has_bio THEN
      v_missing_items := array_append(v_missing_items, 'bio');
    END IF;
    IF NOT v_has_address THEN
      v_missing_items := array_append(v_missing_items, 'address');
    END IF;
    
    -- Build message based on what's missing
    IF array_length(v_missing_items, 1) = 3 THEN
      v_message := 'Add a profile photo, bio, and address to complete your profile';
    ELSIF array_length(v_missing_items, 1) = 2 THEN
      v_message := 'Add your ' || array_to_string(v_missing_items, ' and ') || ' to complete your profile';
    ELSE
      v_message := 'Add your ' || v_missing_items[1] || ' to complete your profile';
    END IF;
    
    -- Create new notification
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      read
    ) VALUES (
      NEW.id,
      'profile_incomplete',
      'Complete Your Profile 📝',
      v_message,
      jsonb_build_object(
        'user_id', NEW.id,
        'role', NEW.role,
        'missing_items', v_missing_items
      ),
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLEANUP: Delete incomplete profile notifications for users who have completed profiles
-- ============================================================================
-- This ensures that any existing incomplete notifications are cleared for users
-- who have already completed their profiles (one-time cleanup)
DELETE FROM public.notifications
WHERE type = 'profile_incomplete'
  AND user_id IN (
    SELECT id FROM public.users
    WHERE profile_photo_url IS NOT NULL 
      AND profile_photo_url != ''
      AND bio IS NOT NULL 
      AND bio != ''
      AND address IS NOT NULL 
      AND address != ''
  );
