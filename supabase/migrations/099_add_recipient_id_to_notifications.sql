-- Migration: Add recipient_id to all notification data payloads
-- This allows the app to filter notifications by current user when using the same device for multiple accounts

-- Update notify_gig_started to include recipient_id
CREATE OR REPLACE FUNCTION notify_gig_started()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.teen_id IS NOT NULL THEN
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;
    
    v_gig_title := NEW.title;
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.poster_id,
      p_title := 'Gig Started',
      p_body := v_teen_name || ' started working on: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'gig_started',
        'gig_id', NEW.id,
        'recipient_id', NEW.poster_id
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: notify_gig_completed is already updated in migration 097_debug_notify_gig_completed.sql
-- This migration ensures recipient_id is included in all notification types











