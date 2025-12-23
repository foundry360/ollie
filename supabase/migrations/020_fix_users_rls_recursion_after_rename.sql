-- Fix infinite recursion in users RLS policy after table rename
-- The policy was causing recursion by querying users table within its own policy check

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;

-- Recreate it without circular references
-- Remove parent/child relationship queries that cause recursion
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    -- Allow reading profiles of users involved in gigs
    id IN (
      SELECT poster_id FROM public.gigs WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.gigs WHERE poster_id = auth.uid()
    )
    OR
    -- Allow reading profiles of users in message threads
    id IN (
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
    )
    -- Note: Parent/child relationship queries removed to avoid recursion
    -- Parent/child relationships should be handled through separate policies or functions
  );






















