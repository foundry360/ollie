-- Migration: Add neighbor completion approval system
-- This ensures neighbors approve gig completion before payment is processed

-- First, add the new status to the gigs table
ALTER TABLE public.gigs 
  DROP CONSTRAINT IF EXISTS gigs_status_check;
  
ALTER TABLE public.gigs
  ADD CONSTRAINT gigs_status_check 
  CHECK (status IN ('open', 'assigned', 'accepted', 'in_progress', 'pending_completion_approval', 'completed', 'cancelled'));

-- Update RLS policy to allow teens to update status to pending_completion_approval
-- The USING clause checks the OLD row (current state), WITH CHECK checks the NEW row (after update)
DROP POLICY IF EXISTS "Teens can update accepted tasks" ON public.gigs;

CREATE POLICY "Teens can update accepted tasks" ON public.gigs
  FOR UPDATE 
  USING (
    teen_id = auth.uid() 
    AND status IN ('assigned', 'accepted', 'in_progress', 'pending_completion_approval', 'completed')
  )
  WITH CHECK (
    teen_id = auth.uid()
    AND (
      -- Allow transitions from in_progress to pending_completion_approval
      (status = 'pending_completion_approval')
      -- Or allow if staying in an allowed status
      OR status IN ('assigned', 'accepted', 'in_progress', 'completed')
    )
  );

-- Create completion_approvals table
CREATE TABLE IF NOT EXISTS public.completion_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  poster_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT, -- Optional reason for rejection
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gig_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_completion_approvals_gig_id ON public.completion_approvals(gig_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_poster_id ON public.completion_approvals(poster_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_teen_id ON public.completion_approvals(teen_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_status ON public.completion_approvals(status);

-- Enable RLS
ALTER TABLE public.completion_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop if exists to allow re-running migration)
DROP POLICY IF EXISTS "Posters can read own completion approvals" ON public.completion_approvals;
DROP POLICY IF EXISTS "Teens can read own completion approvals" ON public.completion_approvals;
DROP POLICY IF EXISTS "Posters can update completion approvals" ON public.completion_approvals;

CREATE POLICY "Posters can read own completion approvals" ON public.completion_approvals
  FOR SELECT USING (poster_id = auth.uid());

CREATE POLICY "Teens can read own completion approvals" ON public.completion_approvals
  FOR SELECT USING (teen_id = auth.uid());

CREATE POLICY "Posters can update completion approvals" ON public.completion_approvals
  FOR UPDATE USING (poster_id = auth.uid());

-- Function to create completion approval when teen marks gig as complete
CREATE OR REPLACE FUNCTION create_completion_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When gig status changes to pending_completion_approval, create approval record
  IF NEW.status = 'pending_completion_approval' AND OLD.status != 'pending_completion_approval' THEN
    INSERT INTO public.completion_approvals (gig_id, poster_id, teen_id, status)
    VALUES (NEW.id, NEW.poster_id, NEW.teen_id, 'pending')
    ON CONFLICT (gig_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create completion approval (drop first to allow re-running)
DROP TRIGGER IF EXISTS on_gig_pending_completion_create_approval ON public.gigs;
CREATE TRIGGER on_gig_pending_completion_create_approval
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'pending_completion_approval' AND OLD.status != 'pending_completion_approval')
  EXECUTE FUNCTION create_completion_approval();

-- Function to approve completion and mark gig as completed (triggers payment)
CREATE OR REPLACE FUNCTION approve_completion(p_gig_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_approval RECORD;
  v_gig RECORD;
BEGIN
  -- Get the approval record
  SELECT * INTO v_approval
  FROM public.completion_approvals
  WHERE gig_id = p_gig_id
    AND poster_id = auth.uid()
    AND status = 'pending';
  
  IF v_approval IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Completion approval not found or already processed'
    );
  END IF;
  
  -- Get the gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id;
  
  IF v_gig.status != 'pending_completion_approval' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gig is not in pending completion approval status'
    );
  END IF;
  
  -- Update approval status
  UPDATE public.completion_approvals
  SET status = 'approved', updated_at = NOW()
  WHERE id = v_approval.id;
  
  -- Update gig status to completed (this will trigger payment via existing trigger)
  UPDATE public.gigs
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_gig_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Completion approved. Payment will be processed.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject completion
CREATE OR REPLACE FUNCTION reject_completion(p_gig_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_approval RECORD;
BEGIN
  -- Get the approval record
  SELECT * INTO v_approval
  FROM public.completion_approvals
  WHERE gig_id = p_gig_id
    AND poster_id = auth.uid()
    AND status = 'pending';
  
  IF v_approval IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Completion approval not found or already processed'
    );
  END IF;
  
  -- Update approval status
  UPDATE public.completion_approvals
  SET status = 'rejected', reason = p_reason, updated_at = NOW()
  WHERE id = v_approval.id;
  
  -- Revert gig status back to in_progress
  UPDATE public.gigs
  SET status = 'in_progress', updated_at = NOW()
  WHERE id = p_gig_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Completion rejected. Gig status reverted to in progress.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_completion(UUID, TEXT) TO authenticated;

