-- Enable Row Level Security on Stripe-related tables
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- stripe_accounts RLS Policies
-- ============================================

-- Users can read their own Stripe account
CREATE POLICY "Users can read own stripe account" ON public.stripe_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own Stripe account
CREATE POLICY "Users can insert own stripe account" ON public.stripe_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own Stripe account
CREATE POLICY "Users can update own stripe account" ON public.stripe_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can read all Stripe accounts
CREATE POLICY "Admins can read all stripe accounts" ON public.stripe_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ============================================
-- payment_methods RLS Policies
-- ============================================

-- Users can read their own payment methods
CREATE POLICY "Users can read own payment methods" ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own payment methods
CREATE POLICY "Users can insert own payment methods" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment methods
CREATE POLICY "Users can update own payment methods" ON public.payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own payment methods
CREATE POLICY "Users can delete own payment methods" ON public.payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can read all payment methods
CREATE POLICY "Admins can read all payment methods" ON public.payment_methods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ============================================
-- platform_settings RLS Policies
-- ============================================

-- Anyone authenticated can read platform settings (for public settings like fee percentage)
CREATE POLICY "Authenticated users can read platform settings" ON public.platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert platform settings
CREATE POLICY "Admins can insert platform settings" ON public.platform_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Only admins can update platform settings
CREATE POLICY "Admins can update platform settings" ON public.platform_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Only admins can delete platform settings
CREATE POLICY "Admins can delete platform settings" ON public.platform_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );




