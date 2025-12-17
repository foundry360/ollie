# Deploy Edge Function - Parent Approval Email

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** or **"New Function"**
3. Name it: `send-parent-approval-email`
4. Copy the entire contents of `supabase/functions/send-parent-approval-email/index.ts`
5. Paste it into the code editor
6. Click **"Deploy"**

## Option 2: Deploy via CLI

1. **Login to Supabase** (run this in your terminal):
   ```bash
   npx supabase login
   ```
   This will open a browser for authentication.

2. **Link your project**:
   ```bash
   npx supabase link --project-ref enxxlckxhcttvsxnjfnw
   ```
   (Your project ref is in your .env file)

3. **Deploy the function**:
   ```bash
   npx supabase functions deploy send-parent-approval-email
   ```

## After Deployment

1. Make sure your SMTP secrets are set in **Edge Functions** → **Secrets**:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `SMTP_FROM`
   - `SMTP_FROM_NAME`

2. Test by submitting a teen signup request and check the Edge Function logs!

