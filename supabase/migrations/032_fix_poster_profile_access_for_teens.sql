-- Fix: Allow teenlancers to read poster profiles for open gigs
-- The previous policy had a recursive RLS check issue
-- This version avoids recursion by not checking user role in the policy
-- AND by removing parent-child relationship queries (which cause recursion)

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;

-- Recreate with a fix to avoid RLS recursion
-- Allow any authenticated user to read profiles of posters who have open gigs
-- This enables teenlancers to see poster profiles for messaging
-- NOTE: Parent-child relationships removed to avoid recursion (handled by other policies)
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    id IN (
      -- Assigned gigs: poster can read teen, teen can read poster
      SELECT poster_id FROM public.gigs WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.gigs WHERE poster_id = auth.uid()
      UNION
      -- Open gigs: allow reading poster profiles (for messaging)
      -- Any authenticated user can read profiles of posters with open gigs
      -- This allows teenlancers to see poster info to message them
      SELECT DISTINCT poster_id FROM public.gigs 
      WHERE status = 'open'
      UNION
      -- Messages: users who have messaged each other
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
      -- NOTE: Parent-child relationship queries removed to avoid recursion
      -- Parent-child access should be handled through separate policies or functions
    )
  );








