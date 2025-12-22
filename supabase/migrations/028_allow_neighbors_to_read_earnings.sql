-- Allow neighbors to read earnings for gigs they posted
-- This enables the neighbor wallet feature

-- Drop existing policy if it exists (we'll recreate it with both conditions)
DROP POLICY IF EXISTS "Teens can read own earnings" ON public.earnings;

-- Create policy that allows both teens and neighbors to read relevant earnings
CREATE POLICY "Users can read relevant earnings" ON public.earnings
  FOR SELECT USING (
    -- Teens can read their own earnings
    teen_id = auth.uid() OR
    -- Neighbors can read earnings for gigs they posted
    gig_id IN (
      SELECT id FROM public.gigs WHERE poster_id = auth.uid()
    )
  );




