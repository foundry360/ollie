#!/bin/bash

# Complete Twilio Edge Functions Deployment Script
# Project Reference ID: enxxlckxhcttvsxnjfnw
# Run this script from the project root directory

set -e

PROJECT_REF="enxxlckxhcttvsxnjfnw"

echo "🚀 Deploying Twilio Edge Functions"
echo "Project: $PROJECT_REF"
echo ""

# Step 1: Check if Supabase CLI is installed
echo "📋 Step 1: Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo "✅ Supabase CLI is installed"
    supabase --version
fi
echo ""

# Step 2: Login to Supabase
echo "📋 Step 2: Logging in to Supabase..."
echo "⚠️  If you're already logged in, this will skip automatically"
supabase login
echo ""

# Step 3: Link project
echo "📋 Step 3: Linking project..."
supabase link --project-ref "$PROJECT_REF" || {
    echo "⚠️  Project may already be linked, continuing..."
}
echo ""

# Step 4: Deploy functions
echo "📋 Step 4: Deploying Edge Functions..."
echo ""

echo "📦 Deploying generate-twilio-token..."
supabase functions deploy generate-twilio-token
echo "✅ generate-twilio-token deployed"
echo ""

echo "📦 Deploying manage-twilio-conversation..."
supabase functions deploy manage-twilio-conversation
echo "✅ manage-twilio-conversation deployed"
echo ""

echo "📦 Deploying send-twilio-message..."
supabase functions deploy send-twilio-message
echo "✅ send-twilio-message deployed"
echo ""

echo "📦 Deploying twilio-webhook..."
supabase functions deploy twilio-webhook
echo "✅ twilio-webhook deployed"
echo ""

echo "📦 Deploying get-twilio-messages..."
supabase functions deploy get-twilio-messages
echo "✅ get-twilio-messages deployed"
echo ""

# Step 5: Verify deployment
echo "📋 Step 5: Verifying deployment..."
supabase functions list
echo ""

# Step 6: Push migrations
echo "📋 Step 6: Pushing database migrations..."
supabase db push
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Set secrets for each function in Supabase Dashboard:"
echo "   → Edge Functions → [Function Name] → Settings → Secrets"
echo ""
echo "2. Configure Twilio webhook URL:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/twilio-webhook"
echo ""
echo "3. Function URLs:"
echo "   • https://$PROJECT_REF.supabase.co/functions/v1/generate-twilio-token"
echo "   • https://$PROJECT_REF.supabase.co/functions/v1/manage-twilio-conversation"
echo "   • https://$PROJECT_REF.supabase.co/functions/v1/send-twilio-message"
echo "   • https://$PROJECT_REF.supabase.co/functions/v1/twilio-webhook"
echo "   • https://$PROJECT_REF.supabase.co/functions/v1/get-twilio-messages"
echo ""







