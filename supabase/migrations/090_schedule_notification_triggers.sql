-- Migration: Add push notification triggers for schedule confirmations and proposals
-- This migration creates triggers that send push notifications when schedule events occur

-- ============================================================================
-- FUNCTION: Notify when schedule is confirmed
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_schedule_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_poster_name TEXT;
  v_teen_name TEXT;
  v_gig_title TEXT;
  v_poster_id UUID;
BEGIN
  -- Only trigger when schedule_confirmed changes from false to true
  IF NEW.schedule_confirmed = TRUE AND (OLD.schedule_confirmed IS NULL OR OLD.schedule_confirmed = FALSE) THEN
    -- Get poster's name
    SELECT full_name INTO v_poster_name
    FROM public.users
    WHERE id = NEW.poster_id;

    -- Get teen's name
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;

    -- Get gig title
    v_gig_title := NEW.title;
    v_poster_id := NEW.poster_id;

    -- Notify neighbor that teenlancer confirmed the schedule
    PERFORM send_push_notification(
      p_recipient_id := v_poster_id,
      p_title := 'Schedule Confirmed ✅',
      p_body := v_teen_name || ' confirmed the schedule for: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'schedule_confirmed',
        'gig_id', NEW.id,
        'teen_id', NEW.teen_id
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Notify when teenlancer proposes schedule changes
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_schedule_proposed()
RETURNS TRIGGER AS $$
DECLARE
  v_poster_name TEXT;
  v_teen_name TEXT;
  v_gig_title TEXT;
  v_poster_id UUID;
BEGIN
  -- Only trigger when proposed schedule is set (and wasn't set before)
  IF NEW.proposed_scheduled_date IS NOT NULL 
     AND (OLD.proposed_scheduled_date IS NULL OR OLD.proposed_scheduled_date IS DISTINCT FROM NEW.proposed_scheduled_date) THEN
    -- Get poster's name
    SELECT full_name INTO v_poster_name
    FROM public.users
    WHERE id = NEW.poster_id;

    -- Get teen's name
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;

    -- Get gig title
    v_gig_title := NEW.title;
    v_poster_id := NEW.poster_id;

    -- Notify neighbor that teenlancer proposed a schedule change
    PERFORM send_push_notification(
      p_recipient_id := v_poster_id,
      p_title := 'Schedule Change Proposed 📅',
      p_body := v_teen_name || ' proposed a different schedule for: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'schedule_proposed',
        'gig_id', NEW.id,
        'teen_id', NEW.teen_id,
        'proposed_date', NEW.proposed_scheduled_date,
        'proposed_start_time', NEW.proposed_scheduled_start_time,
        'proposed_end_time', NEW.proposed_scheduled_end_time
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Notify when neighbor accepts proposed schedule
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_proposed_schedule_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_poster_name TEXT;
  v_teen_name TEXT;
  v_gig_title TEXT;
  v_teen_id UUID;
BEGIN
  -- Only trigger when proposed schedule is cleared (accepted) and schedule_confirmed is set to true
  IF (OLD.proposed_scheduled_date IS NOT NULL AND NEW.proposed_scheduled_date IS NULL)
     AND NEW.schedule_confirmed = TRUE
     AND (OLD.schedule_confirmed IS NULL OR OLD.schedule_confirmed = FALSE) THEN
    -- Get poster's name
    SELECT full_name INTO v_poster_name
    FROM public.users
    WHERE id = NEW.poster_id;

    -- Get teen's name
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;

    -- Get gig title
    v_gig_title := NEW.title;
    v_teen_id := NEW.teen_id;

    -- Notify teenlancer that neighbor accepted their proposed schedule
    PERFORM send_push_notification(
      p_recipient_id := v_teen_id,
      p_title := 'Schedule Accepted! ✅',
      p_body := v_poster_name || ' accepted your proposed schedule for: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'proposed_schedule_accepted',
        'gig_id', NEW.id,
        'poster_id', NEW.poster_id
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Schedule confirmed trigger
DROP TRIGGER IF EXISTS on_schedule_confirmed_notify ON public.gigs;
CREATE TRIGGER on_schedule_confirmed_notify
  AFTER UPDATE OF schedule_confirmed ON public.gigs
  FOR EACH ROW
  WHEN (NEW.schedule_confirmed = TRUE AND (OLD.schedule_confirmed IS NULL OR OLD.schedule_confirmed = FALSE))
  EXECUTE FUNCTION notify_schedule_confirmed();

-- Schedule proposed trigger
DROP TRIGGER IF EXISTS on_schedule_proposed_notify ON public.gigs;
CREATE TRIGGER on_schedule_proposed_notify
  AFTER UPDATE OF proposed_scheduled_date ON public.gigs
  FOR EACH ROW
  WHEN (NEW.proposed_scheduled_date IS NOT NULL 
        AND (OLD.proposed_scheduled_date IS NULL OR OLD.proposed_scheduled_date IS DISTINCT FROM NEW.proposed_scheduled_date))
  EXECUTE FUNCTION notify_schedule_proposed();

-- Proposed schedule accepted trigger
DROP TRIGGER IF EXISTS on_proposed_schedule_accepted_notify ON public.gigs;
CREATE TRIGGER on_proposed_schedule_accepted_notify
  AFTER UPDATE ON public.gigs
  FOR EACH ROW
  WHEN (
    (OLD.proposed_scheduled_date IS NOT NULL AND NEW.proposed_scheduled_date IS NULL)
    AND NEW.schedule_confirmed = TRUE
    AND (OLD.schedule_confirmed IS NULL OR OLD.schedule_confirmed = FALSE)
  )
  EXECUTE FUNCTION notify_proposed_schedule_accepted();

