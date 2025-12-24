#!/bin/bash

# Deploy all bank account related edge functions

echo "🚀 Deploying bank account edge functions..."

echo ""
echo "1️⃣  Deploying send-bank-account-approval-otp..."
supabase functions deploy send-bank-account-approval-otp

echo ""
echo "2️⃣  Deploying verify-bank-account-approval-otp..."
supabase functions deploy verify-bank-account-approval-otp

echo ""
echo "3️⃣  Deploying create-bank-account..."
supabase functions deploy create-bank-account

echo ""
echo "4️⃣  Deploying verify-bank-account..."
supabase functions deploy verify-bank-account

echo ""
echo "5️⃣  Deploying resend-micro-deposits..."
supabase functions deploy resend-micro-deposits

echo ""
echo "✅ All bank account functions deployed!"
echo ""
echo "📋 Next steps:"
echo "   1. Make sure migrations 054 and 055 are applied"
echo "   2. Verify Supabase secrets are configured (STRIPE_SECRET_KEY, TWILIO_*)"
echo "   3. Start your app: npm start"
echo "   4. Navigate to Payment Setup screen to test"

