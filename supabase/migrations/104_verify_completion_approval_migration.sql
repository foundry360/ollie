-- Migration: Verify and fix completion approval system
-- This migration ensures the trigger only fires on 'completed' status, not 'pending_completion_approval'
-- IMPORTANT: Run migration 103 first!

-- First, ensure the constraint allows pending_completion_approval (from migration 103)
ALTER TABLE public.gigs 
  DROP CONSTRAINT IF EXISTS gigs_status_check;
  
ALTER TABLE public.gigs
  ADD CONSTRAINT gigs_status_check 
  CHECK (status IN ('open', 'assigned', 'accepted', 'in_progress', 'pending_completion_approval', 'completed', 'cancelled'));

-- Ensure the trigger only fires on 'completed', not 'pending_completion_approval'
-- Drop and recreate to be absolutely sure
DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.gigs;

CREATE TRIGGER on_task_completed_create_earnings
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' 
    AND OLD.status != 'completed' 
    AND NEW.teen_id IS NOT NULL
    AND OLD.status != 'pending_completion_approval'  -- Extra safety check: don't fire if coming from pending_completion_approval
  )
  EXECUTE FUNCTION create_earnings_on_completion();

-- Add a comment to document this
COMMENT ON TRIGGER on_task_completed_create_earnings ON public.gigs IS 
  'Creates earnings and processes payment ONLY when status changes to completed (after neighbor approval). Does NOT fire for pending_completion_approval.';

