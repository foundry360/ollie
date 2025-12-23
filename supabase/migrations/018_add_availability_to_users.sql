-- Add availability column to users table
-- This stores weekly availability as JSONB: {monday: {start: "09:00", end: "17:00"}, ...}
-- NOTE: Times are stored in 24-hour format (09:00 = 9:00 AM, 17:00 = 5:00 PM)
-- The UI automatically converts these to 12-hour format with AM/PM for display
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{
  "monday": {"start": "09:00", "end": "17:00"},
  "tuesday": {"start": "09:00", "end": "17:00"},
  "wednesday": {"start": "09:00", "end": "17:00"},
  "thursday": {"start": "09:00", "end": "17:00"},
  "friday": {"start": "09:00", "end": "17:00"},
  "saturday": {"start": "09:00", "end": "17:00"},
  "sunday": {"start": "09:00", "end": "17:00"}
}'::jsonb;























