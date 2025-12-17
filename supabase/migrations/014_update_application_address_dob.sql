-- Function to update pending neighbor application with address and date of birth
-- This function bypasses RLS to allow updating applications during the signup flow
-- when the user_id might have changed after OTP verification

CREATE OR REPLACE FUNCTION public.update_neighbor_application_address_dob(
  p_application_id UUID,
  p_verified_user_id UUID,
  p_address TEXT,
  p_date_of_birth DATE
)
RETURNS public.pending_neighbor_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.pending_neighbor_applications;
BEGIN
  -- Update the application
  UPDATE public.pending_neighbor_applications
  SET 
    user_id = p_verified_user_id, -- Update user_id to match verified user
    address = TRIM(p_address),
    date_of_birth = p_date_of_birth,
    updated_at = NOW()
  WHERE id = p_application_id
    AND status = 'pending'
  RETURNING * INTO v_application;
  
  -- If no rows updated, application might not exist or status changed
  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Application not found or not in pending status';
  END IF;
  
  RETURN v_application;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_neighbor_application_address_dob TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_neighbor_application_address_dob IS 'Updates a pending neighbor application with address and date of birth. Uses SECURITY DEFINER to bypass RLS during signup when user_id might have changed.';

