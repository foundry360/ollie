-- Function to create pending neighbor application
-- This function bypasses RLS for the initial application creation
-- since the user session might not be fully established yet

CREATE OR REPLACE FUNCTION public.create_pending_neighbor_application(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT
)
RETURNS public.pending_neighbor_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.pending_neighbor_applications;
BEGIN
  -- Insert the application
  INSERT INTO public.pending_neighbor_applications (
    user_id,
    email,
    full_name,
    phone,
    status,
    phone_verified
  ) VALUES (
    p_user_id,
    LOWER(TRIM(p_email)),
    TRIM(p_full_name),
    TRIM(p_phone),
    'pending',
    false
  )
  RETURNING * INTO v_application;
  
  RETURN v_application;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_pending_neighbor_application TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_pending_neighbor_application IS 'Creates a pending neighbor application. Uses SECURITY DEFINER to bypass RLS during signup when session might not be fully established.';
