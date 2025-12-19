-- Migration: Allow teens to accept open gigs
-- This creates a database function that allows teens to accept open gigs
-- Using a function with SECURITY DEFINER bypasses RLS and ensures atomic operations

-- Function to accept a gig (for teens)
-- Explicitly create in public schema
CREATE OR REPLACE FUNCTION public.accept_gig(p_gig_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  pay DECIMAL,
  status TEXT,
  poster_id UUID,
  teen_id UUID,
  location JSONB,
  address TEXT,
  required_skills TEXT[],
  estimated_hours DECIMAL,
  photos TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_gig_status TEXT;
  v_result RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if user is a teen
  SELECT u.role INTO v_user_role
  FROM public.users u
  WHERE u.id = v_user_id;
  
  IF v_user_role != 'teen' THEN
    RAISE EXCEPTION 'Only teens can accept gigs';
  END IF;
  
  -- Check if gig exists and is open
  SELECT g.status INTO v_gig_status
  FROM public.gigs g
  WHERE g.id = p_gig_id;
  
  IF v_gig_status IS NULL THEN
    RAISE EXCEPTION 'Gig not found';
  END IF;
  
  IF v_gig_status != 'open' THEN
    RAISE EXCEPTION 'Gig is not available (status: %)', v_gig_status;
  END IF;
  
  -- Update the gig to accepted
  UPDATE public.gigs
  SET 
    teen_id = v_user_id,
    status = 'accepted',
    updated_at = NOW()
  WHERE public.gigs.id = p_gig_id
    AND public.gigs.status = 'open';  -- Double-check to prevent race conditions
  
  -- Check if update succeeded by querying the updated row
  SELECT * INTO v_result
  FROM public.gigs
  WHERE public.gigs.id = p_gig_id;
  
  IF v_result IS NULL OR v_result.status != 'accepted' OR v_result.teen_id != v_user_id THEN
    RAISE EXCEPTION 'Failed to accept gig. It may have been accepted by someone else.';
  END IF;
  
  -- Return the updated gig using RETURN QUERY with explicit column aliases
  -- This avoids ambiguity by selecting from the table directly
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.pay,
    g.status,
    g.poster_id,
    g.teen_id,
    g.location,
    g.address,
    g.required_skills,
    g.estimated_hours,
    g.photos,
    g.created_at,
    g.updated_at
  FROM public.gigs g
  WHERE g.id = p_gig_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_gig(UUID) TO authenticated;

-- Also add the RLS policy as a backup (in case function approach has issues)
-- Drop policy if it exists first
DROP POLICY IF EXISTS "Teens can accept open gigs" ON public.gigs;

CREATE POLICY "Teens can accept open gigs" ON public.gigs
  FOR UPDATE USING (
    public.gigs.status = 'open' AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'teen'
    )
  )
  WITH CHECK (
    public.gigs.status = 'accepted' AND
    public.gigs.teen_id = auth.uid()
  );




