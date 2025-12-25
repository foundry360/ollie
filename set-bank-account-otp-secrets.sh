#!/bin/bash

# Set Twilio secrets for send-bank-account-approval-otp Edge Function
# Project Reference ID: enxxlckxhcttvsxnjfnw
# 
# Usage: ./set-bank-account-otp-secrets.sh
# 
# Make sure you have:
# 1. Supabase CLI installed: npm install -g supabase
# 2. Logged in: supabase login
# 3. Project linked: supabase link --project-ref enxxlckxhcttvsxnjfnw

set -e

PROJECT_REF="enxxlckxhcttvsxnjfnw"

echo "🔐 Setting Twilio Secrets for send-bank-account-approval-otp Function"
echo "Project: $PROJECT_REF"
echo ""
echo "⚠️  This function requires:"
echo "   - TWILIO_ACCOUNT_SID (from Twilio Console)"
echo "   - TWILIO_AUTH_TOKEN (from Twilio Console)"
echo "   - TWILIO_PHONE_NUMBER (your Twilio phone number in E.164 format, e.g., +1234567890)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in. Run: supabase login"
    exit 1
fi

echo ""
echo "📋 Setting secrets..."
echo ""

# Get values from environment variables or prompt
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:-""}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-""}
TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER:-""}

# Prompt for missing values
if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    read -p "Enter TWILIO_ACCOUNT_SID: " TWILIO_ACCOUNT_SID
fi

if [ -z "$TWILIO_AUTH_TOKEN" ]; then
    read -p "Enter TWILIO_AUTH_TOKEN: " TWILIO_AUTH_TOKEN
fi

if [ -z "$TWILIO_PHONE_NUMBER" ]; then
    read -p "Enter TWILIO_PHONE_NUMBER (E.164 format, e.g., +1234567890): " TWILIO_PHONE_NUMBER
fi

echo ""
echo "🔐 Setting secrets..."

# Set secrets (these are available to all Edge Functions in the project)
supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_ACCOUNT_SID"

supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_AUTH_TOKEN"

supabase secrets set TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_PHONE_NUMBER"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All secrets set successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: These secrets are now available to all Edge Functions in your project."
echo "The send-bank-account-approval-otp function will now be able to send SMS via Twilio."
echo ""
echo "To verify, test the function by requesting parent approval from the app."

