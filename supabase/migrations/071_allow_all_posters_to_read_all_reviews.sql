-- Allow all posters to read all reviews
-- This ensures neighbors can see reviews of teenlancers regardless of verification status

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can read public reviews" ON public.reviews;

-- Create a new policy that allows all posters to read all reviews
-- Uses the is_current_user_poster() function to avoid RLS recursion
CREATE POLICY "Anyone can read public reviews" ON public.reviews
  FOR SELECT USING (
    -- Allow all authenticated users with role 'poster' to read all reviews
    -- Use the SECURITY DEFINER function to avoid recursion
    public.is_current_user_poster()
    OR
    -- Also allow reading reviews where you are the reviewer or reviewee
    reviewer_id = auth.uid() OR 
    reviewee_id = auth.uid()
  );

COMMENT ON POLICY "Anyone can read public reviews" ON public.reviews IS 'Allows all posters to read all reviews, and allows reading reviews of teens regardless of verification status.';

