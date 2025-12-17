# SMS OTP Troubleshooting Guide

## Issue: Not Receiving SMS Code

If you're not receiving the SMS verification code, follow these steps:

---

## Step 1: Check Twilio Console

1. **Go to Twilio Console**
   - Log in at https://console.twilio.com/
   - Go to **Monitor** → **Logs** → **Messaging**

2. **Look for your SMS attempt**
   - Check if the message was sent
   - Look for any error messages
   - Check the delivery status

3. **Common Twilio Errors:**
   - **"The number +1XXXXXXXXXX is not a valid mobile number"**
     - **Solution**: Verify the phone number in Twilio Console
     - Go to **Phone Numbers** → **Verified Caller IDs**
     - Add your phone number for testing
   
   - **"Insufficient funds"**
     - **Solution**: Add credits to your Twilio account
     - Free trial accounts have limited credits
   
   - **"Unverified number"** (Trial accounts)
     - **Solution**: Trial accounts can only send to verified numbers
     - Verify your number in Twilio Console

---

## Step 2: Check Supabase Logs

1. **Go to Supabase Dashboard**
   - Navigate to **Logs** → **Auth Logs**
   - Look for SMS-related errors
   - Check for any failed OTP attempts

2. **Common Supabase Errors:**
   - **"SMS provider not configured"**
     - **Solution**: Configure Twilio in Authentication → Settings
   
   - **"Invalid phone number format"**
     - **Solution**: Ensure phone is in E.164 format: `+1234567890`
     - Must include country code and + sign

---

## Step 3: Verify Phone Number Format

The phone number **must** be in E.164 format:

✅ **Correct formats:**
- `+1234567890` (US)
- `+447911123456` (UK)
- `+61412345678` (Australia)

❌ **Incorrect formats:**
- `1234567890` (missing +)
- `(123) 456-7890` (has formatting)
- `+1-234-567-8900` (has dashes)

---

## Step 4: Check Twilio Configuration in Supabase

1. **Go to Supabase Dashboard**
   - **Authentication** → **Settings**
   - Scroll to **SMS Settings**

2. **Verify Configuration:**
   - ✅ SMS Provider: **Twilio** (selected)
   - ✅ Twilio Account SID: Entered
   - ✅ Twilio Auth Token: Entered
   - ✅ Twilio Message Service SID: Entered (or Phone Number)

3. **If not configured:**
   - See `TWILIO_SMS_SETUP.md` for setup instructions

---

## Step 5: Test with Twilio Trial Account Limitations

**If using Twilio Free Trial:**

1. **Verify Your Phone Number**
   - Go to Twilio Console → **Phone Numbers** → **Verified Caller IDs**
   - Click **Add a new number**
   - Enter your phone number
   - Verify it via SMS or call

2. **Trial Limitations:**
   - Can only send to **verified numbers**
   - Limited number of messages
   - May need to upgrade for production

---

## Step 6: Check Console Logs

In your app, check the terminal/console for:

1. **Look for these log messages:**
   ```
   📱 [sendPhoneOTP] Sending OTP to: +1234567890
   ✅ [sendPhoneOTP] OTP sent successfully
   ```

2. **If you see errors:**
   - Copy the full error message
   - Check the error code and message
   - Refer to error handling below

---

## Step 7: Common Error Messages & Solutions

### "Please wait a moment before requesting another code"
- **Cause**: Rate limiting (too many requests)
- **Solution**: Wait 60 seconds and try again

### "Invalid phone number format"
- **Cause**: Phone number not in E.164 format
- **Solution**: Ensure format is `+[country code][number]` (e.g., `+1234567890`)

### "SMS service error"
- **Cause**: Twilio configuration issue
- **Solution**: 
  1. Check Twilio credentials in Supabase
  2. Verify Twilio account has credits
  3. Check Twilio Console for errors

### "The number is not a valid mobile number"
- **Cause**: Number not verified (trial account) or invalid
- **Solution**: 
  1. Verify number in Twilio Console
  2. Ensure it's a mobile number (not landline)

---

## Step 8: Manual Test in Twilio Console

1. **Go to Twilio Console**
   - **Messaging** → **Try it out** → **Send an SMS**

2. **Send a test message:**
   - To: Your phone number (verified)
   - From: Your Twilio number
   - Message: "Test message"

3. **If this works:**
   - Twilio is configured correctly
   - Issue is likely in Supabase configuration

4. **If this doesn't work:**
   - Twilio account issue
   - Check account status and credits

---

## Step 9: Verify Supabase Phone Provider

1. **Go to Supabase Dashboard**
   - **Authentication** → **Providers**
   - Find **Phone** provider

2. **Check:**
   - ✅ Phone provider is **enabled**
   - ✅ SMS settings are configured

---

## Quick Checklist

- [ ] Phone number is in E.164 format (`+1234567890`)
- [ ] Phone number is verified in Twilio (if using trial)
- [ ] Twilio credentials are correct in Supabase
- [ ] Twilio account has credits/balance
- [ ] SMS provider is set to Twilio in Supabase
- [ ] Phone provider is enabled in Supabase
- [ ] Checked Twilio Console logs for errors
- [ ] Checked Supabase Auth logs for errors

---

## Still Not Working?

1. **Check the exact error message** in console/logs
2. **Verify phone number format** is correct
3. **Test with a verified number** (if using Twilio trial)
4. **Check Twilio account status** and credits
5. **Review Supabase Auth logs** for detailed errors

---

## Production Considerations

For production use:
- Upgrade Twilio account (remove trial restrictions)
- Set up proper phone number or Messaging Service
- Configure proper error handling and retry logic
- Monitor SMS delivery rates and costs
