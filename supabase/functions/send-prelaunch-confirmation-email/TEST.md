# Testing the Function

## Step 1: Test GET Request (Preview - No Auth Required)

Open this URL in your browser (replace YOUR_PROJECT_REF):

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-prelaunch-confirmation-email?fullName=Test+User&recipientType=teen
```

You should see the email HTML. If you see it, the function is deployed and working.

## Step 2: Test POST Request (Send Email)

Use curl or your HTTP client:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-prelaunch-confirmation-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "fullName": "Test User",
    "recipientType": "teen"
  }'
```

**Important:** Replace:
- `YOUR_PROJECT_REF` - Your Supabase project reference ID
- `YOUR_ANON_KEY` - Your Supabase anonymous key (from Project Settings → API)

## Step 3: Check Logs After Test

After running the test, check the logs:
1. Go to: **Supabase Dashboard → Edge Functions → send-prelaunch-confirmation-email → Logs**
2. Look for the latest invocation
3. You should see: `📧 [send-prelaunch-confirmation-email] Function called:`

## Common Issues

### No logs at all:
- Function might not be deployed
- Wrong URL/endpoint
- Function name mismatch

### Function called but no email:
- Check if RESEND_API_KEY is set
- Check the response for error messages
- Verify email address is valid

### 401/403 Error:
- Missing or invalid Authorization header
- Wrong anon key


