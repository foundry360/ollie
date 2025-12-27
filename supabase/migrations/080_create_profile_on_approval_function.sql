-- Create a function to ensure the profile is created with the correct user_id
-- This function finds the correct auth user by email, updates the application, and creates the profile

CREATE OR REPLACE FUNCTION public.ensure_user_profile_on_approval(
  p_application_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_correct_user_id UUID;
  v_final_user_id UUID;
BEGIN
  -- Get the application
  SELECT * INTO v_application
  FROM public.pending_neighbor_applications
  WHERE id = p_application_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found: %', p_application_id;
  END IF;
  
  -- Find the correct auth user by email (most recent one)
  -- This is the ONLY source of truth for user IDs - auth.users.id
  SELECT id INTO v_correct_user_id
  FROM auth.users
  WHERE email = v_application.email
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_correct_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email: %', v_application.email;
  END IF;
  
  -- Log the auth user ID we found
  RAISE NOTICE '[ensure_user_profile_on_approval] Found auth user ID: % for email: %', v_correct_user_id, v_application.email;
  
  v_final_user_id := v_correct_user_id;
  
  -- Update the application's user_id if it's wrong
  IF v_application.user_id IS DISTINCT FROM v_correct_user_id THEN
    RAISE NOTICE '[ensure_user_profile_on_approval] Updating application user_id from % to %', v_application.user_id, v_correct_user_id;
    UPDATE public.pending_neighbor_applications
    SET user_id = v_correct_user_id
    WHERE id = p_application_id;
  ELSE
    RAISE NOTICE '[ensure_user_profile_on_approval] Application user_id is correct: %', v_correct_user_id;
  END IF;
  
  -- Delete any existing profile with wrong ID (same email, different id)
  -- This ensures we don't have duplicate profiles
  DELETE FROM public.users
  WHERE email = v_application.email
    AND id IS DISTINCT FROM v_correct_user_id;
  
  -- Verify the ID we're about to use exists in auth.users (sanity check)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_final_user_id) THEN
    RAISE EXCEPTION 'Auth user ID % does not exist in auth.users', v_final_user_id;
  END IF;
  
  RAISE NOTICE '[ensure_user_profile_on_approval] Creating/updating public.users profile with id: % (must match auth.users.id)', v_final_user_id;
  
  -- Create or update the profile with the correct ID
  -- IMPORTANT: public.users.id MUST equal auth.users.id (enforced by foreign key constraint)
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    phone,
    address,
    date_of_birth,
    verified,
    updated_at
  )
  VALUES (
    v_final_user_id,  -- This MUST be the auth.users.id
    v_application.email,
    v_application.full_name,
    'poster',
    v_application.phone,
    v_application.address,
    v_application.date_of_birth,
    true,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, users.phone),
    address = COALESCE(EXCLUDED.address, users.address),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
    verified = true,
    updated_at = NOW();
  
  -- Verify the profile was created with the correct ID
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_final_user_id) THEN
    RAISE EXCEPTION 'Failed to create public.users profile with id: %', v_final_user_id;
  END IF;
  
  RAISE NOTICE '[ensure_user_profile_on_approval] Successfully created/updated profile with id: %', v_final_user_id;
  
  RETURN v_final_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_on_approval(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.ensure_user_profile_on_approval IS 'Ensures the user profile exists with the correct user_id matching auth.users. Updates application user_id if needed and creates/updates the profile.';

