-- Migration: Add push notification triggers for all user events
-- This migration creates triggers that send push notifications via Edge Function
-- when important events occur (gig status changes, messages, payments, etc.)

-- Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- CONFIGURATION TABLE: Store Supabase URL and Service Role Key
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_notification_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.push_notification_config ENABLE ROW LEVEL SECURITY;

-- Allow SECURITY DEFINER functions to read config
DROP POLICY IF EXISTS "Allow config read for functions" ON public.push_notification_config;
CREATE POLICY "Allow config read for functions" ON public.push_notification_config
  FOR SELECT USING (true);

-- Insert default config (you'll need to update these values after running migration)
INSERT INTO public.push_notification_config (id, supabase_url, service_role_key)
VALUES (
  'default',
  'https://your-project.supabase.co',  -- Replace with your Supabase URL
  'YOUR_SERVICE_ROLE_KEY_HERE'         -- Replace with your service role key
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION: Send Push Notification via Edge Function
-- ============================================================================
CREATE OR REPLACE FUNCTION send_push_notification(
  p_recipient_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB,
  p_priority TEXT DEFAULT 'default',
  p_badge INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- Get Supabase configuration from config table
  SELECT supabase_url, service_role_key INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default'
  LIMIT 1;
  
  -- Skip if not configured
  IF v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
    RAISE WARNING 'Push notification config not set. Update public.push_notification_config table.';
    RETURN;
  END IF;
  
  IF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RAISE WARNING 'Push notification service_role_key not configured properly.';
    RETURN;
  END IF;
  
  -- Construct Edge Function URL
  v_function_url := v_config.supabase_url || '/functions/v1/send-push-notification';
  
  RAISE NOTICE 'Sending push notification to % via %', p_recipient_id, v_function_url;
  
  -- Call Edge Function asynchronously
  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_config.service_role_key,
        'apikey', v_config.service_role_key
      ),
      body := jsonb_build_object(
        'recipient_id', p_recipient_id,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'priority', p_priority,
        'badge', p_badge
      )
    ) INTO v_response_id;
    
    RAISE NOTICE 'Push notification request sent. Request ID: %', v_response_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error calling net.http_post: %', SQLERRM;
      RAISE;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error sending push notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR GIGS/TASKS
-- ============================================================================

-- 1. Gig Assigned (notify neighbor when teenlancer is assigned)
-- Note: Teen notification is handled by notify_application_approved() trigger
-- This only notifies the neighbor when a gig is assigned
CREATE OR REPLACE FUNCTION notify_gig_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'assigned' AND OLD.status != 'assigned' AND NEW.teen_id IS NOT NULL THEN
    -- Get teen's name
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;
    
    v_gig_title := NEW.title;
    
    -- Notify neighbor (poster) that their gig was assigned
    PERFORM send_push_notification(
      p_recipient_id := NEW.poster_id,
      p_title := 'Gig Assigned! 🎉',
      p_body := v_teen_name || ' was assigned to your gig: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'gig_assigned',
        'gig_id', NEW.id,
        'teen_id', NEW.teen_id
      ),
      p_priority := 'high'
    );
    
    -- Note: Teen notification is sent by notify_application_approved() trigger
    -- when the application status changes to 'approved', so we don't send it here
    -- to avoid duplicate notifications
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1b. Gig Accepted (notify neighbor) - Legacy support for direct acceptance
CREATE OR REPLACE FUNCTION notify_gig_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.teen_id IS NOT NULL THEN
    -- Get teen's name
    SELECT full_name INTO v_teen_name
    FROM public.users
    WHERE id = NEW.teen_id;
    
    v_gig_title := NEW.title;
    
    -- Notify neighbor (poster) that their gig was accepted
    PERFORM send_push_notification(
      p_recipient_id := NEW.poster_id,
      p_title := 'Gig Accepted! 🎉',
      p_body := v_teen_name || ' accepted your gig: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'gig_accepted',
        'gig_id', NEW.id,
        'teen_id', NEW.teen_id
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Gig Started (notify neighbor)
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
        'gig_id', NEW.id
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Gig Completed (notify both)
CREATE OR REPLACE FUNCTION notify_gig_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_teen_name TEXT;
  v_poster_name TEXT;
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL THEN
    SELECT full_name INTO v_teen_name FROM public.users WHERE id = NEW.teen_id;
    SELECT full_name INTO v_poster_name FROM public.users WHERE id = NEW.poster_id;
    v_gig_title := NEW.title;
    
    -- Notify neighbor
    PERFORM send_push_notification(
      p_recipient_id := NEW.poster_id,
      p_title := 'Gig Completed! ✅',
      p_body := v_teen_name || ' completed: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'gig_completed',
        'gig_id', NEW.id,
        'amount', NEW.pay
      ),
      p_priority := 'high'
    );
    
    -- Notify teen
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Gig Completed! 💰',
      p_body := 'You completed: ' || v_gig_title || ' - Payment pending',
      p_data := jsonb_build_object(
        'type', 'gig_completed',
        'gig_id', NEW.id,
        'amount', NEW.pay
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Gig Cancelled (notify affected party)
CREATE OR REPLACE FUNCTION notify_gig_cancelled()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
  v_other_user_id UUID;
  v_other_user_name TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    v_gig_title := NEW.title;
    
    -- Notify the other party (if gig was accepted)
    IF NEW.teen_id IS NOT NULL THEN
      -- Notify teen
      PERFORM send_push_notification(
        p_recipient_id := NEW.teen_id,
        p_title := 'Gig Cancelled',
        p_body := 'The gig "' || v_gig_title || '" was cancelled',
        p_data := jsonb_build_object(
          'type', 'gig_cancelled',
          'gig_id', NEW.id
        ),
        p_priority := 'default'
      );
    END IF;
    
    -- Always notify poster
    PERFORM send_push_notification(
      p_recipient_id := NEW.poster_id,
      p_title := 'Gig Cancelled',
      p_body := 'Your gig "' || v_gig_title || '" was cancelled',
      p_data := jsonb_build_object(
        'type', 'gig_cancelled',
        'gig_id', NEW.id
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR PARENT APPROVALS
-- ============================================================================

-- 5. Parent Approval Needed (notify teen)
CREATE OR REPLACE FUNCTION notify_parent_approval_needed()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'pending' AND TG_OP = 'INSERT' THEN
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Parent Approval Needed',
      p_body := 'Waiting for parent approval: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'parent_approval_needed',
        'approval_id', NEW.id,
        'gig_id', NEW.gig_id
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Parent Approved (notify teen)
CREATE OR REPLACE FUNCTION notify_parent_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Parent Approved! ✅',
      p_body := 'You can now start: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'parent_approved',
        'approval_id', NEW.id,
        'gig_id', NEW.gig_id
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Parent Rejected (notify teen)
CREATE OR REPLACE FUNCTION notify_parent_rejected()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
  v_reason TEXT;
BEGIN
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    v_reason := COALESCE(NEW.reason, 'No reason provided');
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Parent Rejected Gig',
      p_body := 'Your parent rejected: ' || v_gig_title || '. Reason: ' || v_reason,
      p_data := jsonb_build_object(
        'type', 'parent_rejected',
        'approval_id', NEW.id,
        'gig_id', NEW.gig_id,
        'reason', v_reason
      ),
      p_priority := 'default'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR MESSAGES
-- ============================================================================

-- 8. New Message (notify recipient)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_gig_title TEXT;
  v_unread_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get sender's name
    SELECT full_name INTO v_sender_name
    FROM public.users
    WHERE id = NEW.sender_id;
    
    -- Get gig title
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    -- Get unread message count for badge
    SELECT COUNT(*) INTO v_unread_count
    FROM public.messages
    WHERE recipient_id = NEW.recipient_id
      AND read = false;
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.recipient_id,
      p_title := 'New Message from ' || COALESCE(v_sender_name, 'Someone'),
      p_body := NEW.content,
      p_data := jsonb_build_object(
        'type', 'new_message',
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'gig_id', NEW.gig_id,
        'gig_title', v_gig_title
      ),
      p_priority := 'high',
      p_badge := v_unread_count
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR EARNINGS/PAYMENTS
-- ============================================================================

-- 9. Payment Received (notify teen)
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.paid_at IS NOT NULL THEN
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Payment Received! 💰',
      p_body := 'You received $' || NEW.amount || ' for: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'payment_received',
        'earning_id', NEW.id,
        'gig_id', NEW.gig_id,
        'amount', NEW.amount
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR GIG APPLICATIONS
-- ============================================================================

-- 10. Application Approved (notify teenlancer)
CREATE OR REPLACE FUNCTION notify_application_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_gig_title TEXT;
  v_poster_name TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Get gig title
    SELECT title INTO v_gig_title
    FROM public.gigs
    WHERE id = NEW.gig_id;
    
    -- Get poster's name
    SELECT full_name INTO v_poster_name
    FROM public.users
    WHERE id = (SELECT poster_id FROM public.gigs WHERE id = NEW.gig_id);
    
    -- Notify teenlancer that their application was approved
    PERFORM send_push_notification(
      p_recipient_id := NEW.teen_id,
      p_title := 'Application Approved! 🎉',
      p_body := COALESCE(v_poster_name, 'A neighbor') || ' approved your application for: ' || v_gig_title,
      p_data := jsonb_build_object(
        'type', 'application_approved',
        'application_id', NEW.id,
        'gig_id', NEW.gig_id,
        'gig_title', v_gig_title
      ),
      p_priority := 'high'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Gig application triggers
DROP TRIGGER IF EXISTS on_application_approved_notify ON public.gig_applications;
CREATE TRIGGER on_application_approved_notify
  AFTER UPDATE OF status ON public.gig_applications
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION notify_application_approved();

-- Gig triggers
DROP TRIGGER IF EXISTS on_gig_assigned_notify ON public.gigs;
CREATE TRIGGER on_gig_assigned_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'assigned' AND OLD.status != 'assigned')
  EXECUTE FUNCTION notify_gig_assigned();

DROP TRIGGER IF EXISTS on_gig_accepted_notify ON public.gigs;
CREATE TRIGGER on_gig_accepted_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
  EXECUTE FUNCTION notify_gig_accepted();

DROP TRIGGER IF EXISTS on_gig_started_notify ON public.gigs;
CREATE TRIGGER on_gig_started_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'in_progress' AND OLD.status != 'in_progress')
  EXECUTE FUNCTION notify_gig_started();

DROP TRIGGER IF EXISTS on_gig_completed_notify ON public.gigs;
CREATE TRIGGER on_gig_completed_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION notify_gig_completed();

DROP TRIGGER IF EXISTS on_gig_cancelled_notify ON public.gigs;
CREATE TRIGGER on_gig_cancelled_notify
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION notify_gig_cancelled();

-- Parent approval triggers
DROP TRIGGER IF EXISTS on_parent_approval_needed_notify ON public.parent_approvals;
CREATE TRIGGER on_parent_approval_needed_notify
  AFTER INSERT ON public.parent_approvals
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_parent_approval_needed();

DROP TRIGGER IF EXISTS on_parent_approved_notify ON public.parent_approvals;
CREATE TRIGGER on_parent_approved_notify
  AFTER UPDATE OF status ON public.parent_approvals
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION notify_parent_approved();

DROP TRIGGER IF EXISTS on_parent_rejected_notify ON public.parent_approvals;
CREATE TRIGGER on_parent_rejected_notify
  AFTER UPDATE OF status ON public.parent_approvals
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status != 'rejected')
  EXECUTE FUNCTION notify_parent_rejected();

-- Message trigger
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Earnings trigger
DROP TRIGGER IF EXISTS on_payment_received_notify ON public.earnings;
CREATE TRIGGER on_payment_received_notify
  AFTER UPDATE OF status ON public.earnings
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
  EXECUTE FUNCTION notify_payment_received();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. After running this migration, update the configuration:
--    UPDATE public.push_notification_config
--    SET 
--      supabase_url = 'https://your-project.supabase.co',
--      service_role_key = 'your-service-role-key'
--    WHERE id = 'default';
--
--    Get these values from:
--    - Supabase URL: Dashboard → Settings → API → Project URL
--    - Service Role Key: Dashboard → Settings → API → service_role key (secret)
--
-- 2. Deploy the Edge Function:
--    supabase functions deploy send-push-notification
--
-- 3. The triggers will automatically send push notifications when events occur
--    Users must have expo_push_token set in their users table for notifications to work
--
-- 4. To verify configuration:
--    SELECT supabase_url, 
--           CASE WHEN service_role_key IS NOT NULL THEN '✓ Configured' ELSE '✗ Not set' END as key_status
--    FROM public.push_notification_config WHERE id = 'default';

