-- Function to check if email or phone already exists
-- Used for pre-validation before signup
-- SECURITY DEFINER allows it to bypass RLS

CREATE OR REPLACE FUNCTION check_email_phone_exists(
  p_email TEXT,
  p_phone TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_exists BOOLEAN := FALSE;
  v_phone_exists BOOLEAN := FALSE;
BEGIN
  -- Check email in pending_neighbor_applications
  SELECT EXISTS (
    SELECT 1 FROM pending_neighbor_applications 
    WHERE email = LOWER(TRIM(p_email))
  ) INTO v_email_exists;
  
  -- If not found in pending, check users table
  IF NOT v_email_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM users 
      WHERE email = LOWER(TRIM(p_email))
    ) INTO v_email_exists;
  END IF;
  
  -- Check phone in pending_neighbor_applications
  SELECT EXISTS (
    SELECT 1 FROM pending_neighbor_applications 
    WHERE phone = TRIM(p_phone)
  ) INTO v_phone_exists;
  
  -- If not found in pending, check users table
  IF NOT v_phone_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM users 
      WHERE phone = TRIM(p_phone)
    ) INTO v_phone_exists;
  END IF;
  
  -- Return results as JSON
  RETURN jsonb_build_object(
    'emailExists', v_email_exists,
    'phoneExists', v_phone_exists
  );
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION check_email_phone_exists(TEXT, TEXT) TO authenticated, anon;

