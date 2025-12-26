# Neighbor Approval Email Function

This Edge Function sends a welcome email to neighbors when their application is approved.

## Setup Instructions

### 1. Upload Email Header Image

You need to host the email header image (`assets/email-header.png`) publicly. Choose one option:

**Option A: Supabase Storage (Recommended)**
1. Go to **Supabase Dashboard** → **Storage**
2. Create a public bucket named `email-assets` (or use existing public bucket)
3. Upload `email-header.png` to the bucket
4. Get the public URL: `https://YOUR_PROJECT.supabase.co/storage/v1/object/public/email-assets/email-header.png`

**Option B: CDN or Website**
- Upload the image to your CDN or website
- Get the full public URL (e.g., `https://olliejobs.com/images/email-header.png`)

### 2. Deploy the Edge Function

```bash
supabase functions deploy send-neighbor-approval-email
```

### 3. Set Environment Variables

Go to **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets** and set:

- `RESEND_API_KEY` - Your Resend API key (get from https://resend.com/api-keys)
- `RESEND_FROM_EMAIL` - Email address to send from (e.g., `noreply@olliejobs.com`)
- `RESEND_FROM_NAME` - Sender name (e.g., `Ollie`)
- `EMAIL_HEADER_URL` - Full public URL to the email header image (from Step 1)
- `CONNECTED_BODY_URL` - Full public URL to the connected body image (optional, upload `assets/connected-body.png`)

### 4. Test

#### Preview in Browser

**Option 1: Local HTML Preview (Easiest - No Auth Required)**

Open `preview.html` in your browser:
```bash
open supabase/functions/send-neighbor-approval-email/preview.html
```

This allows you to preview the email locally without authentication. You can customize the name and header image URL.

**Option 2: Live Function Preview**

1. **Deploy the function first:**
   ```bash
   supabase functions deploy send-neighbor-approval-email
   ```

2. **Make the function public for GET requests:**
   - Go to **Supabase Dashboard** → **Edge Functions** → **send-neighbor-approval-email**
   - Click **Settings** → Enable **Public Access** (GET requests only)
   - This allows unauthenticated GET requests for preview

3. **Open in browser:**
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/send-neighbor-approval-email?fullName=John%20Doe
   ```

**Option 3: With Authorization Header**

If you don't want to make it public, use curl with your anon key:
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/send-neighbor-approval-email?fullName=John%20Doe" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Get your anon key from **Supabase Dashboard** → **Settings** → **API** → **anon public** key.

#### Send Test Email

The email will automatically send when an admin approves a neighbor application via `approveNeighborApplication()`.

You can also test sending manually by calling the function with POST:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-neighbor-approval-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"email": "test@example.com", "fullName": "John Doe"}'
```

## Email Template

The email includes:
- Header image at the top (if `EMAIL_HEADER_URL` is configured)
- Welcome message with approval confirmation
- Login button linking to the app
- Footer with contact information

## Troubleshooting

- **Email not sending?** Check `RESEND_API_KEY` is set correctly
- **Header image not showing?** Verify `EMAIL_HEADER_URL` is a publicly accessible URL
- **Function errors?** Check Edge Functions logs in Supabase Dashboard

