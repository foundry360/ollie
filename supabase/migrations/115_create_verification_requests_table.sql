-- Create verification_requests table for ID verification
-- This table stores verification requests for all user roles (teen, poster, parent)
-- Supports multiple verification attempts and admin review workflow

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  front_photo_url TEXT NOT NULL,
  back_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- Note: One active request per user is enforced by application logic, not database constraint
  -- This allows users to resubmit after rejection
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON public.verification_requests(created_at DESC);

-- Add comment to table
COMMENT ON TABLE public.verification_requests IS 'Stores ID verification requests for all user roles. Photos are stored in private id-verifications storage bucket.';

-- Enable Row Level Security
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy 1: Users can read their own verification requests
DROP POLICY IF EXISTS "Users can read own verification requests" ON public.verification_requests;
CREATE POLICY "Users can read own verification requests"
ON public.verification_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own verification requests
DROP POLICY IF EXISTS "Users can insert own verification requests" ON public.verification_requests;
CREATE POLICY "Users can insert own verification requests"
ON public.verification_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own pending verification requests (to resubmit)
DROP POLICY IF EXISTS "Users can update own pending verification requests" ON public.verification_requests;
CREATE POLICY "Users can update own pending verification requests"
ON public.verification_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Policy 4: Admins can read all verification requests (for review)
DROP POLICY IF EXISTS "Admins can read all verification requests" ON public.verification_requests;
CREATE POLICY "Admins can read all verification requests"
ON public.verification_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 5: Admins can update verification requests (to approve/reject)
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;
CREATE POLICY "Admins can update verification requests"
ON public.verification_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_verification_requests_updated_at ON public.verification_requests;
CREATE TRIGGER update_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_requests_updated_at();

-- Function to update user.verified status when verification is approved
CREATE OR REPLACE FUNCTION update_user_verified_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When verification is approved, set user.verified = true
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.users
    SET verified = true,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  -- When verification is rejected, set user.verified = false (if it was previously verified)
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    UPDATE public.users
    SET verified = false,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update user verification status
DROP TRIGGER IF EXISTS update_user_verified_on_verification_approval ON public.verification_requests;
CREATE TRIGGER update_user_verified_on_verification_approval
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_user_verified_on_approval();

