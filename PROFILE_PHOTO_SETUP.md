# Profile Photo Upload Setup

## Overview
The profile screen now supports uploading profile photos to Supabase Storage. Users can take a photo or choose from their library, and the image will be uploaded to Supabase Storage and displayed in their profile.

## Setup Required

### 1. Create Supabase Storage Bucket

Go to your Supabase Dashboard → **Storage** → **Create Bucket**

**Bucket Settings:**
- **Name**: `avatars`
- **Public**: ✅ Yes (so profile photos can be accessed via public URLs)
- **File size limit**: 5 MB (recommended)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### 2. Set Up Storage Policies

**Option A: Run Migration (Recommended)**

Run the migration file in Supabase SQL Editor:
```
supabase/migrations/017_storage_policies_avatars.sql
```

**Option B: Manual Setup via Dashboard**

After creating the bucket, go to **Storage** → **Policies** → **avatars** and create these policies:

#### Policy 1: Allow authenticated users to upload profile photos
```sql
CREATE POLICY "Authenticated users can upload profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos'
);
```

#### Policy 2: Allow users to update their own profile photos
```sql
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
```

#### Policy 3: Allow users to delete their own profile photos
```sql
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profile-photos' AND
  name LIKE '%' || auth.uid()::text || '%'
);
```

#### Policy 4: Public read access (so photos can be displayed)
```sql
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

**Option C: Simple Policy (Less Secure - For Testing)**

If you want a simpler setup for testing (allows any authenticated user to manage any file in profile-photos):

```sql
CREATE POLICY "Authenticated users can manage profile photos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'profile-photos')
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'profile-photos');

CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

## How It Works

1. **User selects photo**: User taps on profile photo → Action sheet appears
2. **Photo selection**: User chooses "Take Photo" or "Choose from Library"
3. **Image picker**: Opens camera or photo library
4. **Upload**: Photo is automatically uploaded to Supabase Storage
5. **URL stored**: Public URL is saved to `users.profile_photo_url`
6. **Display**: Photo is displayed in profile header

## Features

✅ **Always accessible**: Photo can be changed anytime (not just in edit mode)  
✅ **Action sheet**: Clean UI with options for camera/library/remove  
✅ **Auto-upload**: Photo uploads immediately when selected  
✅ **Old photo cleanup**: Previous photos are automatically deleted  
✅ **Loading state**: Shows "Uploading photo..." while processing  
✅ **Error handling**: Clear error messages if upload fails  

## File Structure

- **Storage bucket**: `avatars`
- **File path**: `profile-photos/{userId}-{timestamp}.{ext}`
- **Database field**: `users.profile_photo_url` (TEXT)

## Testing

1. Go to Profile screen
2. Tap on the profile photo placeholder
3. Choose "Take Photo" or "Choose from Library"
4. Select/capture a photo
5. Wait for "Uploading photo..." message
6. Verify photo appears in profile
7. Check Supabase Storage → `avatars` bucket → `profile-photos` folder

## Troubleshooting

**Error: "Failed to upload image"**
- Check that the `avatars` bucket exists
- Verify storage policies are set correctly
- Check file size (should be < 5MB)

**Error: "User not authenticated"**
- Ensure user is logged in
- Check Supabase auth session

**Photo not displaying**
- Verify bucket is set to **Public**
- Check that `profile_photo_url` is saved in database
- Verify the public URL is accessible
