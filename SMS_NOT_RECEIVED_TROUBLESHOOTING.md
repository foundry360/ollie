# SMS Not Received - Troubleshooting Guide

## ✅ Good News: Supabase Says SMS Was Sent

Your logs show:
```
✅ [sendPhoneOTP] OTP sent successfully
```

This means Supabase successfully requested the SMS from Twilio. If you're not receiving it, the issue is likely with Twilio delivery.

---

## 🔍 Step 1: Check Twilio Console Logs

1. **Go to Twilio Console**
   - https://console.twilio.com/
   - Navigate to **Monitor** → **Logs** → **Messaging**

2. **Look for your SMS attempt**
   - Find messages sent to `+19042103388`
   - Check the **Status** column:
     - ✅ **Delivered** = SMS was sent and delivered
     - ⚠️ **Failed** = SMS failed to send (check error)
     - ⏳ **Queued** = SMS is waiting to be sent
     - ❌ **Undelivered** = SMS couldn't be delivered

3. **Check Error Messages**
   - Click on any failed/undelivered message
   - Look at the **Error Code** and **Error Message**
   - Common errors:
     - **30008**: "Unreachable destination handset"
     - **21610**: "Unsubscribed recipient"
     - **30007**: "Delivery receipt unknown"

---

## 🔍 Step 2: Verify Phone Number in Twilio (Trial Accounts)

**If you're using a Twilio Free Trial:**

1. **Go to Twilio Console**
   - **Phone Numbers** → **Manage** → **Verified Caller IDs**

2. **Check if your number is verified**
   - Look for `+19042103388` in the list
   - If it's NOT there, you need to verify it

3. **Verify Your Number**
   - Click **Add a new number**
   - Enter `+19042103388`
   - Choose verification method (SMS or Call)
   - Complete verification

4. **Trial Account Limitation**
   - Free trial accounts can **only send to verified numbers**
   - This is a security measure by Twilio

---

## 🔍 Step 3: Check Twilio Account Status

1. **Go to Twilio Console Dashboard**
   - Check your account balance/credits
   - Free trial accounts have limited credits

2. **Check Account Status**
   - Look for any warnings or restrictions
   - Ensure account is active (not suspended)

---

## 🔍 Step 4: Check Phone Number Format

Your phone number looks correct: `+19042103388`
- ✅ Has `+` prefix
- ✅ Has country code `1` (US)
- ✅ Has 10-digit number

---

## 🔍 Step 5: Test Directly in Twilio

1. **Go to Twilio Console**
   - **Messaging** → **Try it out** → **Send an SMS**

2. **Send a test message:**
   - **To**: `+19042103388` (your verified number)
   - **From**: Your Twilio phone number
   - **Message**: "Test message from Twilio"

3. **Check if you receive it**
   - If YES: Twilio works, issue is with Supabase integration
   - If NO: Twilio account/configuration issue

---

## 🔍 Step 6: Check Supabase SMS Settings

1. **Go to Supabase Dashboard**
   - **Authentication** → **Settings**
   - Scroll to **SMS Settings**

2. **Verify Configuration:**
   - ✅ SMS Provider: **Twilio**
   - ✅ Twilio Account SID: Entered correctly
   - ✅ Twilio Auth Token: Entered correctly
   - ✅ Twilio Message Service SID: Entered correctly

3. **Check for Errors:**
   - Look for any error messages or warnings
   - Verify credentials are correct

---

## 🔍 Step 7: Check Supabase Auth Logs

1. **Go to Supabase Dashboard**
   - **Logs** → **Auth Logs**

2. **Look for SMS-related entries**
   - Filter by "SMS" or "OTP"
   - Check for any error messages
   - Look for delivery status

---

## 🎯 Most Likely Issues

### Issue 1: Phone Number Not Verified (Trial Account)
**Solution**: Verify `+19042103388` in Twilio Console → Verified Caller IDs

### Issue 2: Twilio Account Out of Credits
**Solution**: Add credits to your Twilio account

### Issue 3: Phone Number Blocked/Invalid
**Solution**: 
- Verify the number is correct
- Check if it's a mobile number (not landline)
- Ensure it can receive SMS

### Issue 4: SMS Provider Not Fully Configured
**Solution**: Double-check all Twilio credentials in Supabase

---

## 📝 Next Steps

1. **Check Twilio Console logs** (most important)
   - This will show if Twilio actually sent the SMS
   - And if not, why it failed

2. **Verify your phone number** in Twilio (if using trial)

3. **Test directly in Twilio** to confirm SMS works

4. **Share the Twilio log details** if you find errors

---

## ⚠️ Also: Database Function Still Missing

Your logs also show:
```
Function approach failed, trying direct insert
```

You still need to **run migration 012** to create the database function. This won't affect SMS delivery, but it will fix the RLS error when creating the pending application.

See `RUN_MIGRATION_012.md` for instructions.
