-- Function to get parent information (email, phone, full_name) for bank account setup
-- Uses SECURITY DEFINER to bypass RLS, but only returns info if teen has parent_id
-- Replaces get_parent_phone_for_bank_approval() for email-based flow

-- Drop existing function if it exists (in case return type changed)
DROP FUNCTION IF EXISTS get_parent_info_for_bank_setup();

-- Create the function that returns parent email, phone, and full_name
CREATE FUNCTION get_parent_info_for_bank_setup()
RETURNS TABLE (
  email TEXT,
  phone TEXT,
  full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teen_id UUID;
  v_parent_id UUID;
BEGIN
  -- Get current user's ID
  v_teen_id := auth.uid();
  
  IF v_teen_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get parent_id from teen's profile
  SELECT parent_id INTO v_parent_id
  FROM public.users
  WHERE id = v_teen_id AND role = 'teen';
  
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'No parent associated with this account';
  END IF;
  
  -- Get parent's information (email, phone, full_name)
  RETURN QUERY
  SELECT 
    u.email,
    u.phone,
    u.full_name
  FROM public.users u
  WHERE u.id = v_parent_id;
  
  -- If no rows returned, parent profile doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent profile not found';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_parent_info_for_bank_setup() TO authenticated;

COMMENT ON FUNCTION get_parent_info_for_bank_setup() IS 'Returns parent email, phone, and full_name for bank account setup. Only works for authenticated teens with a parent_id. Used for email-based bank account setup flow.';

