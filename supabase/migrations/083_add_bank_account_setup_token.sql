-- Add setup_token and token_expires_at to bank_account_approvals table
-- This enables email-based bank account setup flow where parents receive a secure link

-- Make parent_phone nullable (since we're moving to email-based flow)
ALTER TABLE public.bank_account_approvals 
ALTER COLUMN parent_phone DROP NOT NULL;

-- Add setup_token field for email link token
ALTER TABLE public.bank_account_approvals
ADD COLUMN IF NOT EXISTS setup_token TEXT UNIQUE;

-- Add token_expires_at field (7 days for email links vs 15 min for OTP)
ALTER TABLE public.bank_account_approvals
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_bank_account_approvals_setup_token 
ON public.bank_account_approvals(setup_token) 
WHERE setup_token IS NOT NULL;

-- Update comment on otp_code to indicate it's optional (email flow uses setup_token instead)
COMMENT ON COLUMN public.bank_account_approvals.otp_code IS 'Twilio Verify verification SID (legacy OTP flow) - optional, email flow uses setup_token instead';

-- Add comment for new fields
COMMENT ON COLUMN public.bank_account_approvals.setup_token IS 'Secure token for email link to set up bank account (replaces OTP flow)';
COMMENT ON COLUMN public.bank_account_approvals.token_expires_at IS 'Expiration timestamp for setup_token (typically 7 days)';

