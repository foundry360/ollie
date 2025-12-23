-- Storage policies for gig-photos bucket
-- Allow public read access to gig photos (so anyone can view gig images)
-- Allow authenticated users to upload/update/delete their own gig photos

-- Policy 1: Allow public read access to gig photos (so anyone can view gig images)
-- This is needed for teenlancers to see gig photos
DROP POLICY IF EXISTS "Public can view gig photos" ON storage.objects;
CREATE POLICY "Public can view gig photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gig-photos');

-- Policy 2: Allow authenticated users to upload gig photos
DROP POLICY IF EXISTS "Authenticated users can upload gig photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload gig photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gig-photos');

-- Policy 3: Allow authenticated users to update their own gig photos
DROP POLICY IF EXISTS "Users can update own gig photos" ON storage.objects;
CREATE POLICY "Users can update own gig photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gig-photos')
WITH CHECK (bucket_id = 'gig-photos');

-- Policy 4: Allow authenticated users to delete their own gig photos
DROP POLICY IF EXISTS "Users can delete own gig photos" ON storage.objects;
CREATE POLICY "Users can delete own gig photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gig-photos');








