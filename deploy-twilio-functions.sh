#!/bin/bash

# Deploy Twilio Edge Functions to Supabase
# Usage: ./deploy-twilio-functions.sh [project-ref]
# Or set SUPABASE_PROJECT_REF environment variable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project ref from argument or environment variable
PROJECT_REF="${1:-${SUPABASE_PROJECT_REF}}"

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}Error: Project reference ID is required${NC}"
    echo "Usage: ./deploy-twilio-functions.sh [project-ref]"
    echo "Or set SUPABASE_PROJECT_REF environment variable"
    exit 1
fi

echo -e "${GREEN}🚀 Deploying Twilio Edge Functions to Supabase${NC}"
echo -e "Project Ref: ${YELLOW}$PROJECT_REF${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase. Please run: supabase login${NC}"
    exit 1
fi

# Link project (will skip if already linked)
echo -e "${GREEN}📎 Linking project...${NC}"
supabase link --project-ref "$PROJECT_REF" || {
    echo -e "${YELLOW}⚠️  Project may already be linked, continuing...${NC}"
}

echo ""
echo -e "${GREEN}📦 Deploying functions...${NC}"
echo ""

# List of functions to deploy
FUNCTIONS=(
    "generate-twilio-token"
    "manage-twilio-conversation"
    "send-twilio-message"
    "twilio-webhook"
    "get-twilio-messages"
)

# Deploy each function
SUCCESS_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}Deploying: $func${NC}"
    if supabase functions deploy "$func"; then
        echo -e "${GREEN}✅ Successfully deployed: $func${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}❌ Failed to deploy: $func${NC}"
        FAILED_FUNCTIONS+=("$func")
    fi
    echo ""
done

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Successfully deployed: ${GREEN}$SUCCESS_COUNT/${#FUNCTIONS[@]}${NC} functions"

if [ ${#FAILED_FUNCTIONS[@]} -gt 0 ]; then
    echo -e "${RED}Failed functions:${NC}"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo -e "  ${RED}❌ $func${NC}"
    done
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All functions deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  1. Set secrets for each function in Supabase Dashboard"
echo "  2. Configure Twilio webhook URL: https://$PROJECT_REF.supabase.co/functions/v1/twilio-webhook"
echo "  3. Run migrations: supabase db push"
echo ""







