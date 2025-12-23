-- Create a test admin user for development/testing
-- This script creates an admin user that can be used to access the admin portal
-- 
-- IMPORTANT: This is for development only. In production, create admin users through proper signup flow.
--
-- Usage:
-- 1. First, create the auth user in Supabase Dashboard → Authentication → Users → Add User
--    - Email: admin@ollie.test (or your preferred email)
--    - Password: (set a password)
--    - Auto Confirm User: Yes
-- 2. Then run this migration to create the profile with admin role
-- 3. Or use the SQL below with the actual user ID from auth.users

-- Option 1: Create admin profile for existing auth user
-- Replace 'USER_ID_HERE' with the actual UUID from auth.users table
-- You can find it in Supabase Dashboard → Authentication → Users

-- Example (uncomment and replace USER_ID_HERE):
/*
INSERT INTO public.users (id, email, full_name, role)
VALUES (
  'USER_ID_HERE',  -- Replace with actual user ID from auth.users
  'admin@ollie.test',
  'Admin User',
  'admin'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin';
*/

-- Option 2: Create a function to make any user an admin (for development)
CREATE OR REPLACE FUNCTION make_user_admin(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Update or insert user profile with admin role
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    v_user_id,
    user_email,
    'Admin User',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', updated_at = NOW();
  
  RAISE NOTICE 'User % is now an admin', user_email;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION make_user_admin TO authenticated;

-- Example usage:
-- SELECT make_user_admin('admin@ollie.test');

