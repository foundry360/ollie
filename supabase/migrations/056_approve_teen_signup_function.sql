-- Function to approve teen signup that bypasses RLS
CREATE OR REPLACE FUNCTION public.approve_teen_signup(p_token TEXT)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  parent_email TEXT,
  status TEXT,
  approved_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup RECORD;
BEGIN
  -- Get the pending signup
  SELECT * INTO v_signup
  FROM public.pending_teen_signups
  WHERE pending_teen_signups.approval_token = p_token
    AND pending_teen_signups.status = 'pending';
  
  -- Check if found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending signup not found or already processed';
  END IF;
  
  -- Check if expired
  IF v_signup.token_expires_at < NOW() THEN
    -- Mark as expired
    UPDATE public.pending_teen_signups
    SET status = 'expired'
    WHERE pending_teen_signups.id = v_signup.id;
    RAISE EXCEPTION 'Approval token has expired';
  END IF;
  
  -- Update to approved
  UPDATE public.pending_teen_signups
  SET 
    status = 'approved',
    approved_at = NOW()
  WHERE pending_teen_signups.id = v_signup.id;
  
  -- Return the updated record
  RETURN QUERY
  SELECT 
    v_signup.id,
    v_signup.full_name,
    v_signup.parent_email,
    'approved'::TEXT,
    NOW();
END;
$$;

-- Grant execute to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.approve_teen_signup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_teen_signup(TEXT) TO authenticated;

-- Function to reject teen signup that bypasses RLS
CREATE OR REPLACE FUNCTION public.reject_teen_signup(p_token TEXT)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  parent_email TEXT,
  status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup RECORD;
BEGIN
  -- Get the pending signup
  SELECT * INTO v_signup
  FROM public.pending_teen_signups
  WHERE pending_teen_signups.approval_token = p_token
    AND pending_teen_signups.status = 'pending';
  
  -- Check if found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending signup not found or already processed';
  END IF;
  
  -- Update to rejected
  UPDATE public.pending_teen_signups
  SET status = 'rejected'
  WHERE pending_teen_signups.id = v_signup.id;
  
  -- Return the updated record
  RETURN QUERY
  SELECT 
    v_signup.id,
    v_signup.full_name,
    v_signup.parent_email,
    'rejected'::TEXT;
END;
$$;

-- Grant execute to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.reject_teen_signup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reject_teen_signup(TEXT) TO authenticated;

