# Twilio Webhook Setup Guide

## Overview

This setup uses **Twilio Webhooks + Supabase Realtime** instead of polling, providing:
- ✅ **Zero polling** - No API calls for checking messages
- ✅ **Real-time updates** - Instant message delivery via Supabase Realtime
- ✅ **Lower costs** - Fewer Edge Function invocations
- ✅ **Better battery life** - No constant polling
- ✅ **Better UX** - Faster, more responsive

## How It Works

1. **User sends message** → Twilio REST API (via Edge Function)
2. **Twilio receives message** → Sends webhook to your Edge Function
3. **Webhook stores message** → Inserts into Supabase `messages` table
4. **Supabase Realtime** → Pushes update to all connected clients
5. **Client receives update** → Message appears instantly

## Setup Steps

### Step 1: Deploy Edge Functions

```bash
supabase functions deploy twilio-webhook
supabase functions deploy manage-twilio-conversation
supabase functions deploy send-twilio-message
```

### Step 2: Set Edge Function Secrets

For `twilio-webhook` function:
- `TWILIO_AUTH_TOKEN` - For webhook signature verification (optional but recommended)
- `SUPABASE_SERVICE_ROLE_KEY` - To bypass RLS when inserting messages
- `SUPABASE_URL` - Your Supabase project URL

For `manage-twilio-conversation` function:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_CONVERSATIONS_SERVICE_SID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` - To store conversation mappings

For `send-twilio-message` function:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Step 3: Run Migrations

```bash
supabase migration up
```

This will:
- Create `gig_conversations` table (migration 039)
- Add `twilio_message_sid` column to `messages` table (migration 040)

### Step 4: Configure Twilio Webhook

1. **Go to Twilio Console**
   - Navigate to **Conversations** → **Services** → Your Service (`IS3cf2fe8fe4a44558ba62ab0946b7555f`)

2. **Set Webhook URL**
   - Go to **Webhooks** section
   - Set **Webhook URL** to: `https://your-project.supabase.co/functions/v1/twilio-webhook`
   - Select events: `onMessageAdded`, `onMessageUpdated`

3. **Save Configuration**

### Step 5: Test the Integration

1. Send a message from the app
2. Check Twilio Console → Conversations → Logs (should show webhook delivery)
3. Check Supabase Dashboard → Edge Functions → Logs (should show webhook received)
4. Message should appear in Supabase `messages` table
5. Message should appear in app via Supabase Realtime

## Architecture

```
┌─────────────┐
│   Client    │
│  (React     │
│  Native)    │
└──────┬──────┘
       │
       │ 1. Send via REST API
       ▼
┌─────────────────────┐
│  send-twilio-       │
│  message Edge       │
│  Function           │
└──────┬──────────────┘
       │
       │ 2. POST to Twilio
       ▼
┌─────────────┐
│   Twilio    │
│Conversations│
└──────┬──────┘
       │
       │ 3. Webhook
       ▼
┌─────────────────────┐
│  twilio-webhook     │
│  Edge Function      │
└──────┬──────────────┘
       │
       │ 4. Insert to Supabase
       ▼
┌─────────────┐
│  Supabase   │
│  messages   │
│  table      │
└──────┬──────┘
       │
       │ 5. Realtime event
       ▼
┌─────────────┐
│   Client    │
│  (React     │
│  Native)    │
└─────────────┘
```

## Troubleshooting

### Webhook Not Receiving Messages

1. **Check Twilio Console**
   - Go to **Conversations** → **Services** → **Webhooks**
   - Verify webhook URL is correct
   - Check webhook delivery logs

2. **Check Edge Function Logs**
   - Supabase Dashboard → Edge Functions → `twilio-webhook` → Logs
   - Look for incoming requests

3. **Verify Service Role Key**
   - Must be set in Edge Function secrets
   - Used to bypass RLS when inserting messages

### Messages Not Appearing in App

1. **Check Supabase Realtime**
   - Verify Realtime is enabled in Supabase Dashboard
   - Check if subscription is active in app

2. **Check Message Insert**
   - Verify message was inserted into `messages` table
   - Check `twilio_message_sid` column for deduplication

3. **Check RLS Policies**
   - Messages should be readable by sender/recipient
   - Service role bypasses RLS for inserts

### Duplicate Messages

- Webhook includes deduplication via `twilio_message_sid`
- If duplicates occur, check:
  - Webhook being called multiple times
  - Race conditions in webhook handler

## Benefits Over Polling

| Aspect | Polling (5s) | Webhooks |
|--------|--------------|----------|
| API Calls/Hour | 720 per conversation | 0 (Twilio pushes) |
| Latency | Up to 5 seconds | Instant |
| Battery Usage | High | Low |
| Edge Function Invocations | 720/hour | 1 per message |
| Cost | Higher | Lower |
| Real-time | No | Yes |

## Next Steps

After setup:
1. Test sending messages
2. Verify webhook delivery in Twilio Console
3. Verify messages in Supabase
4. Verify real-time updates in app
5. Monitor Edge Function logs for any errors







