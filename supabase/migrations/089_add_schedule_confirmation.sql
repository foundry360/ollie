-- Migration: Add schedule confirmation fields to gigs table
-- This allows teenlancers to confirm or propose alternative schedules

-- Add schedule confirmation status
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS schedule_confirmed BOOLEAN DEFAULT FALSE;

-- Add proposed schedule fields (for when teenlancer proposes different times)
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS proposed_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS proposed_scheduled_start_time TIME,
  ADD COLUMN IF NOT EXISTS proposed_scheduled_end_time TIME;

-- Add comments
COMMENT ON COLUMN public.gigs.schedule_confirmed IS 'True when teenlancer has confirmed the schedule (or if no schedule was set)';
COMMENT ON COLUMN public.gigs.proposed_scheduled_date IS 'Alternative date proposed by teenlancer';
COMMENT ON COLUMN public.gigs.proposed_scheduled_start_time IS 'Alternative start time proposed by teenlancer';
COMMENT ON COLUMN public.gigs.proposed_scheduled_end_time IS 'Alternative end time proposed by teenlancer';



















