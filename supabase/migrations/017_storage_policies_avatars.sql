-- Storage policies for avatars bucket (profile photos)
-- These policies allow authenticated users to upload, update, and delete their own profile photos

-- Policy 1: Allow authenticated users to upload profile photos
CREATE POLICY "Authenticated users can upload profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos'
);

-- Policy 2: Allow authenticated users to update their own profile photos
-- Users can only update files that contain their user ID in the filename
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos' AND
  name LIKE '%' || auth.uid()::text || '%'
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- Policy 3: Allow authenticated users to delete their own profile photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- Policy 4: Allow public read access (so profile photos can be displayed)
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
