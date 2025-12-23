# Stripe Payment System Setup Guide

## Overview
The Stripe payment system has been fully implemented. This guide will help you configure and deploy it.

## What Was Implemented

### Database Migrations
1. **046_create_stripe_accounts.sql** - Stores Stripe Connect account information for Teenlancers
2. **047_create_payment_methods.sql** - Stores payment methods for Neighbors
3. **048_update_earnings_for_stripe.sql** - Adds Stripe payment tracking to earnings table
4. **049_create_platform_settings.sql** - Stores platform configuration (fees, etc.)
5. **050_add_payment_processing_trigger.sql** - Automatically processes payments when gigs are completed
6. **051_stripe_rls_policies.sql** - Row Level Security policies for payment data

### Edge Functions
1. **create-stripe-account** - Creates Stripe Connect accounts for Teenlancers
2. **process-payment** - Processes payments when gigs are completed
3. **stripe-webhook** - Handles Stripe webhook events
4. **get-payment-methods** - Lists payment methods for users
5. **add-payment-method** - Adds payment methods for Neighbors

### Frontend
1. **Payment Setup Screen** (`app/(tabs)/payment-setup.tsx`) - For Teenlancers to connect Stripe accounts
2. **Payment Methods Screen** (`app/(tabs)/payment-methods.tsx`) - For Neighbors to manage payment methods
3. **Updated Settings Screen** - Added navigation to payment screens based on user role
4. **Updated Earnings Display** - Shows payment status, platform fees, and failure reasons

### API Functions
- `lib/api/payments.ts` - All payment-related API functions

## Configuration Steps

### 1. Run Database Migrations
Run all the migration files in order:
```bash
# Apply migrations via Supabase CLI or Dashboard
supabase migration up
```

Or apply them manually in the Supabase Dashboard → SQL Editor.

### 2. Configure Supabase Database Settings
Set the Supabase URL and service role key for the payment trigger:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
```

You can find these values in:
- Supabase Dashboard → Settings → API → Project URL
- Supabase Dashboard → Settings → API → service_role key (secret)

### 3. Deploy Edge Functions
Deploy all Edge Functions:

```bash
supabase functions deploy create-stripe-account
supabase functions deploy process-payment
supabase functions deploy stripe-webhook
supabase functions deploy get-payment-methods
supabase functions deploy add-payment-method
```

### 4. Configure Edge Function Secrets
Set the following secrets in Supabase Dashboard → Edge Functions → Settings → Secrets:

- `STRIPE_SECRET_KEY` - Your Stripe secret key (from Stripe Dashboard → Developers → API keys)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (see step 5)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `EXPO_PUBLIC_WEB_APP_URL` - Your web app URL (for redirects)

### 5. Configure Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set endpoint URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
5. Copy the webhook signing secret and add it to Edge Function secrets as `STRIPE_WEBHOOK_SECRET`

### 6. Enable Stripe Connect
1. Go to Stripe Dashboard → Settings → Connect
2. Enable Stripe Connect
3. Choose "Express accounts" (recommended for marketplace)
4. Configure your platform settings

### 7. Set Platform Fee (Optional)
The default platform fee is 10% (0.10). To change it:

```sql
UPDATE platform_settings 
SET value = '0.15' 
WHERE key = 'platform_fee_percentage';
-- This sets it to 15%
```

### 8. Install Frontend Dependencies
Add Stripe.js to your frontend (if not already installed):

```bash
npm install @stripe/stripe-js
```

Note: The Edge Functions already have access to Stripe SDK.

## Testing

### Test Stripe Connect Account Creation
1. Log in as a Teenlancer
2. Go to Settings → Payment Setup
3. Click "Connect Stripe Account"
4. Complete the Stripe onboarding flow
5. Verify account status updates in the app

### Test Payment Processing
1. Create a gig as a Neighbor
2. Have a Teenlancer accept and complete the gig
3. Verify that:
   - Earnings record is created
   - Payment is automatically processed
   - Payment status updates in the earnings display
   - Platform fee is calculated correctly

### Test Payment Methods
1. Log in as a Neighbor
2. Go to Settings → Payment Methods
3. Add a payment method (requires Stripe Elements integration - see note below)
4. Set as default
5. Verify payment method appears in the list

## Important Notes

### Payment Method Addition
The payment methods screen currently shows a "Coming Soon" alert when adding payment methods. To fully implement this:

1. Install `@stripe/stripe-js` and `@stripe/react-native` (or use Stripe Payment Sheet)
2. Integrate Stripe Elements or Payment Sheet in the payment methods screen
3. Update the `add-payment-method` Edge Function to handle the payment method creation flow

### Payment Processing Trigger
The payment processing trigger uses `pg_net` extension. If this is not available in your Supabase instance:

1. The trigger will still create earnings records
2. You can manually trigger payment processing by calling the `trigger_payment_processing()` function
3. Or call the `processPayment()` function from the frontend after gig completion

### Environment Variables
Make sure to set `EXPO_PUBLIC_WEB_APP_URL` in your `.env.local` file for proper redirect URLs in Stripe onboarding.

## Troubleshooting

### Payments Not Processing
- Check Edge Function logs in Supabase Dashboard
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check that both Teenlancer and Neighbor have valid Stripe accounts/payment methods
- Verify the payment trigger is firing (check database logs)

### Webhook Events Not Received
- Verify webhook URL is correct in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint
- Review Edge Function logs for webhook errors

### Account Onboarding Issues
- Verify Stripe Connect is enabled in Stripe Dashboard
- Check that redirect URLs are configured correctly
- Review Edge Function logs for account creation errors

## Next Steps

1. Complete Stripe Elements/Payment Sheet integration for adding payment methods
2. Add retry logic for failed payments
3. Implement payment notifications
4. Add admin dashboard for monitoring payments
5. Set up payment reconciliation reports

