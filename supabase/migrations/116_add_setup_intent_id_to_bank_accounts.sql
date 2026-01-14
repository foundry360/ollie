-- Add stripe_setup_intent_id column to bank_accounts table
-- This column stores the Stripe SetupIntent ID used for micro-deposit verification

ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_stripe_setup_intent_id 
ON public.bank_accounts(stripe_setup_intent_id);

