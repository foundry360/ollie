-- Migration: Add 'assigned' status to gigs table
-- This status represents when a neighbor has approved/selected a teenlancer
-- but the teenlancer hasn't started work yet

-- Add 'assigned' to the status CHECK constraint
-- Drop both old and new constraint names in case the table rename didn't update the constraint name
ALTER TABLE public.gigs
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.gigs
  DROP CONSTRAINT IF EXISTS gigs_status_check;

ALTER TABLE public.gigs
  ADD CONSTRAINT gigs_status_check 
  CHECK (status IN ('open', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled'));

-- Note: 'accepted' is kept for backward compatibility but 'assigned' should be used
-- when a neighbor approves a teenlancer's application
-- 'accepted' can be used if a teenlancer directly accepts a gig (legacy flow)

