# Step-by-Step CLI Deployment Guide

Follow these steps in order to deploy your Twilio Edge Functions.

## Prerequisites Check

### Step 1: Check if Supabase CLI is installed

```bash
supabase --version
```

If you see a version number, you're good! If you get "command not found", install it:

```bash
npm install -g supabase
```

---

## Authentication & Project Setup

### Step 2: Login to Supabase

```bash
supabase login
```

This will:
- Open your browser
- Ask you to authenticate
- Save your credentials locally

**Expected output:** "Finished supabase login"

---

### Step 3: Link your project

Replace `YOUR_PROJECT_REF` with your actual project reference ID:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**Example:**
```bash
supabase link --project-ref abcdefghijklmnop
```

**Expected output:** "Linked to project abcdefghijklmnop"

**To find your project ref:**
- Go to Supabase Dashboard → Settings → General
- Look for "Reference ID"

---

## Deploy Functions

Deploy each function one by one. Run these commands from your project root directory (`/Users/jasongelsomino/Ollie`):

### Step 4: Deploy generate-twilio-token

```bash
supabase functions deploy generate-twilio-token
```

**Expected output:**
```
Deploying function generate-twilio-token...
Function generate-twilio-token deployed successfully
```

---

### Step 5: Deploy manage-twilio-conversation

```bash
supabase functions deploy manage-twilio-conversation
```

**Expected output:**
```
Deploying function manage-twilio-conversation...
Function manage-twilio-conversation deployed successfully
```

---

### Step 6: Deploy send-twilio-message

```bash
supabase functions deploy send-twilio-message
```

**Expected output:**
```
Deploying function send-twilio-message...
Function send-twilio-message deployed successfully
```

---

### Step 7: Deploy twilio-webhook

```bash
supabase functions deploy twilio-webhook
```

**Expected output:**
```
Deploying function twilio-webhook...
Function twilio-webhook deployed successfully
```

---

### Step 8: Deploy get-twilio-messages

```bash
supabase functions deploy get-twilio-messages
```

**Expected output:**
```
Deploying function get-twilio-messages...
Function get-twilio-messages deployed successfully
```

---

## Verify Deployment

### Step 9: List deployed functions

```bash
supabase functions list
```

**Expected output:** You should see all 5 functions listed:
- generate-twilio-token
- manage-twilio-conversation
- send-twilio-message
- twilio-webhook
- get-twilio-messages

---

## Set Secrets (Required)

After deploying, you MUST set secrets for each function. You can do this via the Supabase Dashboard or CLI.

### Option A: Via Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on each function name
3. Go to **Settings** → **Secrets**
4. Add the required secrets (see below)

### Option B: Via CLI

For each function, set secrets using:

```bash
supabase secrets set KEY=value --project-ref YOUR_PROJECT_REF
```

**Note:** CLI secrets are project-wide. For function-specific secrets, use the Dashboard.

---

## Required Secrets

### For `generate-twilio-token`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### For `manage-twilio-conversation`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### For `send-twilio-message`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### For `twilio-webhook`:
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### For `get-twilio-messages`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## Run Migrations

### Step 10: Push database migrations

```bash
supabase db push
```

This will apply migrations `039_add_twilio_conversation_support.sql` and `040_add_twilio_message_sid_to_messages.sql`.

**Expected output:**
```
Applying migration 039_add_twilio_conversation_support.sql...
Applying migration 040_add_twilio_message_sid_to_messages.sql...
Finished supabase db push
```

---

## Get Function URLs

After deployment, your functions will be available at:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-twilio-token
https://YOUR_PROJECT_REF.supabase.co/functions/v1/manage-twilio-conversation
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-twilio-message
https://YOUR_PROJECT_REF.supabase.co/functions/v1/twilio-webhook
https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-twilio-messages
```

**The webhook URL for Twilio:**
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/twilio-webhook
```

---

## Troubleshooting

### Error: "Not logged in"
```bash
supabase login
```

### Error: "Project not linked"
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Error: "Function not found"
Make sure you're in the project root directory and the function folder exists in `supabase/functions/`

### Error: "Deployment failed"
Check the error message. Common issues:
- Missing dependencies in function code
- Syntax errors in `index.ts`
- Network issues

### Check function logs
```bash
supabase functions logs FUNCTION_NAME --project-ref YOUR_PROJECT_REF
```

---

## Quick Reference: All Commands in Order

```bash
# 1. Install CLI (if needed)
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4-8. Deploy functions
supabase functions deploy generate-twilio-token
supabase functions deploy manage-twilio-conversation
supabase functions deploy send-twilio-message
supabase functions deploy twilio-webhook
supabase functions deploy get-twilio-messages

# 9. Verify
supabase functions list

# 10. Push migrations
supabase db push
```

---

## Next Steps

After completing these steps:

1. ✅ Set secrets in Supabase Dashboard for each function
2. ✅ Configure Twilio webhook URL in Twilio Console
3. ✅ Test the functions using the Supabase Dashboard → Edge Functions → Invoke







