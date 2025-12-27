-- Migration: Create favorite_teenlancers table for neighbors to favorite teenlancers
-- Allows neighbors (posters) to favorite teenlancers they want to work with again

CREATE TABLE IF NOT EXISTS public.favorite_teenlancers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poster_id, teen_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_favorite_teenlancers_poster_id ON public.favorite_teenlancers(poster_id);
CREATE INDEX IF NOT EXISTS idx_favorite_teenlancers_teen_id ON public.favorite_teenlancers(teen_id);

-- Enable RLS
ALTER TABLE public.favorite_teenlancers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Posters can view their own favorite teenlancers
CREATE POLICY "Posters can view own favorite teenlancers" ON public.favorite_teenlancers
  FOR SELECT USING (poster_id = auth.uid());

-- Posters can favorite teenlancers
CREATE POLICY "Posters can favorite teenlancers" ON public.favorite_teenlancers
  FOR INSERT WITH CHECK (poster_id = auth.uid());

-- Posters can unfavorite teenlancers
CREATE POLICY "Posters can unfavorite teenlancers" ON public.favorite_teenlancers
  FOR DELETE USING (poster_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.favorite_teenlancers IS 'Allows neighbors (posters) to favorite teenlancers they want to work with again';

