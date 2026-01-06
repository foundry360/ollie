-- Migration: Fix existing earnings records that were incorrectly marked as paid
-- This migration corrects earnings records that have status='paid' but were set before the payout system
-- These records were created before the webhook fix, when payment_intent.succeeded incorrectly set status='paid'
-- 
-- Strategy: Set all earnings with status='paid' but no paid_at timestamp back to 'pending'
-- The paid_at timestamp should only be set when payout.paid webhook is received (after migration 107)

-- Update earnings records that have status='paid' but no paid_at timestamp
-- These should be treated as pending until the actual payout happens
-- We check for payment_status='succeeded' to identify records where card was charged but payout hasn't happened
UPDATE public.earnings
SET status = 'pending'
WHERE status = 'paid' 
  AND paid_at IS NULL
  AND (payment_status = 'succeeded' OR payment_status IS NULL);

-- Also clear paid_at for any records that have it but shouldn't (safety check)
-- Clear paid_at if:
-- 1. payment_status='succeeded' but payout_status is not 'paid' (card charged but payout hasn't happened)
-- 2. OR if payout_status column doesn't exist yet and payment_status='succeeded' (old data before migration 107)
-- The paid_at should ONLY be set when payout.paid webhook is received, not when payment_intent.succeeded
UPDATE public.earnings
SET paid_at = NULL
WHERE paid_at IS NOT NULL
  AND (
    -- Case 1: payout_status column exists but is not 'paid'
    (payout_status IS NOT NULL AND payout_status != 'paid')
    OR
    -- Case 2: payment_status='succeeded' but no payout_status yet (old data)
    (payment_status = 'succeeded' AND payout_status IS NULL)
  );

-- Log how many records were fixed
DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fixed_count
  FROM public.earnings
  WHERE status = 'pending'
    AND paid_at IS NULL
    AND payment_status = 'succeeded';
  
  RAISE NOTICE 'Fixed % earnings records that were incorrectly marked as paid (card charged but payout pending)', v_fixed_count;
END $$;

