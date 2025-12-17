-- Function to find and update pending neighbor application by phone
-- This function bypasses RLS to allow finding applications during phone verification
-- when the user_id might have changed after OTP verification

CREATE OR REPLACE FUNCTION public.find_and_update_application_by_phone(
  p_phone TEXT,
  p_verified_user_id UUID,
  p_phone_verified BOOLEAN,
  p_phone_verified_at TIMESTAMPTZ
)
RETURNS public.pending_neighbor_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.pending_neighbor_applications;
BEGIN
  -- Find application by phone number
  SELECT * INTO v_application
  FROM public.pending_neighbor_applications
  WHERE phone = TRIM(p_phone)
    AND status = 'pending'
  LIMIT 1;
  
  -- If found, update it
  IF v_application IS NOT NULL THEN
    UPDATE public.pending_neighbor_applications
    SET 
      user_id = p_verified_user_id,
      phone_verified = p_phone_verified,
      phone_verified_at = p_phone_verified_at,
      updated_at = NOW()
    WHERE id = v_application.id
    RETURNING * INTO v_application;
  END IF;
  
  RETURN v_application;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_and_update_application_by_phone TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.find_and_update_application_by_phone IS 'Finds and updates a pending neighbor application by phone number. Uses SECURITY DEFINER to bypass RLS during phone verification when user_id might have changed.';
