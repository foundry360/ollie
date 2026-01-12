# Deployment Instructions

## Quick Deploy

1. **Login to Supabase** (if not already logged in):
   ```bash
   supabase login
   ```
   Or if using npx:
   ```bash
   npx supabase login
   ```

2. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Find your project ref in the Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

3. **Deploy the function**:
   ```bash
   # Using the deployment script
   ./deploy.sh YOUR_PROJECT_REF

   # Or directly with Supabase CLI
   supabase functions deploy send-prelaunch-confirmation-email

   # Or with npx
   npx supabase functions deploy send-prelaunch-confirmation-email
   ```

## Configure Secrets

Since you're already sending emails through other functions (like `send-neighbor-approval-email`), your Resend secrets are likely already configured at the project level. The function will automatically use:

- `RESEND_API_KEY` (already configured)
- `RESEND_FROM_EMAIL` (already configured, defaults to "onboarding@resend.dev")
- `RESEND_FROM_NAME` (already configured, defaults to "Ollie")

### Optional Additional Secrets:

If you want to customize these or add image support, you can set them in the Supabase Dashboard:

1. Go to: **Project Settings → Edge Functions → send-prelaunch-confirmation-email**
2. Click **Secrets** tab
3. Add any optional secrets:

- `EMAIL_HEADER_URL` - Full URL to launchemail.png (if hosting elsewhere)
- `SUPABASE_URL` - Your Supabase project URL (for auto-constructing launchemail.png URL)
- `CONNECTED_BODY_URL` - URL to a body image (optional)

**Note:** If secrets are set at the project level, they'll be available to all functions automatically.

## Test the Deployment

### Preview Email (GET request):
```bash
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-prelaunch-confirmation-email?fullName=Jane+Smith&recipientType=teen"
```

### Send Test Email (POST request):
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-prelaunch-confirmation-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Jane Smith",
    "recipientType": "teen"
  }'
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_ANON_KEY` with your Supabase anonymous key (from Project Settings → API)

## Host launchemail.png (Optional but Recommended)

To use the launchemail.png header image:

1. **Option 1: Supabase Storage**
   - Create a public bucket named `email-assets` in Supabase Storage
   - Upload `launchemail.png` to that bucket
   - Set `SUPABASE_URL` secret (URL will be auto-constructed)

2. **Option 2: Host Elsewhere**
   - Upload `launchemail.png` to your CDN, website, or static hosting
   - Set `EMAIL_HEADER_URL` secret to the full URL (e.g., `https://yourdomain.com/images/launchemail.png`)

If the image isn't configured, emails will still work but will show a text header instead.

