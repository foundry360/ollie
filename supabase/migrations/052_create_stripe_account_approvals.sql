-- Create stripe_account_approvals table for parent approval of Stripe account setup
-- This table stores parent approval requests for teens to set up Stripe accounts

CREATE TABLE IF NOT EXISTS public.stripe_account_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT, -- Optional reason for rejection
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teen_id) -- Only one approval request per teen
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_account_approvals_teen_id ON public.stripe_account_approvals(teen_id);
CREATE INDEX IF NOT EXISTS idx_stripe_account_approvals_parent_id ON public.stripe_account_approvals(parent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_account_approvals_status ON public.stripe_account_approvals(status);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_stripe_account_approvals_updated_at
  BEFORE UPDATE ON public.stripe_account_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.stripe_account_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Teens can read their own approval requests
CREATE POLICY "Teens can read own stripe account approvals" ON public.stripe_account_approvals
  FOR SELECT USING (teen_id = auth.uid());

-- Parents can read approval requests for their teens
CREATE POLICY "Parents can read stripe account approvals for their teens" ON public.stripe_account_approvals
  FOR SELECT USING (parent_id = auth.uid());

-- Parents can update approval status
CREATE POLICY "Parents can update stripe account approvals" ON public.stripe_account_approvals
  FOR UPDATE USING (parent_id = auth.uid());

-- Admins can read all approvals
CREATE POLICY "Admins can read all stripe account approvals" ON public.stripe_account_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );




