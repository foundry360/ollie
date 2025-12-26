-- Fix infinite recursion in "Posters can read all poster profiles" policy
-- The previous policy caused recursion by querying the users table
-- Solution: Use a SECURITY DEFINER function to check user role without triggering RLS

-- Drop the problematic policy
DROP POLICY IF EXISTS "Posters can read all poster profiles" ON public.users;

-- Create a SECURITY DEFINER function to check if current user is a poster
-- This bypasses RLS so it won't cause recursion
CREATE OR REPLACE FUNCTION public.is_current_user_poster()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.users
  WHERE id = auth.uid();
  
  -- Return false if user not found or role is not 'poster'
  RETURN COALESCE(v_role = 'poster', false);
END;
$$;

-- Create the policy using the function (no recursion)
CREATE POLICY "Posters can read all poster profiles" ON public.users
  FOR SELECT USING (
    -- Allow reading profiles of users with role 'poster'
    role = 'poster'
    AND
    -- Only if the current user is also a poster (checked via function to avoid recursion)
    public.is_current_user_poster()
  );

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_current_user_poster() TO authenticated;

COMMENT ON FUNCTION public.is_current_user_poster() IS 'Checks if the current authenticated user has role poster. Uses SECURITY DEFINER to avoid RLS recursion.';

