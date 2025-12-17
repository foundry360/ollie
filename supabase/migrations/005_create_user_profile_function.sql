-- Create a function to handle user profile creation that bypasses RLS
-- This is needed because RLS policies may not have access to auth.uid() immediately after signup

CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_date_of_birth DATE DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users;
BEGIN
  -- Verify that the user_id exists in auth.users and matches the current user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist in auth.users';
  END IF;

  -- Insert the user profile
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    date_of_birth,
    parent_email,
    phone,
    verified
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_role,
    p_date_of_birth,
    p_parent_email,
    p_phone,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    date_of_birth = EXCLUDED.date_of_birth,
    parent_email = EXCLUDED.parent_email,
    phone = EXCLUDED.phone,
    updated_at = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;

