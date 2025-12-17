-- Function to find pending application by email
-- Used during login to check application status even with user_id mismatch
-- SECURITY DEFINER allows it to bypass RLS

CREATE OR REPLACE FUNCTION find_pending_application_by_email(
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  status TEXT,
  phone_verified BOOLEAN,
  phone_verified_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pna.id,
    pna.user_id,
    pna.email,
    pna.full_name,
    pna.phone,
    pna.address,
    pna.date_of_birth,
    pna.status,
    pna.phone_verified,
    pna.phone_verified_at,
    pna.reviewed_by,
    pna.reviewed_at,
    pna.rejection_reason,
    pna.created_at,
    pna.updated_at
  FROM pending_neighbor_applications pna
  WHERE pna.email = LOWER(TRIM(p_email))
  ORDER BY pna.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION find_pending_application_by_email(TEXT) TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION find_pending_application_by_email IS 'Find pending neighbor application by email, bypassing RLS. Used during login to handle user_id mismatches from multiple signups.';

