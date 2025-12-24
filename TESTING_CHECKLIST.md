# Bank Account Setup - Testing Checklist

## Prerequisites
1. ✅ Migrations are run (054_create_bank_account_approvals.sql, 055_create_bank_accounts.sql)
2. ⚠️ Edge functions are deployed (see below)
3. ✅ Supabase secrets are configured (STRIPE_SECRET_KEY, TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_PHONE_NUMBER)

## Edge Functions to Deploy

Run these commands to deploy the new edge functions:

```bash
# Deploy bank account approval OTP functions
supabase functions deploy send-bank-account-approval-otp
supabase functions deploy verify-bank-account-approval-otp

# Deploy bank account management functions
supabase functions deploy create-bank-account
supabase functions deploy verify-bank-account
supabase functions deploy resend-micro-deposits
```

## Testing Flow

### 1. Parent Approval (OTP) Flow
**Screen:** Payment Setup (`/(tabs)/payment-setup`)

- [ ] As a teen user, navigate to Payment Setup screen
- [ ] If teen has a parent_id, verify "Request Parent Approval" button appears
- [ ] Click "Request Parent Approval"
- [ ] Verify OTP is sent to parent's phone (check logs/SMS)
- [ ] Verify UI shows masked parent phone number (e.g., `***-***-1234`)
- [ ] Verify expiration time is shown (15 minutes)
- [ ] Enter incorrect OTP code → should show error
- [ ] Enter correct OTP code → should show "Parent Approval Complete"
- [ ] Verify "Add Bank Account" button appears after approval

### 2. Bank Account Setup Flow
**Screen:** Bank Account Setup (`/payments/bank-account-setup`)

- [ ] Navigate to bank account setup (after parent approval or if no parent)
- [ ] Select account type (Checking/Savings) → verify button styling changes
- [ ] Enter invalid routing number (not 9 digits) → verify error
- [ ] Enter valid routing number (9 digits)
- [ ] Enter account number
- [ ] Enter mismatched account number confirmation → verify error
- [ ] Enter matching account number confirmation
- [ ] Enter account holder name
- [ ] Submit form
- [ ] Verify success message appears
- [ ] Verify navigation to verification screen

### 3. Bank Account Verification Flow
**Screen:** Bank Account Verify (`/payments/bank-account-verify`)

- [ ] Verify screen shows instructions about micro-deposits
- [ ] Enter invalid amounts (outside 0.01-0.99 range) → verify error
- [ ] Enter same amounts for both fields → verify error
- [ ] Enter valid, different amounts (e.g., 0.32 and 0.45)
- [ ] Submit verification
- [ ] **Note:** In test mode, Stripe will accept any amounts for verification
- [ ] Verify success message appears
- [ ] Verify navigation back to payment setup screen

### 4. Resend Micro-Deposits Flow

- [ ] On verification screen, click "Resend Deposits"
- [ ] Verify confirmation dialog appears
- [ ] Confirm the action
- [ ] Verify bank account is deleted
- [ ] Verify user is navigated back to setup screen
- [ ] Add bank account again with same details
- [ ] Verify new micro-deposits are triggered

## Edge Cases to Test

1. **Teen without parent:**
   - [ ] Payment setup screen should show "Add Bank Account" immediately (no approval needed)

2. **Expired OTP:**
   - [ ] Request OTP
   - [ ] Wait 15+ minutes (or manually expire in DB)
   - [ ] Try to verify → should show expired message
   - [ ] Verify "Request New Code" button appears

3. **Max OTP attempts:**
   - [ ] Enter wrong OTP 5 times
   - [ ] Verify rate limiting kicks in (2-minute cooldown)

4. **Already verified account:**
   - [ ] Try to verify an already verified account → should show appropriate message

5. **No bank account:**
   - [ ] Try to verify when no bank account exists → should show error

## Stripe Test Mode

For testing, you'll need Stripe test bank account details:

**Test Routing Numbers:**
- `110000000` (Bank of America test)
- `021000021` (Chase test)

**Test Account Numbers:**
- Any 9-17 digit number (Stripe doesn't validate account numbers in test mode)

**Test Micro-Deposits:**
- In Stripe test mode, you can verify with any amounts (e.g., `0.32` and `0.45`)

## Database Verification

After each step, verify data in Supabase:

1. **bank_account_approvals table:**
   ```sql
   SELECT * FROM bank_account_approvals WHERE teen_id = '<user_id>';
   ```

2. **bank_accounts table:**
   ```sql
   SELECT * FROM bank_accounts WHERE user_id = '<user_id>';
   ```

3. **Stripe Dashboard:**
   - Check customers → verify customer created
   - Check customer's sources → verify bank account external account created
   - Verify micro-deposits were sent

## Common Issues

1. **"User not authenticated" errors:**
   - Verify user is logged in
   - Check auth token is being sent in headers

2. **"Stripe not configured" errors:**
   - Verify STRIPE_SECRET_KEY is set in Supabase secrets
   - Check edge function logs

3. **"Failed to send OTP" errors:**
   - Verify Twilio credentials are configured
   - Check parent phone number format

4. **Migration errors:**
   - Ensure migrations 054 and 055 are run
   - Check for table conflicts

