-- Migration: Add DELETE policy for gigs table
-- Allow posters to delete their own gigs only if status is 'open' or 'accepted'

CREATE POLICY "Posters can delete own open or accepted gigs" ON public.gigs
  FOR DELETE USING (poster_id = auth.uid() AND status IN ('open', 'accepted'));

COMMENT ON POLICY "Posters can delete own open or accepted gigs" ON public.gigs IS 
  'Allows posters to delete their own gigs only when status is open or accepted. Prevents deletion of in-progress, completed, or cancelled gigs.';



