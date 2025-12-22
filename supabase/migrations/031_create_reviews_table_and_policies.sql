-- Create reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID REFERENCES public.gigs(id) ON DELETE CASCADE, -- Nullable to allow general reviews
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make gig_id nullable if the table already exists and column is NOT NULL
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reviews' 
    AND column_name = 'gig_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.reviews ALTER COLUMN gig_id DROP NOT NULL;
  END IF;
END $$;

-- Enable RLS on reviews table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_gig_id ON public.reviews(gig_id) WHERE gig_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- RLS Policies for reviews
-- Drop existing policies if they exist to avoid conflicts

DROP POLICY IF EXISTS "Users can read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can read public reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;

-- Users can read reviews where they are the reviewer or reviewee
CREATE POLICY "Users can read own reviews" ON public.reviews
  FOR SELECT USING (
    reviewer_id = auth.uid() OR 
    reviewee_id = auth.uid()
  );

-- Anyone can read reviews for public profiles (teenlancers)
-- This allows neighbors to see reviews of teenlancers
CREATE POLICY "Anyone can read public reviews" ON public.reviews
  FOR SELECT USING (
    reviewee_id IN (
      SELECT id FROM public.users 
      WHERE role = 'teen' AND verified = true
    )
  );

-- Users can insert reviews where they are the reviewer
CREATE POLICY "Users can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE USING (reviewer_id = auth.uid());

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


