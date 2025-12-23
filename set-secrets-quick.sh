#!/bin/bash

# Quick script to set all secrets (non-interactive)
# Set environment variables before running, or edit values below

PROJECT_REF="YOUR_PROJECT_REF"

# ============================================
# EDIT THESE VALUES:
# ============================================
TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
TWILIO_API_KEY_SID="YOUR_TWILIO_API_KEY_SID"
TWILIO_API_KEY_SECRET="YOUR_TWILIO_API_KEY_SECRET"
TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
TWILIO_CONVERSATIONS_SERVICE_SID="YOUR_TWILIO_CONVERSATIONS_SERVICE_SID"

# ============================================
# DO NOT EDIT BELOW THIS LINE
# ============================================

echo "🔐 Setting all secrets..."

supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" --project-ref "$PROJECT_REF"
supabase secrets set TWILIO_API_KEY_SID="$TWILIO_API_KEY_SID" --project-ref "$PROJECT_REF"
supabase secrets set TWILIO_API_KEY_SECRET="$TWILIO_API_KEY_SECRET" --project-ref "$PROJECT_REF"
supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" --project-ref "$PROJECT_REF"
supabase secrets set TWILIO_CONVERSATIONS_SERVICE_SID="$TWILIO_CONVERSATIONS_SERVICE_SID" --project-ref "$PROJECT_REF"
supabase secrets set SUPABASE_URL="$SUPABASE_URL" --project-ref "$PROJECT_REF"
supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" --project-ref "$PROJECT_REF"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref "$PROJECT_REF"

echo "✅ All secrets set!"







