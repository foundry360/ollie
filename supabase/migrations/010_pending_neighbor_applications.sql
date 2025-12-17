-- Pending neighbor applications table
-- Tracks neighbor signup applications through the approval process

CREATE TABLE IF NOT EXISTS public.pending_neighbor_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  date_of_birth DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_email_pending UNIQUE(email),
  CONSTRAINT unique_phone_pending UNIQUE(phone)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_neighbor_applications_user_id ON public.pending_neighbor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_neighbor_applications_email ON public.pending_neighbor_applications(email);
CREATE INDEX IF NOT EXISTS idx_pending_neighbor_applications_phone ON public.pending_neighbor_applications(phone);
CREATE INDEX IF NOT EXISTS idx_pending_neighbor_applications_status ON public.pending_neighbor_applications(status);
CREATE INDEX IF NOT EXISTS idx_pending_neighbor_applications_created_at ON public.pending_neighbor_applications(created_at DESC);

-- Add address field to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE public.users ADD COLUMN address TEXT;
  END IF;
END $$;

-- Add application_status field to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'application_status'
  ) THEN
    ALTER TABLE public.users ADD COLUMN application_status TEXT CHECK (application_status IN ('pending', 'approved', 'rejected', 'active'));
  END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_neighbor_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_pending_neighbor_applications_updated_at
  BEFORE UPDATE ON public.pending_neighbor_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_neighbor_applications_updated_at();

-- Function to automatically expire old pending applications (older than 30 days)
CREATE OR REPLACE FUNCTION expire_old_pending_neighbor_applications()
RETURNS void AS $$
BEGIN
  UPDATE public.pending_neighbor_applications
  SET status = 'rejected',
      rejection_reason = 'Application expired after 30 days without review',
      updated_at = NOW()
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.pending_neighbor_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be added in a separate migration file (following the pattern)
