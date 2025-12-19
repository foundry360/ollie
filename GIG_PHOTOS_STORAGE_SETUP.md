# Gig Photos Storage Setup

This guide will help you set up Supabase Storage for gig photos so images are accessible across all devices.

## Steps

### 1. Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name it: `gig-photos`
5. Make it **Public** (so images can be accessed without authentication)
6. Click **Create bucket**

### 2. Set Storage Policies

After creating the bucket, run the migration script to set up the storage policies:

**Option 1: Using Supabase CLI (Recommended)**
```bash
supabase migration up
```

**Option 2: Manual SQL Execution**
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/026_create_gig_photos_storage_policies.sql`
4. Click **Run**

The migration file contains all 4 policies:
- Authenticated users can upload gig photos
- Public can view gig photos
- Users can update their own gig photos
- Users can delete their own gig photos

### 3. Verify Setup

After creating the bucket and policies:

1. Try creating a new gig with photos from your app
2. The photos should upload to Supabase Storage
3. The photos should be accessible on all devices (iPhone, iPad, etc.)
4. Check the Storage bucket in Supabase Dashboard to see uploaded photos

## Notes

- Photos are stored in the `gig-photos` bucket
- File paths follow the pattern: `gig-photos/gig-{gigId}-{timestamp}-{randomId}.{ext}`
- All photos are publicly accessible (read-only)
- Only authenticated users can upload photos
- Photos are automatically uploaded when creating or editing gigs

## Troubleshooting

If you get errors about "Bucket not found":
- Make sure the bucket name is exactly `gig-photos` (case-sensitive)
- Verify the bucket is created in your Supabase project

If you get RLS policy errors:
- Make sure all 4 policies above are created
- Check that the policies are enabled

If images still don't load:
- Verify the bucket is set to **Public**
- Check that the photos are actually uploaded (check Storage in Supabase Dashboard)
- Ensure image URLs start with `https://` (not `file://`)
