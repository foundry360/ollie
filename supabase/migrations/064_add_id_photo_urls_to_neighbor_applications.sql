-- Add ID photo URL columns to pending_neighbor_applications table
-- These will store signed URLs from the id-verifications storage bucket

ALTER TABLE public.pending_neighbor_applications
ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT,
ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT;

-- Add comment to explain these are signed URLs from private storage bucket
COMMENT ON COLUMN public.pending_neighbor_applications.id_front_photo_url IS 'Signed URL to front ID photo in id-verifications bucket (private)';
COMMENT ON COLUMN public.pending_neighbor_applications.id_back_photo_url IS 'Signed URL to back ID photo in id-verifications bucket (private)';

