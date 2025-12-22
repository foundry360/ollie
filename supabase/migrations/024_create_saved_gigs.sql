-- Migration: Create saved_gigs table for teenlancers to save/bookmark gigs
-- Allows teenlancers to save gigs they're interested in for later

CREATE TABLE IF NOT EXISTS public.saved_gigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teen_id, gig_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_saved_gigs_teen_id ON public.saved_gigs(teen_id);
CREATE INDEX IF NOT EXISTS idx_saved_gigs_gig_id ON public.saved_gigs(gig_id);

-- Enable RLS
ALTER TABLE public.saved_gigs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Teens can view their own saved gigs
CREATE POLICY "Teens can view own saved gigs" ON public.saved_gigs
  FOR SELECT USING (teen_id = auth.uid());

-- Teens can save gigs
CREATE POLICY "Teens can save gigs" ON public.saved_gigs
  FOR INSERT WITH CHECK (teen_id = auth.uid());

-- Teens can unsave gigs
CREATE POLICY "Teens can unsave gigs" ON public.saved_gigs
  FOR DELETE USING (teen_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.saved_gigs IS 'Allows teenlancers to save/bookmark gigs they are interested in';










