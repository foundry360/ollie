-- Create bank_accounts table for storing bank account information for Teenlancers
-- This table stores Stripe External Accounts for ACH payouts to teens

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_external_account_id TEXT NOT NULL UNIQUE, -- Stripe bank account ID (ba_xxxxx)
  stripe_customer_id TEXT, -- Stripe customer ID (if needed for future use)
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings')),
  account_holder_name TEXT NOT NULL,
  bank_name TEXT, -- Bank name from Stripe
  routing_number TEXT NOT NULL, -- Full routing number (9 digits - public information identifying the bank)
  routing_number_last4 TEXT, -- Last 4 digits of routing number for display
  account_number_last4 TEXT NOT NULL, -- Last 4 digits of account number for display
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'unverified')),
  verification_method TEXT, -- 'microdeposits' or 'instant' (if Stripe supports)
  is_default BOOLEAN DEFAULT TRUE, -- Only one account per user for now, but allows for future expansion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ, -- When account was verified
  UNIQUE(user_id) -- Only one bank account per teen for now (can be changed later if needed)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_stripe_external_account_id ON public.bank_accounts(stripe_external_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_verification_status ON public.bank_accounts(verification_status);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own bank accounts
CREATE POLICY "Users can read own bank accounts" ON public.bank_accounts
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own bank accounts
CREATE POLICY "Users can create bank accounts" ON public.bank_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own bank accounts
CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can read all bank accounts
CREATE POLICY "Admins can read all bank accounts" ON public.bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

