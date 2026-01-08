-- Migration: Add function to allow users to delete their own account
-- This function bypasses RLS to allow account deletion

-- Function to delete user account
-- Users can only delete their own account
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the current authenticated user ID
  v_user_id := auth.uid();
  
  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete account';
  END IF;
  
  -- Delete the user profile from public.users
  -- This will cascade delete related data due to ON DELETE CASCADE constraints:
  -- - Gigs (where poster_id or teen_id matches)
  -- - Messages (where sender_id or recipient_id matches)
  -- - Earnings (where teen_id matches)
  -- - Parent approvals (where teen_id, parent_id matches)
  -- - Other related tables
  
  DELETE FROM public.users
  WHERE id = v_user_id;
  
  -- Note: The auth.users record will remain
  -- To fully delete the auth account, you'll need to:
  -- 1. Create a Supabase Edge Function with admin/service role
  -- 2. Or use Supabase Admin API
  -- 3. The auth account deletion should be handled separately
  
  -- Return success (void function)
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- Add RLS policy to allow users to delete their own profile
-- This is a backup in case the function approach doesn't work
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;
CREATE POLICY "Users can delete own profile" ON public.users
  FOR DELETE USING (auth.uid() = id);





