# Twilio SMS OTP Configuration Guide

This guide will walk you through setting up Twilio to send SMS OTP codes for phone verification in your Ollie app.

---

## 📋 Prerequisites

- A Supabase project (already set up)
- A Twilio account (free trial available)
- A phone number to verify (for testing)

---

## Step 1: Create a Twilio Account

1. **Sign up for Twilio**
   - Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   - Create a free account
   - Verify your email and phone number

2. **Get Your Twilio Credentials**
   - After signing up, you'll land on the Twilio Console Dashboard
   - You'll need these three pieces of information:
     - **Account SID** (starts with `AC...`)
     - **Auth Token** (click "Show" to reveal)
     - **Phone Number** (or Message Service SID)

3. **Get a Twilio Phone Number**
   - In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
   - Select a number (free trial accounts get a number automatically)
   - Note: Free trial numbers can only send SMS to verified numbers
   - For production, you'll need to upgrade your account

---

## Step 2: Configure Supabase with Twilio

### 2.1 Enable Phone Authentication

1. **Open Supabase Dashboard**
   - Go to your project: [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Navigate to Authentication Settings**
   - Go to **Authentication** → **Providers** (left sidebar)
   - Find **Phone** in the list
   - Toggle it **ON** to enable

### 2.2 Configure SMS Provider

1. **Go to SMS Settings**
   - In Supabase Dashboard, go to **Authentication** → **Settings**
   - Scroll down to **SMS Settings** section

2. **Select Twilio as Provider**
   - Under **SMS Provider**, select **Twilio** from the dropdown

3. **Enter Twilio Credentials**
   - **Twilio Account SID**: Paste your Account SID (starts with `AC...`)
   - **Twilio Auth Token**: Paste your Auth Token
   - **Twilio Message Service SID**: See instructions below ⬇️
   - **Twilio Phone Number**: Can be left blank if using Message Service SID

### 2.3 Get Twilio Message Service SID

You have **two options**:

#### Option A: Use Message Service SID (Recommended for Production)

1. **Go to Twilio Console**
   - Log in to [Twilio Console](https://console.twilio.com/)
   - Navigate to **Messaging** → **Services** (in the left sidebar)

2. **Create a New Messaging Service** (if you don't have one)
   - Click **Create Messaging Service**
   - Give it a name (e.g., "Ollie SMS Service")
   - Click **Create**

3. **Add Your Phone Number to the Service**
   - In your Messaging Service, go to **Senders** tab
   - Click **Add Senders** → **Add Phone Number**
   - Select your Twilio phone number
   - Click **Add**

4. **Copy the Service SID**
   - The **Service SID** is displayed at the top of the Messaging Service page
   - It starts with `MG...` (e.g., `MG1234567890abcdef1234567890abcdef`)
   - Copy this SID

5. **Paste in Supabase**
   - Paste the Service SID into the **"Twilio Message Service SID"** field in Supabase
   - Leave **"Twilio Phone Number"** field empty when using Service SID

#### Option B: Use Phone Number Directly (Simpler for Testing)

If you prefer to use your phone number directly:

1. **Get Your Twilio Phone Number**
   - In Twilio Console, go to **Phone Numbers** → **Manage** → **Active numbers**
   - Copy your phone number (e.g., `+1234567890`)

2. **In Supabase**
   - Leave **"Twilio Message Service SID"** field **empty**
   - Enter your phone number in the **"Twilio Phone Number"** field
   - Note: Supabase may still require Message Service SID - if so, use Option A

**Recommendation**: Use **Option A (Message Service SID)** as it's more flexible and recommended by Twilio for production use.

4. **Save Settings**
   - Click **Save** at the bottom of the page

### 2.3 (Optional) Customize SMS Template

1. **Go to Templates**
   - In Supabase Dashboard, go to **Authentication** → **Templates**
   - Click on **SMS Message** tab

2. **Edit the Template**
   - Default template: `Your code is {{ .Code }}`
   - You can customize it, for example:
     ```
     Your Ollie verification code is: {{ .Code }}
     
     This code will expire in 10 minutes.
     ```
   - The `{{ .Code }}` variable will be replaced with the actual OTP code
   - Click **Save**

---

## Step 3: Test the Configuration

### 3.1 Test in Your App

1. **Run your app**
   ```bash
   npm start
   # or
   expo start
   ```

2. **Try the signup flow**
   - Navigate to Neighbor signup
   - Enter a phone number (must be verified in Twilio if using free trial)
   - Submit the form
   - You should receive an SMS with the OTP code

3. **Verify the code**
   - Enter the 6-digit code you received
   - The verification should succeed

### 3.2 Troubleshooting

**If SMS is not sending:**

1. **Check Twilio Console**
   - Go to Twilio Console → **Monitor** → **Logs** → **Messaging**
   - Look for any error messages
   - Common issues:
     - **"The number +1XXXXXXXXXX is not a valid mobile number"**
       - Solution: Verify the phone number in Twilio Console (Phone Numbers → Verified Caller IDs)
     - **"Insufficient funds"**
       - Solution: Add credits to your Twilio account (free trial has limited credits)

2. **Check Supabase Logs**
   - Go to Supabase Dashboard → **Logs** → **Auth Logs**
   - Look for SMS-related errors

3. **Verify Phone Number Format**
   - Must be in E.164 format: `+[country code][number]`
   - Examples:
     - US: `+1234567890`
     - UK: `+447911123456`
     - No spaces, dashes, or parentheses

4. **Check Twilio Account Status**
   - Free trial accounts have limitations:
     - Can only send to verified numbers
     - Limited number of messages
     - May need to upgrade for production use

---

## Step 4: Production Considerations

### 4.1 Upgrade Twilio Account

For production use, you'll need to:

1. **Upgrade Twilio Account**
   - Remove trial restrictions
   - Add payment method
   - Purchase phone number (if needed)

2. **Set Up Message Service (Recommended)**
   - In Twilio Console, go to **Messaging** → **Services**
   - Create a new Messaging Service (or use existing one)
   - Add your phone number to the service
   - Copy the **Service SID** (starts with `MG...`)
   - Use this Service SID in Supabase instead of phone number
   - See detailed steps in Section 2.3 above

### 4.2 Rate Limiting

Supabase automatically handles rate limiting for SMS:
- Default: 1 SMS per phone number per 60 seconds
- Can be adjusted in Supabase Dashboard → **Authentication** → **Settings** → **Rate Limits**

### 4.3 Cost Estimation

Twilio SMS pricing (as of 2024):
- US/Canada: ~$0.0075 per SMS
- International: Varies by country
- Check current pricing: [Twilio Pricing](https://www.twilio.com/sms/pricing)

---

## Step 5: Verify Configuration

### Quick Checklist

- [ ] Twilio account created
- [ ] Twilio phone number obtained
- [ ] Supabase Phone provider enabled
- [ ] Twilio credentials entered in Supabase
- [ ] SMS template customized (optional)
- [ ] Test SMS sent successfully
- [ ] OTP verification working in app

---

## 📝 Code Reference

Your app already uses these functions (in `lib/supabase.ts`):

```typescript
// Send OTP
await sendPhoneOTP('+1234567890');

// Verify OTP
await verifyPhoneOTP('+1234567890', '123456');

// Resend OTP
await resendPhoneOTP('+1234567890');
```

These functions automatically use the Twilio configuration you set up in Supabase.

---

## 🔗 Useful Links

- [Twilio Console](https://console.twilio.com/)
- [Twilio SMS Documentation](https://www.twilio.com/docs/sms)
- [Supabase Phone Auth Docs](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase SMS Provider Setup](https://supabase.com/docs/guides/auth/auth-sms)

---

## 🆘 Need Help?

If you encounter issues:

1. Check Twilio Console logs for detailed error messages
2. Check Supabase Auth logs
3. Verify all credentials are correct
4. Ensure phone numbers are in E.164 format
5. For free trial: Make sure recipient numbers are verified in Twilio

---

## ✅ Next Steps

Once Twilio is configured:

1. Test the complete signup flow
2. Monitor SMS delivery rates
3. Set up billing alerts in Twilio (for production)
4. Consider implementing SMS delivery status tracking
