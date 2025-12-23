-- Migration: Allow teenlancers to read poster profiles for open gigs
-- This enables the floating message bubble to show the poster's avatar

-- Drop and recreate the "Users can read related profiles" policy to include open gigs
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;

CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    id IN (
      -- Assigned gigs: poster can read teen, teen can read poster
      SELECT poster_id FROM public.gigs WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.gigs WHERE poster_id = auth.uid()
      UNION
      -- Open gigs: teenlancers can read poster profiles to message them
      SELECT DISTINCT poster_id FROM public.gigs 
      WHERE status = 'open'
      AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'teen'
      )
      UNION
      -- Messages: users who have messaged each other
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
      UNION
      -- Parent-child relationships
      SELECT parent_id FROM public.users WHERE id = auth.uid()
      UNION
      SELECT id FROM public.users WHERE parent_id = auth.uid()
    )
  );











