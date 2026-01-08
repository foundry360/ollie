-- Update existing transactions to:
-- 1. Recalculate platform_fee_amount to 12% for transactions that haven't been processed yet
-- 2. Estimate stripe_fee_amount for existing records (for historical tracking)
-- 3. Leave completed/paid transactions unchanged to maintain accuracy

-- Update platform_fee_amount to 12% for transactions that haven't been paid out yet
-- This only affects records where payment hasn't succeeded yet (safe to recalculate)
UPDATE public.earnings
SET 
  platform_fee_amount = ROUND(amount * 0.12, 2),
  updated_at = NOW()
WHERE 
  -- Only update records where payment hasn't been successfully charged yet
  (payment_status IS NULL OR payment_status IN ('pending', 'processing', 'failed'))
  AND 
  -- Only update if platform_fee_amount is NULL or was calculated at 10%
  (platform_fee_amount IS NULL OR ABS(platform_fee_amount - ROUND(amount * 0.10, 2)) < 0.01)
  AND
  amount > 0;

-- Estimate stripe_fee_amount for records with payment intents
-- NOTE: For old transactions, the neighbor was charged exactly 'amount' (fees were deducted from Ollie)
-- So we can estimate what the Stripe fee likely was: (amount * 0.029) + 0.30
-- This is for historical tracking only - actual fees for new transactions will be calculated correctly
UPDATE public.earnings
SET 
  stripe_fee_amount = ROUND((amount * 0.029) + 0.30, 2),
  updated_at = NOW()
WHERE 
  stripe_payment_intent_id IS NOT NULL
  AND stripe_fee_amount IS NULL
  AND amount > 0;

-- Add comments to explain the data
COMMENT ON COLUMN public.earnings.stripe_fee_amount IS 'Stripe processing fee charged to neighbor. For transactions before the fee pass-through migration, this is estimated assuming neighbor was charged the base amount. New transactions correctly calculate fees passed to neighbor.';
COMMENT ON COLUMN public.earnings.platform_fee_amount IS 'Platform fee percentage (currently 12%). Historical records may have been calculated at 10% before migration. Only pending/processing records are updated to 12%.';

