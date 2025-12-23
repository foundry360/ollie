#!/bin/bash

# Set all Twilio Edge Function secrets
# Project Reference ID: enxxlckxhcttvsxnjfnw
# 
# Usage: ./set-secrets.sh
# 
# Make sure you have:
# 1. Supabase CLI installed: npm install -g supabase
# 2. Logged in: supabase login
# 3. Project linked: supabase link --project-ref enxxlckxhcttvsxnjfnw

set -e

PROJECT_REF="enxxlckxhcttvsxnjfnw"

echo "🔐 Setting Secrets for Twilio Edge Functions"
echo "Project: $PROJECT_REF"
echo ""
echo "⚠️  Make sure you've set these environment variables or replace them in this script:"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_API_KEY_SID"
echo "   - TWILIO_API_KEY_SECRET"
echo "   - TWILIO_AUTH_TOKEN"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
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
TWILIO_API_KEY_SID=${TWILIO_API_KEY_SID:-""}
TWILIO_API_KEY_SECRET=${TWILIO_API_KEY_SECRET:-""}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-""}
SUPABASE_URL=${SUPABASE_URL:-""}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-""}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}
TWILIO_CONVERSATIONS_SERVICE_SID="IS3cf2fe8fe4a44558ba62ab0946b7555f"

# Prompt for missing values
if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    read -p "Enter TWILIO_ACCOUNT_SID: " TWILIO_ACCOUNT_SID
fi

if [ -z "$TWILIO_API_KEY_SID" ]; then
    read -p "Enter TWILIO_API_KEY_SID: " TWILIO_API_KEY_SID
fi

if [ -z "$TWILIO_API_KEY_SECRET" ]; then
    read -p "Enter TWILIO_API_KEY_SECRET: " TWILIO_API_KEY_SECRET
fi

if [ -z "$TWILIO_AUTH_TOKEN" ]; then
    read -p "Enter TWILIO_AUTH_TOKEN: " TWILIO_AUTH_TOKEN
fi

if [ -z "$SUPABASE_URL" ]; then
    read -p "Enter SUPABASE_URL: " SUPABASE_URL
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    read -p "Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    read -p "Enter SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
fi

echo ""
echo "🔐 Setting secrets..."

# Set all secrets
supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_ACCOUNT_SID"

supabase secrets set TWILIO_API_KEY_SID="$TWILIO_API_KEY_SID" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_API_KEY_SID"

supabase secrets set TWILIO_API_KEY_SECRET="$TWILIO_API_KEY_SECRET" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_API_KEY_SECRET"

supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_AUTH_TOKEN"

supabase secrets set TWILIO_CONVERSATIONS_SERVICE_SID="$TWILIO_CONVERSATIONS_SERVICE_SID" --project-ref "$PROJECT_REF"
echo "✅ Set TWILIO_CONVERSATIONS_SERVICE_SID"

supabase secrets set SUPABASE_URL="$SUPABASE_URL" --project-ref "$PROJECT_REF"
echo "✅ Set SUPABASE_URL"

supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" --project-ref "$PROJECT_REF"
echo "✅ Set SUPABASE_ANON_KEY"

supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref "$PROJECT_REF"
echo "✅ Set SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All secrets set successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: These secrets are now available to all Edge Functions in your project."







