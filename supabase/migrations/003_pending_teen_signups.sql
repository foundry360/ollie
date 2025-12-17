-- Pending teen signups table
-- Stores signup data before parent approval
CREATE TABLE IF NOT EXISTS public.pending_teen_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password TEXT NOT NULL, -- Will be hashed by Supabase Auth when account is created
  date_of_birth DATE NOT NULL,
  parent_email TEXT NOT NULL,
  approval_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  parent_ip_address TEXT, -- Optional: for security logging
  CONSTRAINT unique_email_pending UNIQUE(email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_token ON public.pending_teen_signups(approval_token);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_status ON public.pending_teen_signups(status);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_parent_email ON public.pending_teen_signups(parent_email);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_created_at ON public.pending_teen_signups(created_at DESC);

-- Function to automatically expire old pending signups
CREATE OR REPLACE FUNCTION expire_old_pending_signups()
RETURNS void AS $$
BEGIN
  UPDATE public.pending_teen_signups
  SET status = 'expired'
  WHERE status = 'pending'
    AND token_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run this function periodically
-- This would need to be set up in Supabase dashboard or via pg_cron extension

