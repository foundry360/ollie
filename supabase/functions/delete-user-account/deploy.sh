#!/bin/bash

# Deploy delete-user-account Edge Function
# Try different deployment methods if one fails

echo "Deploying delete-user-account function..."

# Method 1: Try standard deployment
echo "Attempting standard deployment..."
supabase functions deploy delete-user-account

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  exit 0
fi

echo "Standard deployment failed, trying with --use-api flag..."
# Method 2: Try with Management API
supabase functions deploy delete-user-account --use-api

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful with --use-api!"
  exit 0
fi

echo "API deployment failed, trying with --use-docker flag..."
# Method 3: Try with Docker
supabase functions deploy delete-user-account --use-docker

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful with --use-docker!"
  exit 0
fi

echo "❌ All deployment methods failed. Please check the error messages above."
exit 1



















