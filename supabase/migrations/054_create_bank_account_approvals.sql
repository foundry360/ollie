-- Create bank_account_approvals table for OTP-based parent approval of bank account setup
-- This table stores OTP codes and approval status for teens to set up bank accounts

CREATE TABLE IF NOT EXISTS public.bank_account_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_phone TEXT NOT NULL,  -- Parent's phone number (E.164 format)
  otp_code TEXT NOT NULL,      -- 6-digit OTP code (hashed in production)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,  -- OTP expiration (15 minutes from creation)
  attempts INTEGER DEFAULT 0,  -- Track failed OTP attempts
  verified_at TIMESTAMPTZ,     -- When OTP was successfully verified
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teen_id)  -- Only one pending approval per teen
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_account_approvals_teen_id ON public.bank_account_approvals(teen_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_approvals_status ON public.bank_account_approvals(status);
CREATE INDEX IF NOT EXISTS idx_bank_account_approvals_expires_at ON public.bank_account_approvals(expires_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_bank_account_approvals_updated_at
  BEFORE UPDATE ON public.bank_account_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.bank_account_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Teens can read their own approval requests
CREATE POLICY "Teens can read own bank account approvals" ON public.bank_account_approvals
  FOR SELECT USING (teen_id = auth.uid());

-- Teens can insert their own approval requests
CREATE POLICY "Teens can create bank account approvals" ON public.bank_account_approvals
  FOR INSERT WITH CHECK (teen_id = auth.uid());

-- Teens can update their own approval requests (for OTP verification)
CREATE POLICY "Teens can update own bank account approvals" ON public.bank_account_approvals
  FOR UPDATE USING (teen_id = auth.uid());

-- Admins can read all approvals
CREATE POLICY "Admins can read all bank account approvals" ON public.bank_account_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

