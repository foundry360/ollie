-- Migration: Create function to delete gigs with SECURITY DEFINER to bypass RLS
-- This ensures deletion works even if RLS policies are blocking

CREATE OR REPLACE FUNCTION delete_gig(p_gig_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_gig_record RECORD;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Fetch the gig to verify ownership and status
  SELECT poster_id, status INTO v_gig_record
  FROM public.gigs
  WHERE id = p_gig_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found';
  END IF;
  
  -- Verify ownership
  IF v_gig_record.poster_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized to delete this gig';
  END IF;
  
  -- Verify status allows deletion
  IF NOT (v_gig_record.status IN ('open', 'accepted')) THEN
    RAISE EXCEPTION 'Cannot delete a gig that is in progress, completed, or cancelled. Current status: %', v_gig_record.status;
  END IF;
  
  -- Delete the gig (bypasses RLS due to SECURITY DEFINER)
  DELETE FROM public.gigs WHERE id = p_gig_id;
  
  -- Return true if deletion was successful
  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_gig(UUID) TO authenticated;

COMMENT ON FUNCTION delete_gig(UUID) IS 'Deletes a gig if the user is the owner and the gig status is open or accepted. Bypasses RLS using SECURITY DEFINER.';



