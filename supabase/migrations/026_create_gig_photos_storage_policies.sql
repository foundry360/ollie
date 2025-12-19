-- Storage policies for gig-photos bucket
-- These policies allow authenticated users to upload gig photos and public read access
-- Note: File naming convention: gig-{gigId}-{timestamp}-{randomId}.{ext} or {userId}-{timestamp}-{randomId}.{ext}

-- Policy 1: Allow authenticated users to upload gig photos
CREATE POLICY "Authenticated users can upload gig photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gig-photos');

-- Policy 2: Allow public read access to gig photos (so photos can be displayed)
CREATE POLICY "Public can view gig photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gig-photos');

-- Policy 3: Allow authenticated users to update gig photos
-- Users can update files that contain their user ID in the filename
-- (for files uploaded without a gigId) or any gig photo (app-level RLS handles ownership)
CREATE POLICY "Users can update own gig photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gig-photos' AND
  (
    name LIKE '%' || auth.uid()::text || '%' OR
    name LIKE 'gig-%' -- Allow updates to any gig photo (gig ownership checked at app level)
  )
)
WITH CHECK (
  bucket_id = 'gig-photos' AND
  (
    name LIKE '%' || auth.uid()::text || '%' OR
    name LIKE 'gig-%'
  )
);

-- Policy 4: Allow authenticated users to delete gig photos
-- Users can delete files that contain their user ID in the filename
-- (for files uploaded without a gigId) or any gig photo (app-level RLS handles ownership)
CREATE POLICY "Users can delete own gig photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gig-photos' AND
  (
    name LIKE '%' || auth.uid()::text || '%' OR
    name LIKE 'gig-%' -- Allow deletion of any gig photo (gig ownership checked at app level)
  )
);
