-- Fix messages RLS INSERT policy to avoid recursion
-- The previous policy was checking public.messages in an EXISTS clause, which triggers
-- the SELECT RLS policy, potentially causing recursion or extreme slowness
-- Solution: Use a SECURITY DEFINER function to bypass RLS when checking for existing messages

-- Create a function that checks for existing messages without RLS recursion
CREATE OR REPLACE FUNCTION public.user_has_message_history(p_gig_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function runs with SECURITY DEFINER, so it bypasses RLS
  -- Check if user has any message history with this gig
  RETURN EXISTS (
    SELECT 1 FROM public.messages
    WHERE gig_id = p_gig_id
    AND (sender_id = p_user_id OR recipient_id = p_user_id)
    LIMIT 1
  );
END;
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- New policy using the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    (
      -- Poster can always message about their gigs
      EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND poster_id = auth.uid())
      OR
      -- Assigned teen can always message about assigned gigs
      EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND teen_id = auth.uid())
      OR
      -- Open gigs allow anyone to message (for initial contact)
      EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND status = 'open')
      OR
      -- If user has ANY message history with this gig, they can continue messaging
      -- Use SECURITY DEFINER function to avoid RLS recursion
      public.user_has_message_history(gig_id, auth.uid())
    )
  );





