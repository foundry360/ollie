-- Make otp_code nullable to support Twilio Verify
-- With Twilio Verify, we store the verification SID (not a code) which is set after the API call succeeds
-- This allows us to create the approval record first, then update it with the verification SID

ALTER TABLE public.bank_account_approvals 
ALTER COLUMN otp_code DROP NOT NULL;

-- Update comment to reflect new usage
COMMENT ON COLUMN public.bank_account_approvals.otp_code IS 'Twilio Verify verification SID (starts with VE...) or legacy 6-digit OTP code';



