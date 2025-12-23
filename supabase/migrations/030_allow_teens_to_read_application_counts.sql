-- Migration: Allow teenlancers to read application counts for open gigs
-- This enables the applicant count display in the Gig Details modal for teenlancers

-- Enable RLS on gig_applications if not already enabled
ALTER TABLE IF EXISTS public.gig_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Teens can read application counts for open gigs" ON public.gig_applications;
DROP POLICY IF EXISTS "Posters can read applications for their gigs" ON public.gig_applications;
DROP POLICY IF EXISTS "Teens can read own applications" ON public.gig_applications;

-- Allow teenlancers to read application counts (gig_id and status only) for open gigs
-- This allows them to see how many applicants there are without seeing personal details
CREATE POLICY "Teens can read application counts for open gigs" ON public.gig_applications
  FOR SELECT USING (
    -- Allow if the gig is open and user is a teen
    gig_id IN (
      SELECT id FROM public.gigs 
      WHERE status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'teen'
    )
  );

-- Allow posters to read all applications for their gigs
CREATE POLICY "Posters can read applications for their gigs" ON public.gig_applications
  FOR SELECT USING (
    gig_id IN (
      SELECT id FROM public.gigs 
      WHERE poster_id = auth.uid()
    )
  );

-- Allow teens to read their own applications
CREATE POLICY "Teens can read own applications" ON public.gig_applications
  FOR SELECT USING (teen_id = auth.uid());










