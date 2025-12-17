-- Update pending_teen_signups table to make email and password nullable
-- These will be set when the teen creates their account after parent approval
ALTER TABLE public.pending_teen_signups
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS unique_email_pending;

-- Add unique constraint only for non-null emails (to prevent duplicate signups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_teen_signups_email_unique 
ON public.pending_teen_signups(email) 
WHERE email IS NOT NULL AND email != '';

