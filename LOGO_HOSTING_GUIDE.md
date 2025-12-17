# How to Create a Publicly Accessible Logo URL for Emails

There are several ways to host your logo so it can be accessed in emails. Here are the best options:

## Option 1: Supabase Storage (Recommended - Free & Easy)

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on "Storage" in the left sidebar

2. **Create a Public Bucket**
   - Click "New bucket"
   - Name it: `public-assets` (or any name you prefer)
   - Make sure "Public bucket" is **enabled** (toggle it on)
   - Click "Create bucket"

3. **Upload Your Logo**
   - Click on the bucket you just created
   - Click "Upload file"
   - Select your `logo.png` from `assets/logo.png`
   - Wait for upload to complete

4. **Get the Public URL**
   - Click on the uploaded file
   - Copy the "Public URL" - it will look like:
     ```
     https://[your-project-ref].supabase.co/storage/v1/object/public/public-assets/logo.png
     ```

5. **Add to Edge Function Secrets**
   - Go to Edge Functions → Secrets
   - Add new secret:
     - Key: `LOGO_URL`
     - Value: The public URL you copied
   - Save

## Option 2: GitHub (Free & Simple)

### Steps:

1. **Create a GitHub Repository** (or use existing)
   - Create a new repo or use an existing one
   - Make it public (or use GitHub Pages)

2. **Upload Logo**
   - Create a folder like `public` or `assets`
   - Upload `logo.png` to that folder
   - Commit and push

3. **Get the Raw URL**
   - Go to your file on GitHub
   - Click "Raw" button
   - Copy the URL - it will look like:
     ```
     https://raw.githubusercontent.com/[username]/[repo]/main/assets/logo.png
     ```

4. **Add to Edge Function Secrets**
   - Same as Option 1, step 5

## Option 3: Cloudinary (Free Tier Available)

### Steps:

1. **Sign up at cloudinary.com** (Free tier available)

2. **Upload Your Logo**
   - Go to Media Library
   - Click "Upload"
   - Select your logo
   - Wait for upload

3. **Get the URL**
   - Click on the uploaded image
   - Copy the "URL" - it will look like:
     ```
     https://res.cloudinary.com/[cloud-name]/image/upload/v[version]/logo.png
     ```

4. **Add to Edge Function Secrets**
   - Same as Option 1, step 5

## Option 4: Your Own Website/CDN

If you have a website or CDN:

1. **Upload logo to your server/CDN**
2. **Get the full URL** (e.g., `https://yourdomain.com/logo.png`)
3. **Add to Edge Function Secrets** as `LOGO_URL`

## Quick Test

After setting up the URL, you can test it by:
1. Opening the URL in a browser - you should see your logo
2. Redeploying the Edge Function
3. Sending a test email

## Troubleshooting

- **Logo not showing?** Make sure the URL is publicly accessible (try opening it in an incognito browser)
- **CORS issues?** Supabase Storage handles this automatically
- **HTTPS required?** Most email clients require HTTPS URLs

## Recommended: Supabase Storage

Supabase Storage is recommended because:
- ✅ Free tier available
- ✅ Already part of your Supabase project
- ✅ Easy to manage
- ✅ Fast CDN delivery
- ✅ No external dependencies

