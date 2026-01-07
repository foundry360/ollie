-- Migration: Add bell notifications for onboarding milestones
-- Creates notifications when users complete profile, add payment methods, or set up bank accounts

-- ============================================================================
-- CREATE NOTIFICATIONS TABLE (if it doesn't exist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policy: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policy: Allow system to insert notifications (for triggers)
-- Triggers use SECURITY DEFINER, but we still need an INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- FUNCTION: Notify users to complete their profile
-- ============================================================================
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
-- FUNCTION: Notify when profile is completed
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
    DELETE FROM public.notifications
    WHERE user_id = NEW.id
      AND type = 'profile_incomplete'
      AND read = FALSE;
    
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
-- FUNCTION: Notify when payment method is added (first time)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_payment_method_added()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_method_count INTEGER;
BEGIN
  -- Count total payment methods for this user
  SELECT COUNT(*) INTO v_payment_method_count
  FROM public.payment_methods
  WHERE user_id = NEW.user_id;
  
  -- Only notify if this is the first payment method
  IF v_payment_method_count = 1 THEN
    -- Check if notification already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.user_id
        AND type = 'payment_method_setup'
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
        NEW.user_id,
        'payment_method_setup',
        'Payment Method Added! 💳',
        'Your payment method has been successfully added',
        jsonb_build_object(
          'payment_method_id', NEW.id,
          'stripe_payment_method_id', NEW.stripe_payment_method_id,
          'is_default', NEW.is_default
        ),
        FALSE
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Notify when bank account is verified
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_bank_account_verified()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when bank account status changes to 'verified'
  IF NEW.verification_status = 'verified' 
     AND (OLD.verification_status IS NULL OR OLD.verification_status != 'verified')
     AND NEW.verified_at IS NOT NULL THEN
    -- Check if notification already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.user_id
        AND type = 'bank_account_setup'
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
        NEW.user_id,
        'bank_account_setup',
        'Bank Account Verified! 🏦',
        'Your bank account has been verified and is ready to receive payments',
        jsonb_build_object(
          'bank_account_id', NEW.id,
          'account_type', NEW.account_type,
          'account_number_last4', NEW.account_number_last4,
          'bank_name', NEW.bank_name
        ),
        FALSE
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Profile incomplete reminder trigger (fires on INSERT and UPDATE)
DROP TRIGGER IF EXISTS on_profile_incomplete_notify ON public.users;
CREATE TRIGGER on_profile_incomplete_notify
  AFTER INSERT OR UPDATE OF profile_photo_url, bio, address ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_incomplete();

-- Profile completion trigger (fires when profile becomes complete)
DROP TRIGGER IF EXISTS on_profile_completed_notify ON public.users;
CREATE TRIGGER on_profile_completed_notify
  AFTER UPDATE OF profile_photo_url, bio, address ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_completed();

-- Payment method added trigger
DROP TRIGGER IF EXISTS on_payment_method_added_notify ON public.payment_methods;
CREATE TRIGGER on_payment_method_added_notify
  AFTER INSERT ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_method_added();

-- Bank account verified trigger
DROP TRIGGER IF EXISTS on_bank_account_verified_notify ON public.bank_accounts;
CREATE TRIGGER on_bank_account_verified_notify
  AFTER UPDATE OF verification_status, verified_at ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION notify_bank_account_verified();

-- ============================================================================
-- BACKFILL: Create notifications for existing users with incomplete profiles
-- ============================================================================
-- This function creates notifications for users who already exist with incomplete profiles
DO $$
DECLARE
  v_user RECORD;
  v_has_photo BOOLEAN;
  v_has_bio BOOLEAN;
  v_has_address BOOLEAN;
  v_is_complete BOOLEAN;
  v_missing_items TEXT[];
  v_message TEXT;
BEGIN
  -- Loop through all users
  FOR v_user IN SELECT id, profile_photo_url, bio, address, role FROM public.users
  LOOP
    -- Check current state
    v_has_photo := v_user.profile_photo_url IS NOT NULL AND v_user.profile_photo_url != '';
    v_has_bio := v_user.bio IS NOT NULL AND v_user.bio != '';
    v_has_address := v_user.address IS NOT NULL AND v_user.address != '';
    
    -- Profile is complete if it has photo, bio, and address
    v_is_complete := v_has_photo AND v_has_bio AND v_has_address;
    
    -- Only create notification if profile is incomplete
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
      
      -- Delete any existing incomplete profile notifications for this user first
      DELETE FROM public.notifications
      WHERE user_id = v_user.id
        AND type = 'profile_incomplete';
      
      -- Then create the notification
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data,
        read
      ) VALUES (
        v_user.id,
        'profile_incomplete',
        'Complete Your Profile 📝',
        v_message,
        jsonb_build_object(
          'user_id', v_user.id,
          'role', v_user.role,
          'missing_items', v_missing_items
        ),
        FALSE
      );
    END IF;
  END LOOP;
END $$;

