-- Fix messages RLS policy to allow messaging for open gigs
-- This ensures teenlancers can message posters about open gigs

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- Create updated policy that allows:
-- 1. Poster to message about their gigs
-- 2. Assigned teen to message about assigned gigs
-- 3. Any user to message about open gigs (to enable teenlancers to contact posters)
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    (
      -- User is the poster of the gig
      gig_id IN (SELECT id FROM public.gigs WHERE poster_id = auth.uid())
      OR
      -- User is the assigned teen of the gig
      gig_id IN (SELECT id FROM public.gigs WHERE teen_id = auth.uid())
      OR
      -- Gig is open (allows teenlancers to message posters about open gigs)
      gig_id IN (SELECT id FROM public.gigs WHERE status = 'open')
    )
  );







