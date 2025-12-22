-- Migration: Add scheduling fields to gigs table
-- Adds scheduled_date, scheduled_start_time, and scheduled_end_time for gig scheduling

ALTER TABLE public.gigs
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS scheduled_start_time TIME,
ADD COLUMN IF NOT EXISTS scheduled_end_time TIME;

-- Add comment for documentation
COMMENT ON COLUMN public.gigs.scheduled_date IS 'The date when the gig is scheduled to be performed';
COMMENT ON COLUMN public.gigs.scheduled_start_time IS 'The start time for the gig (24-hour format HH:MM)';
COMMENT ON COLUMN public.gigs.scheduled_end_time IS 'The end time for the gig (24-hour format HH:MM)';










