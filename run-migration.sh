#!/bin/bash
# Track B Supabase Migration - Full Automation Script
# Runs all 6 deployment steps with guidance for manual dashboard steps

set -e
trap 'echo "❌ Error on line $LINENO"' ERR

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(pwd)"
VERCEL_URL="https://financial101vercel.app"
CF_URL="https://financeplan-th.pages.dev"
SUPABASE_URL="https://qmuvdpnnpptfrinhnzlv.supabase.co"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var before running this script}"

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║           Track B Supabase Migration - Automated Deployment               ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: GIT PUSH & VERCEL DEPLOYMENT
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 1/6] Committing and pushing code to GitHub...${NC}"
echo "─────────────────────────────────────────────────────────────"

if ! git status &>/dev/null; then
  echo -e "${RED}❌ Not in a git repository. Aborting.${NC}"
  exit 1
fi

CHANGED=$(git status --porcelain | wc -l)

if [ "$CHANGED" -gt 0 ]; then
  echo "Found $CHANGED modified files. Committing..."
  git add .
  git commit -m "chore: Track B - Unified Supabase backend deployment" 2>/dev/null || echo "ℹ No changes to commit"
  echo -e "${GREEN}✓ Changes committed${NC}"
else
  echo "ℹ No uncommitted changes"
fi

echo "Pushing to GitHub (main branch)..."
git push origin main
echo -e "${GREEN}✓ Code pushed to GitHub${NC}"
echo "⏳ Vercel is building... (monitor: https://vercel.com/tccollectibles/financial-planner)"
echo ""

# Wait for Vercel deployment
echo "Waiting 30 seconds for Vercel to start build..."
sleep 30

# Poll Vercel deployment status
echo "Checking Vercel deployment status..."
RETRY=0
MAX_RETRIES=12  # 2 minutes total
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -s "$VERCEL_URL/api/admin/users" -H "Content-Type: application/json" &>/dev/null; then
    echo -e "${GREEN}✓ Vercel deployment ready${NC}"
    break
  fi
  RETRY=$((RETRY + 1))
  echo "  Waiting... ($((RETRY * 10)) seconds elapsed)"
  sleep 10
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  echo -e "${YELLOW}⚠ Vercel still deploying. Continuing to next steps...${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: RUN MIGRATION SCRIPT
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 2/6] Running Supabase migration script...${NC}"
echo "─────────────────────────────────────────────────────────────"
echo "Migrating KV data → Supabase..."
echo ""

CF_BASE_URL="$CF_URL" \
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_KEY" \
node scripts/migrate-kv-to-supabase.mjs 2>&1

echo ""
echo -e "${GREEN}✓ Migration completed${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: CLOUDFLARE ENVIRONMENT VARIABLES (MANUAL)
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 3/6] Cloudflare environment variables (MANUAL)${NC}"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Open Cloudflare Dashboard:"
echo "  https://dash.cloudflare.com/"
echo ""
echo "Navigate to: Workers & Pages → financial-planner → Settings → Environment Variables"
echo ""
echo "Add these variables for BOTH Production AND Preview:"
echo ""
echo -e "${YELLOW}┌─ NEXT_PUBLIC_SUPABASE_URL${NC}"
echo "│ $SUPABASE_URL"
echo ""
echo -e "${YELLOW}┌─ NEXT_PUBLIC_SUPABASE_ANON_KEY${NC}"
echo "│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdXZkcG5ucHB0ZnJpbmhuemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzA0MDAsImV4cCI6MTg0MjkwNjQwMH0.4rR3EBKwKZNKDfXw2cWL7LJVDPHSxj0MnB7hP1qEYYY"
echo ""
echo -e "${YELLOW}┌─ SUPABASE_SERVICE_ROLE_KEY${NC}"
echo "│ $SUPABASE_KEY"
echo ""
echo -e "${YELLOW}┌─ NEXT_PUBLIC_ALLOWED_EMAILS${NC}"
echo "│ toy.theeranan@icloud.com,toy.theeranan@gmail.com"
echo ""
read -p "Press ENTER once environment variables are set in Cloudflare..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: DEPLOY TO CLOUDFLARE
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 4/6] Deploying to Cloudflare Pages...${NC}"
echo "─────────────────────────────────────────────────────────────"

if git remote | grep -q cloudflare; then
  echo "Pushing to Cloudflare remote..."
  git push cloudflare main
  echo -e "${GREEN}✓ Cloudflare deployment initiated${NC}"
  echo "⏳ Waiting 30 seconds for Cloudflare build..."
  sleep 30

  # Check Cloudflare endpoint
  if curl -s "$CF_URL/api/admin/users" &>/dev/null; then
    echo -e "${GREEN}✓ Cloudflare deployment ready${NC}"
  else
    echo -e "${YELLOW}⚠ Cloudflare still building...${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No 'cloudflare' git remote configured${NC}"
  echo "   Skipping automatic push. Push manually with:"
  echo "   git push cloudflare main"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: CREATE ADMIN AUTH USERS (MANUAL)
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 5/6] Creating admin authentication users (MANUAL)${NC}"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Open Supabase Auth Console:"
echo "  https://supabase.com/dashboard/project/qmuvdpnnpptfrinhnzlv/auth/users"
echo ""
echo "Click 'Add user' and create:"
echo ""
echo -e "${YELLOW}User 1:${NC}"
echo "  Email:    toy.theeranan@icloud.com"
echo "  Password: @Supa2026"
echo ""
echo -e "${YELLOW}User 2:${NC}"
echo "  Email:    toy.theeranan@gmail.com"
echo "  Password: @Supa2026"
echo ""
read -p "Press ENTER once both admin users are created..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: SMOKE TESTS
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}[STEP 6/6] Running smoke tests...${NC}"
echo "─────────────────────────────────────────────────────────────"
echo ""

test_endpoint() {
  local name=$1
  local url=$2

  echo "Testing: $name"
  echo "  URL: $url"

  local response
  response=$(curl -s -X GET "$url" 2>/dev/null || echo '{"error":"Connection failed"}')

  if echo "$response" | grep -q '"users"'; then
    local count=$(echo "$response" | grep -o '"id"' | wc -l)
    echo -e "  ${GREEN}✓ SUCCESS - Found $count users${NC}"
    return 0
  else
    echo -e "  ${RED}✗ FAILED${NC}"
    echo "  Response: $response"
    return 1
  fi
}

TESTS_PASSED=0
TESTS_TOTAL=2

echo "Test 1: Vercel Endpoint"
if test_endpoint "Vercel (Next.js)" "$VERCEL_URL/api/admin/users"; then
  TESTS_PASSED=$((TESTS_PASSED + 1))
fi
echo ""

echo "Test 2: Cloudflare Endpoint"
if test_endpoint "Cloudflare (Pages)" "$CF_URL/api/admin/users"; then
  TESTS_PASSED=$((TESTS_PASSED + 1))
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                        DEPLOYMENT COMPLETE                               ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
  echo -e "${GREEN}✓ All tests passed ($TESTS_PASSED/$TESTS_TOTAL)${NC}"
else
  echo -e "${YELLOW}⚠ Some tests failed ($TESTS_PASSED/$TESTS_TOTAL)${NC}"
fi

echo ""
echo "Next steps:"
echo "  1. Verify both endpoints return the migrated user list"
echo "  2. Test login with created admin users"
echo "  3. Check logs for any errors (24 hour monitoring)"
echo "  4. Archive/remove old KV and filesystem data after verification"
echo ""
echo "Documentation:"
echo "  - Status: MIGRATION_STATUS.md"
echo "  - Quick ref: QUICK_START.txt"
echo ""
