-- Update earnings table to add Stripe payment tracking fields

-- Add new columns for Stripe payment tracking
ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (platform_fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_failed_reason TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_earnings_stripe_payment_intent_id ON public.earnings(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_earnings_stripe_transfer_id ON public.earnings(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_earnings_payment_status ON public.earnings(payment_status);

-- Update existing earnings records to have payment_status based on status
-- 'paid' -> 'succeeded', 'pending' -> 'pending', 'cancelled' -> 'refunded' (if applicable)
UPDATE public.earnings
SET payment_status = CASE
  WHEN status = 'paid' THEN 'succeeded'
  WHEN status = 'pending' THEN 'pending'
  WHEN status = 'cancelled' THEN 'refunded'
  ELSE 'pending'
END
WHERE payment_status = 'pending' OR payment_status IS NULL;


