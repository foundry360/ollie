-- Update create_user_profile function to handle email conflicts
-- The current function only handles id conflicts, but we also need to handle email conflicts
-- This ensures that if a profile exists with the same email but different id, we update it instead of failing

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_date_of_birth DATE DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_existing_by_email public.users;
BEGIN
  -- Verify that the user_id exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist in auth.users';
  END IF;

  -- Check if a profile exists with the same email but different id
  -- This can happen if a user signs up multiple times with the same email
  SELECT * INTO v_existing_by_email
  FROM public.users
  WHERE email = p_email AND id != p_user_id
  LIMIT 1;

  -- If profile exists with same email but different id, we have a conflict
  -- We can't change the id (it's a foreign key), so we'll update the existing profile
  -- and return it. The caller should handle this case appropriately.
  IF v_existing_by_email IS NOT NULL THEN
    -- Update the existing profile with new data
    UPDATE public.users
    SET 
      email = p_email,
      full_name = p_full_name,
      role = p_role,
      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
      parent_email = COALESCE(p_parent_email, parent_email),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      updated_at = NOW()
    WHERE id = v_existing_by_email.id
    RETURNING * INTO v_user;
    
    -- Return the existing profile (with the old id)
    -- Note: This means the profile will have a different id than p_user_id
    -- The application should handle this case
    RETURN v_user;
  END IF;

  -- Insert the user profile (or update if id exists)
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    date_of_birth,
    parent_email,
    phone,
    address,
    verified
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_role,
    p_date_of_birth,
    p_parent_email,
    p_phone,
    p_address,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
    parent_email = COALESCE(EXCLUDED.parent_email, users.parent_email),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    address = COALESCE(EXCLUDED.address, users.address),
    updated_at = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;

