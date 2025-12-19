-- Migration: Create reviews table for ratings and reviews
-- Allows posters to rate teens and teens to rate posters after gig completion

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one review per gig per reviewer
  UNIQUE(gig_id, reviewer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_gig_id ON public.reviews(gig_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view reviews they wrote
CREATE POLICY "Users can view own reviews" ON public.reviews
  FOR SELECT USING (reviewer_id = auth.uid());

-- Users can view reviews about them
CREATE POLICY "Users can view reviews about them" ON public.reviews
  FOR SELECT USING (reviewee_id = auth.uid());

-- Anyone can view reviews for completed gigs (for public profiles)
CREATE POLICY "Anyone can view reviews for completed gigs" ON public.reviews
  FOR SELECT USING (
    gig_id IN (
      SELECT id FROM public.gigs WHERE status = 'completed'
    )
  );

-- Users can create reviews for gigs they were involved in
CREATE POLICY "Users can create reviews for their gigs" ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid() AND
    gig_id IN (
      SELECT id FROM public.gigs 
      WHERE (poster_id = auth.uid() OR teen_id = auth.uid())
      AND status = 'completed'
    ) AND
    reviewee_id IN (
      SELECT 
        CASE 
          WHEN poster_id = auth.uid() THEN teen_id
          WHEN teen_id = auth.uid() THEN poster_id
        END
      FROM public.gigs
      WHERE id = gig_id
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE USING (reviewer_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.reviews IS 'Stores ratings and reviews between posters and teens for completed gigs';
