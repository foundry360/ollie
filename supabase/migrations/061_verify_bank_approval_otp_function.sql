-- Function to verify bank account approval OTP using Twilio Verify
-- This bypasses Supabase auth to avoid session conflicts
-- Uses the verification SID stored in bank_account_approvals.otp_code

CREATE OR REPLACE FUNCTION verify_bank_approval_otp(
  p_teen_id UUID,
  p_otp_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval RECORD;
  v_verification_sid TEXT;
  v_parent_phone TEXT;
  v_result JSONB;
BEGIN
  -- Get the approval record
  SELECT * INTO v_approval
  FROM bank_account_approvals
  WHERE teen_id = p_teen_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending approval found'
    );
  END IF;
  
  -- Check if expired
  IF v_approval.expires_at <= NOW() THEN
    UPDATE bank_account_approvals
    SET status = 'expired'
    WHERE id = v_approval.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP code has expired'
    );
  END IF;
  
  -- Check max attempts
  IF v_approval.attempts >= 5 THEN
    UPDATE bank_account_approvals
    SET status = 'expired'
    WHERE id = v_approval.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum verification attempts reached'
    );
  END IF;
  
  -- Get verification SID and parent phone
  v_verification_sid := v_approval.otp_code;
  v_parent_phone := v_approval.parent_phone;
  
  -- If verification SID doesn't start with VE, it means we're using Supabase auth
  -- In that case, we can't verify here - return error
  IF v_verification_sid IS NULL OR v_verification_sid NOT LIKE 'VE%' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Verification not initialized. Please request a new OTP code.'
    );
  END IF;
  
  -- Note: Actual Twilio Verify API call should be done in an edge function
  -- This function just validates the approval record and returns the verification SID
  -- The client will need to call an edge function to actually verify with Twilio
  
  RETURN jsonb_build_object(
    'success', true,
    'verification_sid', v_verification_sid,
    'parent_phone', v_parent_phone,
    'approval_id', v_approval.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_bank_approval_otp(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION verify_bank_approval_otp IS 'Validates bank account approval OTP request. Returns verification SID for Twilio Verify API call.';

