-- ============================================
-- TEST: Neighbor Applications Migration
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- This combines both migration files for easy testing
-- ============================================

-- Migration 010: Create table and structure
-- ============================================

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
DROP TRIGGER IF EXISTS update_pending_neighbor_applications_updated_at ON public.pending_neighbor_applications;
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

-- ============================================
-- Migration 011: RLS Policies
-- ============================================

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can read own pending application" ON public.pending_neighbor_applications;
DROP POLICY IF EXISTS "Users can create own pending application" ON public.pending_neighbor_applications;
DROP POLICY IF EXISTS "Users can update own pending application" ON public.pending_neighbor_applications;
DROP POLICY IF EXISTS "Admins can read all pending applications" ON public.pending_neighbor_applications;
DROP POLICY IF EXISTS "Admins can update all pending applications" ON public.pending_neighbor_applications;

-- Policy: Users can read their own pending application
CREATE POLICY "Users can read own pending application" ON public.pending_neighbor_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own pending application
CREATE POLICY "Users can create own pending application" ON public.pending_neighbor_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending application (for phone verification, address/DOB)
CREATE POLICY "Users can update own pending application" ON public.pending_neighbor_applications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can read all pending applications
CREATE POLICY "Admins can read all pending applications" ON public.pending_neighbor_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Admins can update all pending applications (approve/reject)
CREATE POLICY "Admins can update all pending applications" ON public.pending_neighbor_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after the migration to verify everything worked

-- 1. Check if table exists and has correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pending_neighbor_applications'
ORDER BY ordinal_position;

-- 2. Check if indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'pending_neighbor_applications'
  AND schemaname = 'public';

-- 3. Check if users table has new columns
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('address', 'application_status');

-- 4. Check if functions exist
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_pending_neighbor_applications_updated_at',
    'expire_old_pending_neighbor_applications'
  );

-- 5. Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'pending_neighbor_applications';

-- 6. Check RLS policies
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'pending_neighbor_applications';

-- 7. Test insert (will fail if RLS is too restrictive, but that's expected without auth)
-- This is just to verify the table structure accepts data
-- Note: This will fail due to RLS if not authenticated, which is expected
/*
INSERT INTO public.pending_neighbor_applications (
  email, full_name, phone, user_id
) VALUES (
  'test@example.com', 
  'Test User', 
  '+1234567890',
  '00000000-0000-0000-0000-000000000000'::uuid
) ON CONFLICT DO NOTHING;
*/
