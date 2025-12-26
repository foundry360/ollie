-- Storage policies for id-verifications bucket
-- ID photos are PRIVATE and should only be accessible by:
-- 1. The user who uploaded them (for their own application)
-- 2. Admins (for verification review)
-- 3. Service role (for automated processing - bypasses RLS)

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload own ID photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own ID photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own ID photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own ID photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all ID photos" ON storage.objects;

-- Policy 1: Allow authenticated users to upload their own ID photos
-- Files must be in a folder named with their user ID: {userId}/filename
CREATE POLICY "Users can upload own ID photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-verifications' AND
  name LIKE (auth.uid()::text || '/%')
);

-- Policy 2: Users can only read their own ID photos
CREATE POLICY "Users can read own ID photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-verifications' AND
  name LIKE (auth.uid()::text || '/%')
);

-- Policy 3: Users can update their own ID photos (if they need to replace)
CREATE POLICY "Users can update own ID photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'id-verifications' AND
  name LIKE (auth.uid()::text || '/%')
)
WITH CHECK (
  bucket_id = 'id-verifications' AND
  name LIKE (auth.uid()::text || '/%')
);

-- Policy 4: Users can delete their own ID photos (if application is rejected/cancelled)
CREATE POLICY "Users can delete own ID photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'id-verifications' AND
  name LIKE (auth.uid()::text || '/%')
);

-- Policy 5: Admins can read all ID photos (for verification review)
CREATE POLICY "Admins can read all ID photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-verifications' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

