-- Add stripe_fee_amount column to earnings table to track Stripe processing fees charged to neighbor

ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS stripe_fee_amount DECIMAL(10, 2) DEFAULT 0 CHECK (stripe_fee_amount >= 0);

-- Add index for stripe fee queries
CREATE INDEX IF NOT EXISTS idx_earnings_stripe_fee_amount ON public.earnings(stripe_fee_amount);















