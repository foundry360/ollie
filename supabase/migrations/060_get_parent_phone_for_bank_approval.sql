-- Function to get parent phone number for bank account approval
-- Uses SECURITY DEFINER to bypass RLS, but only returns phone if teen has parent_id

-- Drop existing function if it exists (in case return type changed)
DROP FUNCTION IF EXISTS get_parent_phone_for_bank_approval();

-- Create the function
CREATE FUNCTION get_parent_phone_for_bank_approval()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teen_id UUID;
  v_parent_id UUID;
  v_parent_phone TEXT;
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
  
  -- Get parent's phone number
  SELECT phone INTO v_parent_phone
  FROM public.users
  WHERE id = v_parent_id;
  
  -- Return the phone number (can be NULL if parent doesn't have phone)
  RETURN v_parent_phone;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_parent_phone_for_bank_approval() TO authenticated;

COMMENT ON FUNCTION get_parent_phone_for_bank_approval() IS 'Returns parent phone number for bank account approval. Only works for authenticated teens with a parent_id.';

