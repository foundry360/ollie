# Troubleshooting Email Sending

## Check Function Logs

1. Go to your Supabase Dashboard
2. Navigate to: **Edge Functions → send-prelaunch-confirmation-email → Logs**
3. Look for recent invocations and any error messages

## Common Issues

### 1. RESEND_API_KEY Not Set for This Function

Even though other functions have RESEND_API_KEY, you need to set it **specifically for this function**:

1. Go to: **Project Settings → Edge Functions → send-prelaunch-confirmation-email**
2. Click **Secrets** tab
3. Verify `RESEND_API_KEY` is set
4. If missing, add it and redeploy

### 2. Check the Function Response

The function returns different responses:
- **Success:** `{ success: true, emailId: "..." }`
- **Missing API Key:** `{ success: true, message: "Email prepared. Configure RESEND_API_KEY..." }`
- **Error:** `{ success: false, error: "...", errorDetails: "..." }`

### 3. Test the Function Directly

**Test with curl:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-prelaunch-confirmation-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test-email@example.com",
    "fullName": "Test User",
    "recipientType": "teen"
  }'
```

**Check the response:**
- If it says `"Email prepared. Configure RESEND_API_KEY..."` → API key is missing
- If it returns an error → Check the `errorDetails` field
- If it succeeds → Check your email inbox (and spam folder)

### 4. Verify Request Format

Make sure you're sending:
```json
{
  "email": "valid-email@example.com",
  "fullName": "Name",
  "recipientType": "teen" // or "neighbor" or "parent"
}
```

All three fields are required!

### 5. Check Resend API Status

- Visit https://status.resend.com to check if Resend is experiencing issues
- Verify your Resend API key is valid at https://resend.com/api-keys

### 6. Verify Email Address

- Make sure the recipient email address is valid
- Check spam/junk folder
- Try with a different email address

## Debug Steps

1. **Check logs** - Most important! Look for error messages
2. **Verify secrets** - Make sure RESEND_API_KEY is set for this function
3. **Test endpoint** - Use curl to test directly
4. **Check response** - The response will tell you what went wrong
5. **Verify email** - Check spam folder, try different email







