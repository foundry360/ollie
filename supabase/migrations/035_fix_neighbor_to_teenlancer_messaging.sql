-- Fix messages RLS policy to ensure neighbors can message teenlancers on their gigs
-- This explicitly allows posters to message any recipient about their own gigs

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- Create updated policy that explicitly allows:
-- 1. Poster to message ANYONE about their own gigs (regardless of gig status)
-- 2. Assigned teen to message the poster about assigned gigs
-- 3. Any user to message about open gigs (to enable teenlancers to contact posters)
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    (
      -- User is the poster of the gig (can message anyone about their gigs)
      gig_id IN (SELECT id FROM public.gigs WHERE poster_id = auth.uid())
      OR
      -- User is the assigned teen of the gig (can message the poster)
      gig_id IN (SELECT id FROM public.gigs WHERE teen_id = auth.uid())
      OR
      -- Gig is open (allows any user to message about open gigs)
      gig_id IN (SELECT id FROM public.gigs WHERE status = 'open')
    )
  );







