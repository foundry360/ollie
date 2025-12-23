#!/bin/bash

# Delete a Stripe Connect account using curl
# Usage: ./delete-stripe-account.sh ACCOUNT_ID SECRET_KEY

ACCOUNT_ID=$1
SECRET_KEY=$2

if [ -z "$ACCOUNT_ID" ] || [ -z "$SECRET_KEY" ]; then
  echo "Usage: ./delete-stripe-account.sh ACCOUNT_ID SECRET_KEY"
  echo ""
  echo "Example:"
  echo "  ./delete-stripe-account.sh acct_1234567890 sk_test_xxxxx"
  exit 1
fi

echo "Deleting Stripe account: $ACCOUNT_ID"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
  "https://api.stripe.com/v1/accounts/$ACCOUNT_ID" \
  -u "$SECRET_KEY:" \
  -H "Content-Type: application/x-www-form-urlencoded")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Account deleted successfully!"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed to delete account (HTTP $HTTP_CODE)"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi

