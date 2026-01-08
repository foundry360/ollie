-- Migration: Add payout tracking fields to earnings table
-- This allows us to track when money is actually deposited to the teenlancer's bank account
-- vs when the neighbor's card is charged (payment_status: 'succeeded')

-- Add payout tracking columns if they don't exist
ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_status TEXT CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS payout_failed_reason TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_earnings_stripe_payout_id ON public.earnings(stripe_payout_id);
CREATE INDEX IF NOT EXISTS idx_earnings_payout_status ON public.earnings(payout_status);

-- Add comment to clarify the difference between payment_status and payout_status
COMMENT ON COLUMN public.earnings.payment_status IS 'Status of charging the neighbor''s card (pending, processing, succeeded, failed, refunded)';
COMMENT ON COLUMN public.earnings.payout_status IS 'Status of depositing money to the teenlancer''s bank account (pending, processing, paid, failed). Only set to paid when payout.paid webhook is received.';
COMMENT ON COLUMN public.earnings.status IS 'Overall earnings status. Should be pending until payout_status is paid, then set to paid.';










