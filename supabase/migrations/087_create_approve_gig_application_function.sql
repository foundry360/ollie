-- Create functions for gig applications
-- This migration creates the approve, reject, and apply functions for gig applications

-- Drop existing functions if they exist (to handle return type changes)
DROP FUNCTION IF EXISTS public.apply_for_gig(UUID);
DROP FUNCTION IF EXISTS public.reject_gig_application(UUID, TEXT);
DROP FUNCTION IF EXISTS public.approve_gig_application(UUID);

-- Function to apply for a gig (teen)
CREATE OR REPLACE FUNCTION public.apply_for_gig(p_gig_id UUID)
RETURNS TABLE (
  id UUID,
  gig_id UUID,
  teen_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_gig RECORD;
  v_application RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM public.users
  WHERE users.id = v_user_id;

  -- Check if user is a teen
  IF v_user_role != 'teen' THEN
    RAISE EXCEPTION 'Only teens can apply for gigs';
  END IF;

  -- Get the gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE gigs.id = p_gig_id;

  -- Check if gig exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found';
  END IF;

  -- Check if gig is open
  IF v_gig.status != 'open' THEN
    RAISE EXCEPTION 'Gig is not available';
  END IF;

  -- Check if user is trying to apply for their own gig
  IF v_gig.poster_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply for your own gig';
  END IF;

  -- Check if already applied
  SELECT * INTO v_application
  FROM public.gig_applications
  WHERE gig_applications.gig_id = p_gig_id AND gig_applications.teen_id = v_user_id;

  IF FOUND THEN
    RAISE EXCEPTION 'You have already applied for this gig';
  END IF;

  -- Create the application
  INSERT INTO public.gig_applications (gig_id, teen_id, status)
  VALUES (p_gig_id, v_user_id, 'pending')
  RETURNING * INTO v_application;

  -- Return the application
  RETURN QUERY
  SELECT 
    v_application.id,
    v_application.gig_id,
    v_application.teen_id,
    v_application.status,
    v_application.created_at,
    v_application.updated_at;
END;
$$;

-- Function to reject a gig application (neighbor)
CREATE OR REPLACE FUNCTION public.reject_gig_application(
  p_application_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  gig_id UUID,
  teen_id UUID,
  status TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application RECORD;
  v_gig RECORD;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get the application
  SELECT * INTO v_application
  FROM public.gig_applications
  WHERE gig_applications.id = p_application_id;

  -- Check if application exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Check if application is pending
  IF v_application.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- Get the gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE gigs.id = v_application.gig_id;

  -- Check if user is the gig poster
  IF v_gig.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the gig poster can reject applications';
  END IF;

  -- Update the application to rejected
  UPDATE public.gig_applications
  SET status = 'rejected',
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE gig_applications.id = p_application_id
  RETURNING * INTO v_application;

  -- Return the updated application
  RETURN QUERY
  SELECT 
    v_application.id,
    v_application.gig_id,
    v_application.teen_id,
    v_application.status,
    v_application.rejection_reason,
    v_application.created_at,
    v_application.updated_at;
END;
$$;

-- Function to approve a gig application
-- This function approves an application, assigns the teen to the gig, and rejects other applications

CREATE OR REPLACE FUNCTION public.approve_gig_application(p_application_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  pay DECIMAL(10, 2),
  status TEXT,
  poster_id UUID,
  teen_id UUID,
  location JSONB,
  address TEXT,
  required_skills TEXT[],
  estimated_hours DECIMAL(4, 2),
  photos TEXT[],
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application RECORD;
  v_gig RECORD;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get the application
  SELECT * INTO v_application
  FROM public.gig_applications
  WHERE gig_applications.id = p_application_id;

  -- Check if application exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Check if application is pending
  IF v_application.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- Get the gig
  SELECT * INTO v_gig
  FROM public.gigs
  WHERE gigs.id = v_application.gig_id;

  -- Check if gig exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found';
  END IF;

  -- Check if user is the gig poster
  IF v_gig.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Only the gig poster can approve applications';
  END IF;

  -- Check if gig is still open
  IF v_gig.status != 'open' THEN
    RAISE EXCEPTION 'Gig is no longer open';
  END IF;

  -- Check if gig already has a teenlancer assigned
  IF v_gig.teen_id IS NOT NULL THEN
    RAISE EXCEPTION 'Gig already has a teenlancer assigned';
  END IF;

  -- Update the application to approved
  UPDATE public.gig_applications
  SET status = 'approved',
      updated_at = NOW()
  WHERE gig_applications.id = p_application_id;

  -- Reject all other pending applications for this gig
  UPDATE public.gig_applications
  SET status = 'rejected',
      updated_at = NOW()
  WHERE gig_applications.gig_id = v_application.gig_id
    AND gig_applications.id != p_application_id
    AND gig_applications.status = 'pending';

  -- Update the gig: assign teen and change status to assigned
  -- 'assigned' means the neighbor has selected/approved the teenlancer
  -- The teenlancer can then start work (status changes to 'in_progress')
  UPDATE public.gigs
  SET teen_id = v_application.teen_id,
      status = 'assigned',
      updated_at = NOW()
  WHERE gigs.id = v_application.gig_id;

  -- Return the updated gig
  RETURN QUERY
  SELECT 
    public.gigs.id,
    public.gigs.title,
    public.gigs.description,
    public.gigs.pay,
    public.gigs.status,
    public.gigs.poster_id,
    public.gigs.teen_id,
    public.gigs.location,
    public.gigs.address,
    public.gigs.required_skills,
    public.gigs.estimated_hours,
    public.gigs.photos,
    public.gigs.scheduled_date,
    public.gigs.scheduled_start_time,
    public.gigs.scheduled_end_time,
    public.gigs.created_at,
    public.gigs.updated_at
  FROM public.gigs
  WHERE public.gigs.id = v_application.gig_id;
END;
$$;

