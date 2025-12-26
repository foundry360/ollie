-- Simplify reviews policy - allow all authenticated users to read all reviews
-- This ensures all posters can see all reviews without any restrictions

-- Drop the existing policy
DROP POLICY IF EXISTS "Anyone can read public reviews" ON public.reviews;

-- Create a simple policy that allows all authenticated users to read all reviews
-- This is the simplest approach - any authenticated user can read any review
CREATE POLICY "Anyone can read public reviews" ON public.reviews
  FOR SELECT USING (
    -- Allow all authenticated users to read all reviews
    auth.uid() IS NOT NULL
  );

COMMENT ON POLICY "Anyone can read public reviews" ON public.reviews IS 'Allows all authenticated users to read all reviews. Simple and permissive policy.';

