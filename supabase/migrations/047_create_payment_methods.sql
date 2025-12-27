-- Create payment_methods table for storing payment methods for Neighbors (posters)
-- This table stores Stripe payment methods that neighbors can use to pay for completed gigs

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT, -- Stripe customer ID for the user
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'us_bank_account')),
  is_default BOOLEAN DEFAULT FALSE,
  card_brand TEXT, -- 'visa', 'mastercard', 'amex', 'discover', etc.
  card_last4 TEXT, -- Last 4 digits of the card
  card_exp_month INTEGER, -- Expiration month (1-12)
  card_exp_year INTEGER, -- Expiration year (YYYY)
  bank_name TEXT, -- Bank name for bank accounts
  bank_last4 TEXT, -- Last 4 digits for bank accounts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method_id ON public.payment_methods(stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer_id ON public.payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON public.payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default payment method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- If this payment method is being set as default, unset all other defaults for this user
  IF NEW.is_default = TRUE THEN
    UPDATE public.payment_methods
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single default payment method
CREATE TRIGGER ensure_single_default_payment_method_trigger
  BEFORE INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_method();




