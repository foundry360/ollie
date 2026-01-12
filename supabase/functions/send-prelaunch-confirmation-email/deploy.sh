#!/bin/bash

# Deploy Prelaunch Confirmation Email Edge Function to Supabase
# Usage: ./deploy.sh [project-ref]
# Or set SUPABASE_PROJECT_REF environment variable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project ref from argument or environment variable
PROJECT_REF="${1:-${SUPABASE_PROJECT_REF}}"

echo -e "${GREEN}🚀 Deploying Prelaunch Confirmation Email Function${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found in PATH, trying npx...${NC}"
    SUPABASE_CMD="npx supabase"
else
    SUPABASE_CMD="supabase"
fi

# Check if logged in
if ! $SUPABASE_CMD projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo -e "${YELLOW}Please run: ${SUPABASE_CMD} login${NC}"
    exit 1
fi

# Link project if project ref provided
if [ -n "$PROJECT_REF" ]; then
    echo -e "${GREEN}📎 Linking project...${NC}"
    $SUPABASE_CMD link --project-ref "$PROJECT_REF" || {
        echo -e "${YELLOW}⚠️  Project may already be linked, continuing...${NC}"
    }
fi

echo ""
echo -e "${GREEN}📦 Deploying send-prelaunch-confirmation-email function...${NC}"
echo ""

# Deploy the function
if $SUPABASE_CMD functions deploy send-prelaunch-confirmation-email; then
    echo ""
    echo -e "${GREEN}✅ Successfully deployed!${NC}"
    echo ""
    echo -e "${YELLOW}ℹ️  Note:${NC}"
    echo "  Since you're already sending emails, Resend secrets (RESEND_API_KEY, etc.)"
    echo "  are likely already configured at the project level and will be used automatically."
    echo ""
    echo "  Optional: To add launchemail.png header image, set these secrets:"
    echo "     - EMAIL_HEADER_URL (full URL to launchemail.png)"
    echo "     - SUPABASE_URL (for auto-constructing launchemail.png URL)"
    echo ""
    echo -e "${GREEN}📧 Function URL:${NC}"
    echo "  https://${PROJECT_REF:-YOUR_PROJECT}.supabase.co/functions/v1/send-prelaunch-confirmation-email"
    echo ""
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

