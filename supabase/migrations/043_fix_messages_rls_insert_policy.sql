-- Fix messages RLS INSERT policy
-- The previous policy had a bug where it referenced messages.gig_id in an INSERT context
-- This migration fixes the policy to properly check if user has message history

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- Fixed policy: Allow messaging if:
-- 1. User is the poster (any gig status)
-- 2. User is the assigned teen (any gig status)  
-- 3. Gig is open (for initial contact)
-- 4. User has ANY message history with this gig (for replies/continuations)
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
      -- In INSERT WITH CHECK, we can reference the NEW row's columns directly (gig_id, sender_id, etc.)
      -- Check if there are any existing messages for this gig involving the current user
      EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.gig_id = gig_id  -- gig_id refers to the NEW row being inserted
        AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
        LIMIT 1
      )
    )
  );





