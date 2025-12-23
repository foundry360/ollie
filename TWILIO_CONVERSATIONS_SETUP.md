# Twilio Conversations Setup Guide

## Your Service SID
**Twilio Conversations Service SID:** `IS3cf2fe8fe4a44558ba62ab0946b7555f`

## Required Edge Function Secrets

Set these secrets in your Supabase Dashboard for both Edge Functions:

### For `generate-twilio-token` function:
1. Go to **Supabase Dashboard** → **Edge Functions** → **generate-twilio-token** → **Settings** → **Secrets**
2. Add the following secrets:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_CONVERSATIONS_SERVICE_SID=IS3cf2fe8fe4a44558ba62ab0946b7555f
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### For `manage-twilio-conversation` function:
1. Go to **Supabase Dashboard** → **Edge Functions** → **manage-twilio-conversation** → **Settings** → **Secrets**
2. Add the following secrets:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_CONVERSATIONS_SERVICE_SID=IS3cf2fe8fe4a44558ba62ab0946b7555f
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

## Getting Your Twilio Credentials

1. **Account SID & Auth Token:**
   - Go to [Twilio Console](https://console.twilio.com/)
   - Dashboard → Account Info
   - Copy **Account SID** and **Auth Token**

2. **API Key SID & Secret:**
   - Go to **Account** → **API Keys & Tokens**
   - Create a new API Key (or use existing)
   - Copy **SID** (starts with `SK...`) and **Secret**

3. **Conversations Service SID:**
   - ✅ Already provided: `IS3cf2fe8fe4a44558ba62ab0946b7555f`
   - Or verify in **Twilio Console** → **Conversations** → **Services**

## Deployment Steps

1. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy generate-twilio-token
   supabase functions deploy manage-twilio-conversation
   ```

2. **Set Secrets** (via Supabase Dashboard as shown above)

3. **Run Migration:**
   ```bash
   supabase migration up
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

## Testing

After setup, test the integration:
1. Open the app
2. Navigate to a chat screen
3. Send a message
4. Verify it appears in real-time via Supabase Realtime (webhook syncs from Twilio)

## Webhook Setup (Recommended)

For production, set up webhooks to eliminate polling:
- See `TWILIO_WEBHOOK_SETUP.md` for complete instructions
- Webhooks provide real-time updates without polling
- Lower costs and better battery life

## Troubleshooting

- **"Twilio not configured" error:** Check all secrets are set correctly
- **"Invalid authentication" error:** Verify SUPABASE_URL and SUPABASE_ANON_KEY
- **Messages not appearing:** Check Twilio Console → Conversations → Logs
- **Connection issues:** Verify API Key credentials are correct







