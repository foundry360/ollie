-- Simplify messages RLS policy
-- If the UI allows messaging (chat screen is accessible), users should be able to send messages
-- This removes complex gig status checks - the UI already handles who can see what conversations

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- Simple policy: Users can send messages about gigs they're involved in OR about open gigs
-- This covers:
-- 1. Neighbors (posters) messaging about their own gigs (any status)
-- 2. Teenlancers messaging about gigs they're assigned to (any status)
-- 3. Anyone messaging about open gigs (to enable initial contact)
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    (
      -- User is the poster of the gig (can message about their gigs regardless of status)
      gig_id IN (SELECT id FROM public.gigs WHERE poster_id = auth.uid())
      OR
      -- User is the assigned teen of the gig (can message about assigned gigs regardless of status)
      gig_id IN (SELECT id FROM public.gigs WHERE teen_id = auth.uid())
      OR
      -- Gig is open (allows anyone to message about open gigs for initial contact)
      gig_id IN (SELECT id FROM public.gigs WHERE status = 'open')
      OR
      -- User has already received a message about this gig (can reply regardless of status)
      gig_id IN (
        SELECT gig_id FROM public.messages 
        WHERE recipient_id = auth.uid()
      )
      OR
      -- User has already sent a message about this gig (can continue conversation regardless of status)
      gig_id IN (
        SELECT gig_id FROM public.messages 
        WHERE sender_id = auth.uid()
      )
    )
  );







