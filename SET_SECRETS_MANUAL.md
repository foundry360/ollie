# Set Secrets Manually in Supabase Dashboard

Since CLI installation had issues, here's how to set secrets manually:

## For Each Function:

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on the function name
3. Go to **Settings** tab → **Secrets** section
4. Click **"Add Secret"** or **"New Secret"**
5. Add each secret below

---

## Function: `generate-twilio-token`

Add these secrets:
- **Name:** `TWILIO_ACCOUNT_SID` → **Value:** `YOUR_TWILIO_ACCOUNT_SID`
- **Name:** `TWILIO_API_KEY_SID` → **Value:** `YOUR_TWILIO_API_KEY_SID`
- **Name:** `TWILIO_API_KEY_SECRET` → **Value:** `YOUR_TWILIO_API_KEY_SECRET`
- **Name:** `TWILIO_CONVERSATIONS_SERVICE_SID` → **Value:** `YOUR_TWILIO_CONVERSATIONS_SERVICE_SID`
- **Name:** `SUPABASE_URL` → **Value:** `YOUR_SUPABASE_URL`
- **Name:** `SUPABASE_ANON_KEY` → **Value:** `YOUR_SUPABASE_ANON_KEY`

---

## Function: `manage-twilio-conversation`

Add these secrets:
- **Name:** `TWILIO_ACCOUNT_SID` → **Value:** `YOUR_TWILIO_ACCOUNT_SID`
- **Name:** `TWILIO_AUTH_TOKEN` → **Value:** `YOUR_TWILIO_AUTH_TOKEN`
- **Name:** `TWILIO_CONVERSATIONS_SERVICE_SID` → **Value:** `YOUR_TWILIO_CONVERSATIONS_SERVICE_SID`
- **Name:** `SUPABASE_URL` → **Value:** `YOUR_SUPABASE_URL`
- **Name:** `SUPABASE_ANON_KEY` → **Value:** `YOUR_SUPABASE_ANON_KEY`
- **Name:** `SUPABASE_SERVICE_ROLE_KEY` → **Value:** `YOUR_SUPABASE_SERVICE_ROLE_KEY`

---

## Function: `send-twilio-message`

Add these secrets:
- **Name:** `TWILIO_ACCOUNT_SID` → **Value:** `YOUR_TWILIO_ACCOUNT_SID`
- **Name:** `TWILIO_AUTH_TOKEN` → **Value:** `YOUR_TWILIO_AUTH_TOKEN`
- **Name:** `SUPABASE_URL` → **Value:** `YOUR_SUPABASE_URL`
- **Name:** `SUPABASE_ANON_KEY` → **Value:** `YOUR_SUPABASE_ANON_KEY`

---

## Function: `twilio-webhook`

Add these secrets:
- **Name:** `TWILIO_AUTH_TOKEN` → **Value:** `YOUR_TWILIO_AUTH_TOKEN`
- **Name:** `SUPABASE_SERVICE_ROLE_KEY` → **Value:** `YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Name:** `SUPABASE_URL` → **Value:** `YOUR_SUPABASE_URL`

---

## Function: `get-twilio-messages`

Add these secrets:
- **Name:** `TWILIO_ACCOUNT_SID` → **Value:** `YOUR_TWILIO_ACCOUNT_SID`
- **Name:** `TWILIO_AUTH_TOKEN` → **Value:** `YOUR_TWILIO_AUTH_TOKEN`
- **Name:** `SUPABASE_URL` → **Value:** `YOUR_SUPABASE_URL`
- **Name:** `SUPABASE_ANON_KEY` → **Value:** `YOUR_SUPABASE_ANON_KEY`

---

## Quick Steps:

1. Open Supabase Dashboard → Edge Functions
2. Click each function (5 total)
3. Settings → Secrets → Add Secret
4. Copy/paste the Name and Value from above
5. Click Save/Add for each secret

Done! ✅







