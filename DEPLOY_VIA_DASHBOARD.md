# Deploy Twilio Edge Functions via Supabase Dashboard

This guide shows you how to deploy Edge Functions directly through the Supabase web interface (no CLI required).

## Step 1: Navigate to Edge Functions

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **enxxlckxhcttvsxnjfnw**
3. Click on **Edge Functions** in the left sidebar

---

## Step 2: Deploy Each Function

For each function below, follow these steps:

### Function 1: generate-twilio-token

1. Click **"Create a new function"** or **"New Function"**
2. Name it: `generate-twilio-token`
3. Copy and paste the code from `supabase/functions/generate-twilio-token/index.ts`
4. Click **"Deploy"** or **"Save"**
5. Wait for deployment to complete

### Function 2: manage-twilio-conversation

1. Click **"Create a new function"** or **"New Function"**
2. Name it: `manage-twilio-conversation`
3. Copy and paste the code from `supabase/functions/manage-twilio-conversation/index.ts`
4. Click **"Deploy"** or **"Save"**
5. Wait for deployment to complete

### Function 3: send-twilio-message

1. Click **"Create a new function"** or **"New Function"**
2. Name it: `send-twilio-message`
3. Copy and paste the code from `supabase/functions/send-twilio-message/index.ts`
4. Click **"Deploy"** or **"Save"**
5. Wait for deployment to complete

### Function 4: twilio-webhook

1. Click **"Create a new function"** or **"New Function"**
2. Name it: `twilio-webhook`
3. Copy and paste the code from `supabase/functions/twilio-webhook/index.ts`
4. Click **"Deploy"** or **"Save"**
5. Wait for deployment to complete

### Function 5: get-twilio-messages

1. Click **"Create a new function"** or **"New Function"**
2. Name it: `get-twilio-messages`
3. Copy and paste the code from `supabase/functions/get-twilio-messages/index.ts`
4. Click **"Deploy"** or **"Save"**
5. Wait for deployment to complete

---

## Step 3: Set Secrets for Each Function

After deploying each function, you need to set secrets:

### For `generate-twilio-token`:

1. Click on the function name: `generate-twilio-token`
2. Go to **Settings** tab (or click the gear icon)
3. Scroll to **Secrets** section
4. Add each secret by clicking **"Add Secret"** or **"New Secret"**:

   - **Name:** `TWILIO_ACCOUNT_SID` → **Value:** (your Twilio Account SID)
   - **Name:** `TWILIO_API_KEY_SID` → **Value:** (your Twilio API Key SID)
   - **Name:** `TWILIO_API_KEY_SECRET` → **Value:** (your Twilio API Key Secret)
   - **Name:** `TWILIO_CONVERSATIONS_SERVICE_SID` → **Value:** `IS3cf2fe8fe4a44558ba62ab0946b7555f`
   - **Name:** `SUPABASE_URL` → **Value:** (your Supabase URL, found in Settings → API)
   - **Name:** `SUPABASE_ANON_KEY` → **Value:** (your Supabase Anon Key, found in Settings → API)

5. Click **"Save"** or **"Update"**

### For `manage-twilio-conversation`:

1. Click on the function name: `manage-twilio-conversation`
2. Go to **Settings** tab
3. Scroll to **Secrets** section
4. Add these secrets:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (found in Settings → API → service_role key)

### For `send-twilio-message`:

1. Click on the function name: `send-twilio-message`
2. Go to **Settings** tab
3. Add these secrets:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### For `twilio-webhook`:

1. Click on the function name: `twilio-webhook`
2. Go to **Settings** tab
3. Add these secrets:

   - `TWILIO_AUTH_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_URL`

### For `get-twilio-messages`:

1. Click on the function name: `get-twilio-messages`
2. Go to **Settings** tab
3. Add these secrets:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

---

## Step 4: Run Database Migrations

1. Go to **SQL Editor** in the left sidebar
2. Click **"New Query"**
3. Copy and paste the contents of `supabase/migrations/039_add_twilio_conversation_support.sql`
4. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
5. Wait for it to complete
6. Repeat for `supabase/migrations/040_add_twilio_message_sid_to_messages.sql`

---

## Step 5: Get Your Function URLs

After deployment, your functions will be available at:

- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/generate-twilio-token`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/manage-twilio-conversation`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/send-twilio-message`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/get-twilio-messages`

**Important:** The webhook URL for Twilio is:
```
https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook
```

---

## Step 6: Configure Twilio Webhook

1. Go to Twilio Console: https://console.twilio.com
2. Navigate to **Conversations** → **Services** → Your service
3. Go to **Webhooks** or **Configuration**
4. Set the webhook URL to: `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook`
5. Select events: `onMessageAdded`, `onMessageUpdated`
6. Save

---

## Troubleshooting

### Can't find "Create a new function" button?
- Make sure you're in the **Edge Functions** section
- Some projects may show it as **"New Function"** or **"+"** button

### Function code not pasting?
- Make sure you're copying the entire contents of the `index.ts` file
- Check for any syntax errors in the code

### Secrets not saving?
- Make sure you click **"Save"** or **"Update"** after adding each secret
- Secrets are case-sensitive

### Migration errors?
- Check the SQL Editor for error messages
- Make sure you're running migrations in order (039, then 040)

---

## Summary Checklist

- [ ] Deployed `generate-twilio-token` function
- [ ] Deployed `manage-twilio-conversation` function
- [ ] Deployed `send-twilio-message` function
- [ ] Deployed `twilio-webhook` function
- [ ] Deployed `get-twilio-messages` function
- [ ] Set secrets for all 5 functions
- [ ] Ran migration `039_add_twilio_conversation_support.sql`
- [ ] Ran migration `040_add_twilio_message_sid_to_messages.sql`
- [ ] Configured Twilio webhook URL







