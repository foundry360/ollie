# Payment Processing to Teenlancers - Step by Step

This document outlines the complete payment processing flow from task completion to teenlancer receiving payment.

## Overview

The payment system uses Stripe to:
1. Collect payments from neighbors (task posters)
2. Hold funds on the platform (after deducting platform fees)
3. Transfer funds to teenlancers via ACH bank transfers

---

## Step-by-Step Flow

### Phase 1: Task Completion & Earnings Creation

#### Step 1: Task Status Changes to "Completed"
- When a task/gig is marked as `completed`, a database trigger fires
- **Trigger**: `on_task_completed_create_earnings` (defined in `002_rls_policies.sql`)
- **Function**: `create_earnings_on_completion()`

**Location**: `supabase/migrations/002_rls_policies.sql:129-150`

#### Step 2: Earnings Record Created
The trigger automatically creates an earnings record:
- **Table**: `earnings`
- **Fields**:
  - `teen_id`: The teenlancer who completed the task
  - `gig_id`: Reference to the completed gig
  - `amount`: Payment amount (from `gigs.pay`)
  - `status`: Set to `'pending'`
  - `payment_status`: Set to `'pending'`

**Location**: `supabase/migrations/050_add_payment_processing_trigger.sql:16-21`

---

### Phase 2: Payment Processing (Collecting from Neighbor)

#### Step 3: Payment Processing Triggered
After earnings record is created, payment processing is triggered:

**Option A (Automatic)**: Database trigger calls Edge Function via `pg_net` extension
- Uses `net.http_post()` to call `/functions/v1/process-payment`
- Requires database settings: `app.supabase_url` and `app.service_role_key`

**Option B (Manual)**: Can be called from frontend
- Function: `processPayment(gigId, earningsId)` in `lib/api/payments.ts:159`

**Location**: `supabase/migrations/050_add_payment_processing_trigger.sql:43-57`

#### Step 4: Process Payment Edge Function Executes
**Edge Function**: `supabase/functions/process-payment/index.ts`

**Actions**:
1. **Retrieves earnings record** and associated gig details
2. **Checks payment status** - skips if already processed
3. **Gets neighbor's payment method** from `payment_methods` table (default payment method)
4. **Calculates platform fee**:
   - Gets fee percentage from `platform_settings` (default: 10%)
   - Calculates: `platformFeeAmount = gig.pay * platformFeePercentage`
   - Transfer amount: `transferAmount = gig.pay - platformFeeAmount`
5. **Updates earnings status** to `'processing'`
6. **Creates Stripe Payment Intent**:
   - Amount: Full gig payment amount (in cents)
   - Currency: USD
   - Payment method: Neighbor's default payment method
   - Metadata: Includes `gig_id`, `earnings_id`, `teen_id`, `poster_id`
   - Confirmation: Automatic
7. **Updates earnings record** with:
   - `stripe_payment_intent_id`
   - `platform_fee_amount`
   - `payment_status`: `'succeeded'` or `'processing'`
   - `status`: `'paid'` if succeeded, `'pending'` otherwise
   - `paid_at`: Timestamp if succeeded

**Location**: `supabase/functions/process-payment/index.ts:36-178`

**Note**: At this stage, funds are collected from the neighbor, but the platform receives all funds. Payouts to teenlancers are handled separately.

---

### Phase 3: Webhook Events (Payment Status Updates)

#### Step 5: Stripe Webhook Events
**Edge Function**: `supabase/functions/stripe-webhook/index.ts`

The webhook handles several payment-related events:

**A. `payment_intent.succeeded`**:
- Finds earnings record by `stripe_payment_intent_id`
- Updates:
  - `payment_status`: `'succeeded'`
  - `status`: `'paid'`
  - `paid_at`: Current timestamp

**B. `payment_intent.payment_failed`**:
- Finds earnings record by `stripe_payment_intent_id`
- Updates:
  - `payment_status`: `'failed'`
  - `payment_failed_reason`: Error message from Stripe

**C. `payout.paid`** (for payouts to teenlancers):
- Finds earnings records by `stripe_payout_id`
- Updates:
  - `payout_status`: `'paid'`
  - `paid_at`: Current timestamp

**D. `payout.failed`** (for failed payouts):
- Finds earnings records by `stripe_payout_id`
- Updates:
  - `payout_status`: `'failed'`
  - `payout_failed_reason`: Failure message from Stripe

**Location**: `supabase/functions/stripe-webhook/index.ts:85-179`

---

### Phase 4: Teenlancer Bank Account Setup (Prerequisites)

Before a teenlancer can receive payments, they must set up a bank account.

#### Step 6: Parent Approval (For Teens Under 18)
**Location**: `lib/api/payments.ts:214-316`

1. Teen requests bank account approval
2. System sends OTP to parent's phone via Twilio
3. Parent verifies OTP
4. Approval record created in `bank_account_approvals` table

#### Step 7: Bank Account Creation
**Edge Function**: `supabase/functions/create-bank-account/index.ts`
**API Function**: `lib/api/payments.ts:610`

1. Teen adds bank account details:
   - Routing number
   - Account number
   - Account type (checking/savings)
   - Account holder name
2. System creates Stripe External Account (bank account)
3. Bank account stored in `bank_accounts` table with:
   - `stripe_external_account_id` (e.g., `ba_xxxxx`)
   - `verification_status`: `'pending'`
4. Stripe sends micro-deposits to bank account (for verification)

#### Step 8: Bank Account Verification
**Edge Function**: `supabase/functions/verify-bank-account/index.ts`
**API Function**: `lib/api/payments.ts:650`

1. Teen receives two micro-deposits (usually < $1.00 each)
2. Teen enters the two amounts
3. System verifies amounts with Stripe
4. Bank account `verification_status` updated to `'verified'`

**Location**: `supabase/migrations/055_create_bank_accounts.sql`

---

### Phase 5: Payout Creation (Transfer to Teenlancer)

**⚠️ NOTE**: The codebase shows payout webhook handling, but the actual payout creation function is not yet implemented in the codebase. This step describes what would need to happen:

#### Step 9: Create Payout to Teenlancer
When an earnings record has:
- `payment_status` = `'succeeded'` (funds collected from neighbor)
- No `stripe_payout_id` (not yet paid out)
- Teenlancer has a verified bank account

**Would need to**:
1. Query pending earnings that need payouts
2. Group by teenlancer (optional - could batch or individual)
3. Get teenlancer's bank account (`stripe_external_account_id`)
4. Calculate payout amount:
   - Payout amount = `earnings.amount - earnings.platform_fee_amount`
5. Create Stripe Payout:
   - Amount: Payout amount (in cents)
   - Currency: USD
   - Method: `'standard'` (ACH) or `'instant'`
   - Destination: Bank account `stripe_external_account_id`
6. Update earnings record:
   - `stripe_payout_id`: Stripe payout ID
   - `payout_status`: `'pending'` or `'in_transit'`

**Stripe API Reference**: `POST /v1/payouts`

---

### Phase 6: Payout Completion

#### Step 10: Payout Status Updates (via Webhook)
Once payout is created (Step 9), Stripe sends webhook events:

**`payout.paid`**:
- Webhook handler updates earnings records
- Sets `payout_status` = `'paid'`
- Sets `paid_at` = current timestamp

**`payout.failed`**:
- Webhook handler updates earnings records
- Sets `payout_status` = `'failed'`
- Sets `payout_failed_reason` = failure message

**Location**: `supabase/functions/stripe-webhook/index.ts:135-179`

---

## Database Schema

### Earnings Table Fields (Payment-Related)
- `id`: UUID
- `teen_id`: UUID (references users)
- `gig_id`: UUID (references gigs)
- `amount`: DECIMAL(10, 2) - Full payment amount
- `status`: `'pending' | 'paid' | 'cancelled'`
- `payment_status`: `'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'`
- `stripe_payment_intent_id`: TEXT - Stripe Payment Intent ID
- `stripe_transfer_id`: TEXT - (Reserved for future use)
- `stripe_payout_id`: TEXT - Stripe Payout ID (when payout is created)
- `platform_fee_amount`: DECIMAL(10, 2) - Platform fee deducted
- `payment_failed_reason`: TEXT - Reason if payment failed
- `payout_status`: TEXT - Status of payout to teenlancer
- `payout_failed_reason`: TEXT - Reason if payout failed
- `paid_at`: TIMESTAMPTZ - When payment was completed
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**Location**: 
- Initial: `supabase/migrations/001_initial_schema.sql:55-66`
- Stripe additions: `supabase/migrations/048_update_earnings_for_stripe.sql`

### Bank Accounts Table
- `id`: UUID
- `user_id`: UUID (references users)
- `stripe_external_account_id`: TEXT - Stripe bank account ID
- `stripe_customer_id`: TEXT - Stripe customer ID
- `account_type`: `'checking' | 'savings'`
- `account_holder_name`: TEXT
- `bank_name`: TEXT
- `routing_number`: TEXT
- `account_number_last4`: TEXT
- `verification_status`: `'pending' | 'verified' | 'failed' | 'unverified'`
- `is_default`: BOOLEAN

**Location**: `supabase/migrations/055_create_bank_accounts.sql`

---

## Key Files Reference

### Database Migrations
- `002_rls_policies.sql`: Earnings creation trigger
- `048_update_earnings_for_stripe.sql`: Stripe payment fields
- `050_add_payment_processing_trigger.sql`: Payment processing trigger
- `055_create_bank_accounts.sql`: Bank accounts table

### Edge Functions
- `process-payment/index.ts`: Processes payment from neighbor
- `stripe-webhook/index.ts`: Handles Stripe webhook events
- `create-bank-account/index.ts`: Creates bank account for teenlancer
- `verify-bank-account/index.ts`: Verifies bank account with micro-deposits

### API Functions
- `lib/api/payments.ts`: All payment-related API functions
- `lib/api/earnings.ts`: Earnings retrieval functions

### Frontend
- `app/(tabs)/payment-setup.tsx`: Bank account setup for teenlancers
- `app/payments/bank-account-setup.tsx`: Bank account form
- `app/payments/bank-account-verify.tsx`: Micro-deposit verification
- `app/(tabs)/earnings.tsx`: Earnings display for teenlancers

---

## Current Implementation Status

✅ **Implemented**:
- Earnings record creation on task completion
- Payment collection from neighbors (Payment Intent)
- Platform fee calculation
- Bank account setup for teenlancers
- Bank account verification via micro-deposits
- Webhook handling for payment status updates
- Webhook handling for payout status updates (when payouts exist)

⚠️ **Not Yet Implemented**:
- Automatic payout creation function
- Batch payout processing
- Payout scheduling/retry logic

**Note**: The system currently collects payments successfully, but payouts to teenlancers would need to be implemented as a separate process (scheduled job or manual trigger) that:
1. Finds earnings with `payment_status = 'succeeded'` and no `stripe_payout_id`
2. Creates Stripe payouts for verified bank accounts
3. Updates earnings records with payout IDs

---

## Testing Checklist

- [ ] Task completion triggers earnings creation
- [ ] Payment processing collects funds from neighbor
- [ ] Platform fees are calculated correctly
- [ ] Webhook events update payment status correctly
- [ ] Bank account setup works for teenlancers
- [ ] Parent approval works for teens under 18
- [ ] Bank account verification with micro-deposits works
- [ ] Earnings display shows correct payment status
- [ ] Failed payments are handled gracefully

---

## Future Enhancements

1. **Automatic Payout Creation**: Implement scheduled job to create payouts for pending earnings
2. **Payout Batching**: Group multiple earnings per teenlancer into single payout
3. **Payout Scheduling**: Configurable payout schedule (daily, weekly, etc.)
4. **Retry Logic**: Automatic retry for failed payouts
5. **Payout Notifications**: Notify teenlancers when payouts are sent/received
6. **Reporting**: Admin dashboard for payment/payout monitoring

