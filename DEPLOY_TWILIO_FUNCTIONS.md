# Deploy Twilio Edge Functions

## Prerequisites

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```
   This will open a browser window for authentication.

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   - Find your project ref in **Supabase Dashboard** → **Settings** → **General** → **Reference ID**
   - It looks like: `abcdefghijklmnop`

## Deploy All Twilio Functions

Run these commands from your project root directory:

```bash
# Deploy token generation function
supabase functions deploy generate-twilio-token

# Deploy conversation management function
supabase functions deploy manage-twilio-conversation

# Deploy message sending function
supabase functions deploy send-twilio-message

# Deploy webhook handler function
supabase functions deploy twilio-webhook

# Deploy message fetching function (optional, for initial load)
supabase functions deploy get-twilio-messages
```

## Set Secrets

After deploying, set secrets for each function in **Supabase Dashboard**:

### For `generate-twilio-token`:
1. Go to **Supabase Dashboard** → **Edge Functions** → **generate-twilio-token** → **Settings** → **Secrets**
2. Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### For `manage-twilio-conversation`:
1. Go to **Supabase Dashboard** → **Edge Functions** → **manage-twilio-conversation** → **Settings** → **Secrets**
2. Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_CONVERSATIONS_SERVICE_SID` = `IS3cf2fe8fe4a44558ba62ab0946b7555f`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### For `send-twilio-message`:
1. Go to **Supabase Dashboard** → **Edge Functions** → **send-twilio-message** → **Settings** → **Secrets**
2. Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### For `twilio-webhook`:
1. Go to **Supabase Dashboard** → **Edge Functions** → **twilio-webhook** → **Settings** → **Secrets**
2. Add:
   - `TWILIO_AUTH_TOKEN` (for signature verification)
   - `SUPABASE_SERVICE_ROLE_KEY` (to bypass RLS)
   - `SUPABASE_URL`

### For `get-twilio-messages`:
1. Go to **Supabase Dashboard** → **Edge Functions** → **get-twilio-messages** → **Settings** → **Secrets**
2. Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## Verify Deployment

1. **Check Functions List**:
   - Go to **Supabase Dashboard** → **Edge Functions**
   - You should see all deployed functions listed

2. **Test a Function**:
   - Click on a function → **Invoke**
   - Or use the function URL in your app

## Function URLs

After deployment, your functions will be available at:
- `https://your-project-ref.supabase.co/functions/v1/generate-twilio-token`
- `https://your-project-ref.supabase.co/functions/v1/manage-twilio-conversation`
- `https://your-project-ref.supabase.co/functions/v1/send-twilio-message`
- `https://your-project-ref.supabase.co/functions/v1/twilio-webhook`
- `https://your-project-ref.supabase.co/functions/v1/get-twilio-messages`

## Troubleshooting

### "Command not found: supabase"
- Install Supabase CLI: `npm install -g supabase`

### "Not logged in"
- Run: `supabase login`

### "Project not linked"
- Run: `supabase link --project-ref your-project-ref`
- Find project ref in Supabase Dashboard → Settings → General

### "Function deployment failed"
- Check function code for syntax errors
- Verify all required files exist in the function directory
- Check Supabase Dashboard → Edge Functions → Logs for errors

### "Secrets not found"
- Make sure you set secrets in Supabase Dashboard (not in `.env` file)
- Secrets are per-function, set them for each function individually







