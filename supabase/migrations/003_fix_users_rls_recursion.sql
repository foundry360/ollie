-- Fix infinite recursion in users RLS policy
-- The "Users can read related profiles" policy was causing recursion by querying users table

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;

-- Recreate it without the circular reference
-- Remove the parent/child relationship queries that cause recursion
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    -- Allow reading profiles of users involved in tasks
    id IN (
      SELECT poster_id FROM public.tasks WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.tasks WHERE poster_id = auth.uid()
    )
    OR
    -- Allow reading profiles of users in message threads
    id IN (
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
    )
    -- Note: Parent/child relationship queries removed to avoid recursion
    -- These relationships can be accessed through tasks/messages or handled separately
  );
