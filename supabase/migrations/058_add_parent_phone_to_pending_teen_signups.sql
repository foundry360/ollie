-- Add parent_phone column to pending_teen_signups table
-- This allows us to store the parent's phone number during teen signup
-- so it can be used when creating the parent account and for bank account approval OTP

ALTER TABLE public.pending_teen_signups 
ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- Add index for parent_phone lookups (if needed in the future)
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_parent_phone 
ON public.pending_teen_signups(parent_phone);

