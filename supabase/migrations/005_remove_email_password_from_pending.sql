-- Remove email and password fields from pending_teen_signups table
-- These are no longer needed since we collect them after approval (Option 2 flow)

-- Drop the unique index on email first (if it exists)
DROP INDEX IF EXISTS idx_pending_teen_signups_email_unique;

-- Remove email column
ALTER TABLE public.pending_teen_signups
  DROP COLUMN IF EXISTS email;

-- Remove password column
ALTER TABLE public.pending_teen_signups
  DROP COLUMN IF EXISTS password;

