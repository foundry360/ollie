-- Migration: Fix completion approval query and ensure RLS policies work correctly
-- This ensures completion approvals are visible to neighbors

-- Verify RLS policies allow reading completion approvals
-- The policies should already exist from migration 103, but let's ensure they're correct

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Posters can read own completion approvals" ON public.completion_approvals;
DROP POLICY IF EXISTS "Teens can read own completion approvals" ON public.completion_approvals;
DROP POLICY IF EXISTS "Posters can update completion approvals" ON public.completion_approvals;

-- Posters can read their own completion approvals
CREATE POLICY "Posters can read own completion approvals" ON public.completion_approvals
  FOR SELECT USING (poster_id = auth.uid());

-- Teens can read their own completion approvals
CREATE POLICY "Teens can read own completion approvals" ON public.completion_approvals
  FOR SELECT USING (teen_id = auth.uid());

-- Posters can update their own completion approvals
CREATE POLICY "Posters can update completion approvals" ON public.completion_approvals
  FOR UPDATE USING (poster_id = auth.uid());

-- Ensure the trigger function creates approval records correctly
-- Add logging to help debug if records aren't being created
CREATE OR REPLACE FUNCTION create_completion_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When gig status changes to pending_completion_approval, create approval record
  IF NEW.status = 'pending_completion_approval' AND OLD.status != 'pending_completion_approval' THEN
    -- Log the trigger firing
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'create_completion_approval',
      'TRIGGER FIRED - CREATING COMPLETION APPROVAL',
      jsonb_build_object(
        'gig_id', NEW.id,
        'poster_id', NEW.poster_id,
        'teen_id', NEW.teen_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
    
    INSERT INTO public.completion_approvals (gig_id, poster_id, teen_id, status)
    VALUES (NEW.id, NEW.poster_id, NEW.teen_id, 'pending')
    ON CONFLICT (gig_id) DO UPDATE
    SET status = 'pending', updated_at = NOW();
    
    -- Log successful creation
    INSERT INTO public.debug_logs (function_name, message, data)
    VALUES (
      'create_completion_approval',
      'COMPLETION APPROVAL RECORD CREATED',
      jsonb_build_object(
        'gig_id', NEW.id,
        'poster_id', NEW.poster_id,
        'teen_id', NEW.teen_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to manually create completion approval if it's missing
CREATE OR REPLACE FUNCTION create_missing_completion_approval(p_gig_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_gig RECORD;
  v_approval_id UUID;
BEGIN
  -- Get the gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE id = p_gig_id;
  
  IF v_gig IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gig not found'
    );
  END IF;
  
  IF v_gig.status != 'pending_completion_approval' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gig is not in pending_completion_approval status'
    );
  END IF;
  
  -- Check if approval already exists
  SELECT id INTO v_approval_id
  FROM public.completion_approvals
  WHERE gig_id = p_gig_id;
  
  IF v_approval_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Completion approval already exists',
      'approval_id', v_approval_id
    );
  END IF;
  
  -- Create the approval record
  INSERT INTO public.completion_approvals (gig_id, poster_id, teen_id, status)
  VALUES (p_gig_id, v_gig.poster_id, v_gig.teen_id, 'pending')
  RETURNING id INTO v_approval_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Completion approval created',
    'approval_id', v_approval_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_missing_completion_approval(UUID) TO authenticated;



















