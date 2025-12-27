-- Ensure the favorite_teenlancer function exists
-- This is a re-application of migration 079 to ensure it's in the database

CREATE OR REPLACE FUNCTION public.favorite_teenlancer(
  p_teen_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poster_id UUID;
BEGIN
  -- Get the current user's ID
  v_poster_id := auth.uid();
  
  IF v_poster_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Ensure the poster's profile exists in public.users
  -- If it doesn't exist, create a minimal profile
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    verified
  )
  SELECT 
    v_poster_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
    'poster',
    false
  FROM auth.users au
  WHERE au.id = v_poster_id
  ON CONFLICT (id) DO NOTHING;
  
  -- Now insert the favorite (this will work because the profile exists)
  INSERT INTO public.favorite_teenlancers (
    poster_id,
    teen_id
  )
  VALUES (
    v_poster_id,
    p_teen_id
  )
  ON CONFLICT (poster_id, teen_id) DO NOTHING;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.favorite_teenlancer(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.favorite_teenlancer IS 'Favorites a teenlancer for the current user. Automatically creates the poster profile if it does not exist.';

