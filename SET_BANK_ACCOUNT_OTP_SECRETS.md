# Setting Twilio Secrets for Bank Account OTP Function

The `send-bank-account-approval-otp` Edge Function requires three Twilio secrets to send SMS messages.

## Required Secrets

1. **TWILIO_ACCOUNT_SID** - Your Twilio Account SID
2. **TWILIO_AUTH_TOKEN** - Your Twilio Auth Token
3. **TWILIO_PHONE_NUMBER** - Your Twilio phone number in E.164 format (e.g., `+1234567890`)

## Option 1: Using Supabase CLI (Recommended)

Run the provided script:

```bash
./set-bank-account-otp-secrets.sh
```

Or set them manually:

```bash
# Make sure you're logged in and linked to your project
supabase login
supabase link --project-ref enxxlckxhcttvsxnjfnw

# Set the secrets
supabase secrets set TWILIO_ACCOUNT_SID="YOUR_ACCOUNT_SID" --project-ref enxxlckxhcttvsxnjfnw
supabase secrets set TWILIO_AUTH_TOKEN="YOUR_AUTH_TOKEN" --project-ref enxxlckxhcttvsxnjfnw
supabase secrets set TWILIO_PHONE_NUMBER="+1234567890" --project-ref enxxlckxhcttvsxnjfnw
```

## Option 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Click **"Add Secret"** or **"New Secret"**
3. Add each secret:
   - **Name:** `TWILIO_ACCOUNT_SID` → **Value:** Your Twilio Account SID
   - **Name:** `TWILIO_AUTH_TOKEN` → **Value:** Your Twilio Auth Token
   - **Name:** `TWILIO_PHONE_NUMBER` → **Value:** Your Twilio phone number (E.164 format)

## Where to Find Your Twilio Credentials

1. **TWILIO_ACCOUNT_SID** and **TWILIO_AUTH_TOKEN**:
   - Log in to [Twilio Console](https://console.twilio.com/)
   - Go to **Account** → **API Keys & Tokens**
   - Your Account SID and Auth Token are displayed there

2. **TWILIO_PHONE_NUMBER**:
   - In Twilio Console, go to **Phone Numbers** → **Manage** → **Active Numbers**
   - Copy your phone number in E.164 format (must start with `+`)

## Verify Secrets Are Set

After setting the secrets, test the function by:
1. Going to the app
2. Navigating to Payment Setup
3. Clicking "Request Parent Approval"
4. The OTP should be sent via SMS to the parent's phone

## Troubleshooting

If you still see "Twilio not configured" error:
1. Make sure secrets are set at the **project level** (not function-specific)
2. Wait a few minutes for secrets to propagate
3. Check the function logs in Supabase Dashboard to see if secrets are being read
4. Verify the secret names match exactly (case-sensitive):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

## Note

These secrets are available to **all Edge Functions** in your project. If you've already set them for other functions, you don't need to set them again.

