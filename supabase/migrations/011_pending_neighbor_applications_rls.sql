-- RLS Policies for pending_neighbor_applications table

-- Enable RLS (should already be enabled in table creation, but ensure it)
ALTER TABLE public.pending_neighbor_applications ENABLE ROW LEVEL SECURITY;

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

-- Policy: Service role can do everything (for server-side operations)
-- Note: Service role bypasses RLS by default, but we can be explicit
-- This is handled by Supabase service role, no explicit policy needed
