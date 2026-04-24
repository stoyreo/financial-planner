#!/bin/bash
# Track B Supabase Migration Deployment Script
# This script completes the migration from split registries (CF KV + Vercel FS) to unified Supabase

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "  Track B Supabase Migration - Final Deployment Steps"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Git commit and push
echo "[STEP 1/6] Committing code changes to GitHub..."
echo "─────────────────────────────────────────────"

if ! git status &>/dev/null; then
  echo "❌ ERROR: Not in a git repository. Please cd into the financial-planner directory."
  exit 1
fi

CHANGED_FILES=$(git status --porcelain | wc -l)
if [ "$CHANGED_FILES" -eq 0 ]; then
  echo "✓ No uncommitted changes detected. Code was already committed."
else
  echo "Found $CHANGED_FILES modified files. Committing..."
  git add .
  git commit -m "Track B: Unified Supabase backend - Vercel routes, migration script, Cloudflare functions"
  echo "✓ Code committed"
fi

echo "Pushing to GitHub..."
git push origin main
echo "✓ Code pushed to GitHub"
echo "  (Vercel will automatically detect changes and build)"
echo ""

# Step 2: Wait for Vercel deployment
echo "[STEP 2/6] Waiting for Vercel deployment..."
echo "────────────────────────────────────"
echo "⏳ Vercel is building and deploying the new code..."
echo "   Monitor at: https://vercel.com/tccollectibles/financial-planner"
echo ""
echo "Press ENTER once the Vercel deployment shows as 'Ready' for Production..."
read

# Step 3: Run migration script
echo "[STEP 3/6] Running Supabase migration script..."
echo "──────────────────────────────────────────"
echo "This will migrate KV data from Cloudflare to Supabase."
echo ""
echo "Ensure you have these environment variables set:"
echo "  - CF_BASE_URL=https://financeplan-th.pages.dev"
echo "  - SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co"
echo "  - SUPABASE_SERVICE_ROLE_KEY=<SET-SUPABASE_SERVICE_ROLE_KEY-IN-ENV>"
echo ""

read -p "Ready to run migration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  CF_BASE_URL=https://financeplan-th.pages.dev \
  SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<SET-SUPABASE_SERVICE_ROLE_KEY-IN-ENV> \
  node scripts/migrate-kv-to-supabase.mjs
  echo "✓ Migration completed"
else
  echo "Skipping migration. You can run it manually later:"
  echo "  CF_BASE_URL=https://financeplan-th.pages.dev SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co SUPABASE_SERVICE_ROLE_KEY=<SET-SUPABASE_SERVICE_ROLE_KEY-IN-ENV> node scripts/migrate-kv-to-supabase.mjs"
fi
echo ""

# Step 4: Configure Cloudflare
echo "[STEP 4/6] Setting Cloudflare Pages environment variables..."
echo "────────────────────────────────────────────────────────"
echo "Set these environment variables in Cloudflare Pages (Settings > Environment Variables):"
echo "  For Production AND Preview:"
echo "    - NEXT_PUBLIC_SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co"
echo "    - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdXZkcG5ucHB0ZnJpbmhuemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzA0MDAsImV4cCI6MTg0MjkwNjQwMH0.4rR3EBKwKZNKDfXw2cWL7LJVDPHSxj0MnB7hP1qEYYY"
echo "    - SUPABASE_SERVICE_ROLE_KEY=<SET-SUPABASE_SERVICE_ROLE_KEY-IN-ENV>"
echo "    - NEXT_PUBLIC_ALLOWED_EMAILS=toy.theeranan@icloud.com,toy.theeranan@gmail.com"
echo ""
echo "Set these in Cloudflare Pages (Settings > Environment Variables):"
echo "  https://dash.cloudflare.com/... (find your Pages project)"
echo ""

read -p "Press ENTER once Cloudflare environment variables are set..."
echo ""

# Step 5: Deploy to Cloudflare
echo "[STEP 5/6] Deploying to Cloudflare Pages..."
echo "──────────────────────────────────────────"
echo "Deploy the Cloudflare Pages functions with:"
echo "  npm run deploy:cloudflare"
echo ""
echo "Or manually push to your Cloudflare Pages deployment:"
echo "  git push cloudflare main"
echo ""

read -p "Press ENTER once Cloudflare deployment is complete..."
echo ""

# Step 6: Create admin users
echo "[STEP 6/6] Creating admin authentication users..."
echo "────────────────────────────────────────────"
echo "Create admin users in Supabase (Auth > Users):"
echo ""
echo "User 1:"
echo "  Email: toy.theeranan@icloud.com"
echo "  Password: @Supa2026"
echo ""
echo "User 2:"
echo "  Email: toy.theeranan@gmail.com"
echo "  Password: @Supa2026"
echo ""
echo "Open Supabase console: https://supabase.com/dashboard/project/qmuvdpnnpptfrinhnzlv/auth/users"
echo ""

read -p "Press ENTER once admin users are created..."
echo ""

# Verification
echo "════════════════════════════════════════════════════════════════"
echo "  FINAL VERIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Run these smoke tests:"
echo ""
echo "1. Vercel (Next.js):"
echo "   curl -X GET 'https://financial101vercel.app/api/admin/users' | jq"
echo ""
echo "2. Cloudflare (Pages Functions):"
echo "   curl -X GET 'https://financeplan-th.pages.dev/api/admin/users' | jq"
echo ""
echo "Both should return the migrated user list from Supabase."
echo ""
echo "✓ Migration complete!"
echo ""
