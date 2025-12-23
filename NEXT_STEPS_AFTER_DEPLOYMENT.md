# Next Steps After Deploying Edge Functions

You've deployed all 5 functions! Now follow these steps:

## ✅ Step 1: Set Secrets for Each Function

Go to each function in Supabase Dashboard → Edge Functions → [Function Name] → Settings → Secrets

### Function: `generate-twilio-token`
Add these secrets:
- `TWILIO_ACCOUNT_SID` = (your Twilio Account SID)
- `TWILIO_API_KEY_SID` = (your Twilio API Key SID)
- `TWILIO_API_KEY_SECRET` = (your Twilio API Key Secret)
- `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
- `SUPABASE_URL` = (found in Settings → API → Project URL)
- `SUPABASE_ANON_KEY` = (found in Settings → API → anon/public key)

### Function: `manage-twilio-conversation`
Add these secrets:
- `TWILIO_ACCOUNT_SID` = (your Twilio Account SID)
- `TWILIO_AUTH_TOKEN` = (your Twilio Auth Token)
- `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
- `SUPABASE_URL` = (found in Settings → API → Project URL)
- `SUPABASE_ANON_KEY` = (found in Settings → API → anon/public key)
- `SUPABASE_SERVICE_ROLE_KEY` = (found in Settings → API → service_role key - **keep this secret!**)

### Function: `send-twilio-message`
Add these secrets:
- `TWILIO_ACCOUNT_SID` = (your Twilio Account SID)
- `TWILIO_AUTH_TOKEN` = (your Twilio Auth Token)
- `SUPABASE_URL` = (found in Settings → API → Project URL)
- `SUPABASE_ANON_KEY` = (found in Settings → API → anon/public key)

### Function: `twilio-webhook`
Add these secrets:
- `TWILIO_AUTH_TOKEN` = (your Twilio Auth Token)
- `SUPABASE_SERVICE_ROLE_KEY` = (found in Settings → API → service_role key)
- `SUPABASE_URL` = (found in Settings → API → Project URL)

### Function: `get-twilio-messages`
Add these secrets:
- `TWILIO_ACCOUNT_SID` = (your Twilio Account SID)
- `TWILIO_AUTH_TOKEN` = (your Twilio Auth Token)
- `SUPABASE_URL` = (found in Settings → API → Project URL)
- `SUPABASE_ANON_KEY` = (found in Settings → API → anon/public key)

---

## ✅ Step 2: Run Database Migrations

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **"New Query"**
3. Copy and paste the SQL from `supabase/migrations/039_add_twilio_conversation_support.sql` (see below)
4. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
5. Wait for success message
6. Create a new query and run `supabase/migrations/040_add_twilio_message_sid_to_messages.sql` (see below)

### Migration 1: Add Twilio Conversation Support

```sql
-- Add Twilio Conversations support
CREATE TABLE IF NOT EXISTS public.gig_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  participant1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twilio_conversation_sid TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gig_id, participant1_id, participant2_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_conversations_gig_id ON public.gig_conversations(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_participant1_id ON public.gig_conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_participant2_id ON public.gig_conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_twilio_sid ON public.gig_conversations(twilio_conversation_sid);

ALTER TABLE public.gig_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversations" ON public.gig_conversations
  FOR SELECT USING (
    participant1_id = auth.uid() OR participant2_id = auth.uid()
  );

CREATE POLICY "System can create conversations" ON public.gig_conversations
  FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_gig_conversations_updated_at
  BEFORE UPDATE ON public.gig_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Migration 2: Add Twilio Message SID to Messages

```sql
-- Add twilio_message_sid to messages table for webhook deduplication
-- This allows us to track which Twilio messages have been synced to Supabase

ALTER TABLE IF EXISTS public.messages 
  ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_twilio_sid ON public.messages(twilio_message_sid) 
  WHERE twilio_message_sid IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.messages.twilio_message_sid IS 'Twilio Conversations message SID for deduplication and webhook tracking';
```

---

## ✅ Step 3: Configure Twilio Webhook

1. Go to **Twilio Console**: https://console.twilio.com
2. Navigate to **Conversations** → **Services**
3. Click on your service (or create one if needed)
4. Go to **Webhooks** or **Configuration** section
5. Set the webhook URL to:
   ```
   https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook
   ```
6. Select these events:
   - ✅ `onMessageAdded`
   - ✅ `onMessageUpdated`
7. Click **Save**

**Note:** If you can't find the webhook settings, look for:
- **Configuration** → **Webhooks**
- **Settings** → **Webhooks**
- Or search for "webhook" in the service settings

---

## ✅ Step 4: Test the Functions

### Test 1: Generate Twilio Token
1. Go to **Edge Functions** → `generate-twilio-token`
2. Click **"Invoke"** or **"Test"**
3. Add Authorization header: `Bearer YOUR_SUPABASE_JWT_TOKEN`
4. Click **"Invoke Function"**
5. Should return: `{ "token": "...", "identity": "...", "serviceSid": "..." }`

### Test 2: Check Function Logs
1. Go to each function → **Logs** tab
2. Look for any errors
3. If you see errors, check:
   - Secrets are set correctly
   - All required secrets are present
   - No typos in secret names

---

## ✅ Step 5: Verify Everything Works

### Checklist:
- [ ] All 5 functions have secrets set
- [ ] Migration 039 ran successfully (created `gig_conversations` table)
- [ ] Migration 040 ran successfully (added `twilio_message_sid` column)
- [ ] Twilio webhook URL is configured in Twilio Console
- [ ] Webhook events (`onMessageAdded`, `onMessageUpdated`) are selected
- [ ] Tested `generate-twilio-token` function (optional)

---

## 🎉 You're Done!

Your Twilio Conversations integration is now set up! 

**Your function URLs:**
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/generate-twilio-token`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/manage-twilio-conversation`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/send-twilio-message`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook`
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/get-twilio-messages`

**Webhook URL for Twilio:**
- `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/twilio-webhook`

---

## 🔧 Troubleshooting

### "Function not found" errors
- Make sure you deployed all 5 functions
- Check function names match exactly (case-sensitive)

### "Secret not found" errors
- Go to each function → Settings → Secrets
- Verify all secrets are set with correct names (case-sensitive)
- Make sure you clicked "Save" after adding each secret

### Migration errors
- Check SQL Editor for error messages
- Make sure you run migrations in order (039 first, then 040)
- Verify the `gigs` table exists (migration 039 references it)

### Webhook not receiving events
- Verify webhook URL is correct in Twilio Console
- Check `twilio-webhook` function logs in Supabase Dashboard
- Make sure events are selected in Twilio Console







