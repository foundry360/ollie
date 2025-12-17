# Supabase SMS Configuration Checklist

Since Twilio is configured correctly, let's verify Supabase is properly set up to use it.

---

## ✅ Complete Checklist

### 1. Phone Provider Enabled
- [ ] Go to **Authentication** → **Providers**
- [ ] Find **"Phone"** provider
- [ ] Toggle is **ON** (enabled)
- [ ] **"Confirm phone"** or **"Phone confirmations"** is **ON**

### 2. SMS Provider Set to Twilio
- [ ] Go to **Authentication** → **Settings**
- [ ] Scroll to **SMS Settings** section
- [ ] **SMS Provider** dropdown shows **"Twilio"** (not "Default" or empty)

### 3. Twilio Credentials Entered
- [ ] **Twilio Account SID**: Entered (starts with `AC...`)
- [ ] **Twilio Auth Token**: Entered (click "Show" to verify it's correct)
- [ ] **Twilio Message Service SID**: Entered (starts with `MG...`) OR
- [ ] **Twilio Phone Number**: Entered (if not using Service SID)

### 4. Settings Saved
- [ ] Clicked **"Save"** button after entering credentials
- [ ] No error messages shown after saving

### 5. Verify Credentials Match
- [ ] Twilio Account SID in Supabase = Account SID in Twilio Console
- [ ] Twilio Auth Token in Supabase = Auth Token in Twilio Console
- [ ] Message Service SID in Supabase = Service SID in Twilio Console

---

## 🔍 Common Issues

### Issue 1: SMS Provider Not Set
**Symptom**: Messages don't appear in Twilio
**Fix**: Set SMS Provider to "Twilio" in Settings

### Issue 2: Credentials Don't Match
**Symptom**: Supabase can't connect to Twilio
**Fix**: Copy credentials exactly from Twilio Console

### Issue 3: Phone Confirmations Disabled
**Symptom**: OTP not required
**Fix**: Enable "Confirm phone" in Phone provider settings

### Issue 4: Settings Not Saved
**Symptom**: Changes don't persist
**Fix**: Make sure to click "Save" after changes

---

## 📝 Quick Verification Steps

1. **Check SMS Provider:**
   - Authentication → Settings → SMS Settings
   - Must say "Twilio"

2. **Check Phone Provider:**
   - Authentication → Providers → Phone
   - Must be enabled
   - "Confirm phone" must be ON

3. **Test Configuration:**
   - Try sending OTP again
   - Check Twilio Console logs immediately
   - Should see message appear within 10-30 seconds

---

## ⚠️ If Still Not Working

If everything is configured correctly but messages still don't appear:

1. **Check Supabase Auth Logs:**
   - Logs → Auth Logs
   - Look for SMS-related entries
   - Check for any error messages

2. **Verify Project:**
   - Make sure you're checking the correct Supabase project
   - Verify you're checking the correct Twilio account

3. **Wait a moment:**
   - Twilio logs can take 10-30 seconds to appear
   - Refresh Twilio Console after sending OTP

4. **Check for delays:**
   - Sometimes there's a delay between Supabase request and Twilio log entry

---

## 🎯 What to Check Right Now

1. **SMS Provider = "Twilio"** ✅ or ❌?
2. **Phone Provider = Enabled** ✅ or ❌?
3. **Phone Confirmations = Enabled** ✅ or ❌?
4. **All Twilio credentials filled in** ✅ or ❌?

If all are ✅, try sending an OTP and check Twilio logs within 30 seconds.
