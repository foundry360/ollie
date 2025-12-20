#!/bin/bash

# Test script for send-parent-account-email Edge Function
# Replace these with your actual values:
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
PARENT_EMAIL="test@example.com"
TEMP_PASSWORD="TempPass12345678"
TEEN_NAME="Alex Johnson"
WEB_APP_URL="https://your-app-url.com"

# Test the Edge Function
curl -X POST \
  "${SUPABASE_URL}/functions/v1/send-parent-account-email" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"parentEmail\": \"${PARENT_EMAIL}\",
    \"tempPassword\": \"${TEMP_PASSWORD}\",
    \"teenName\": \"${TEEN_NAME}\",
    \"webAppUrl\": \"${WEB_APP_URL}\"
  }"




















