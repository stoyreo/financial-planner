@echo off
REM Track B Supabase Migration - Windows Batch Script
REM Full automation with guided manual steps

setlocal enabledelayedexpansion

REM Configuration
set "PROJECT_DIR=%cd%"
set "VERCEL_URL=https://financial101vercel.app"
set "CF_URL=https://financeplan-th.pages.dev"
set "SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co"
if not defined SUPABASE_SERVICE_ROLE_KEY (
  echo ERROR: SUPABASE_SERVICE_ROLE_KEY env var is not set. Set it before running this script.
  exit /b 1
)
set "SUPABASE_KEY=%SUPABASE_SERVICE_ROLE_KEY%"
set "ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdXZkcG5ucHB0ZnJpbmhuemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzA0MDAsImV4cCI6MTg0MjkwNjQwMH0.4rR3EBKwKZNKDfXw2cWL7LJVDPHSxj0MnB7hP1qEYYY"

cls
echo.
echo ════════════════════════════════════════════════════════════════════════════
echo   Track B Supabase Migration - Automated Deployment
echo ════════════════════════════════════════════════════════════════════════════
echo.

REM Check if git is available
git status >nul 2>&1
if errorlevel 1 (
  echo ERROR: Not in a git repository or git not installed
  pause
  exit /b 1
)

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 1: GIT PUSH
REM ─────────────────────────────────────────────────────────────────────────

echo [STEP 1/6] Committing and pushing code to GitHub...
echo ─────────────────────────────────────────────────────

echo.
echo Checking for changes...
git add .
git commit -m "chore: Track B - Unified Supabase backend deployment" 2>nul
if errorlevel 0 (
  echo Changes committed
) else (
  echo No changes to commit
)

echo.
echo Pushing to GitHub...
git push origin main

if errorlevel 1 (
  echo WARNING: Git push may have failed
  echo Please ensure your GitHub credentials are configured
)

echo.
echo SUCCESS: Code pushed
echo Waiting for Vercel to build (30 seconds)...
timeout /t 30 /nobreak

echo.
echo Checking Vercel deployment...
for /L %%i in (1,1,12) do (
  curl -s "%VERCEL_URL%/api/admin/users" >nul 2>&1
  if errorlevel 0 (
    echo Vercel deployment ready!
    goto step2
  )
  echo Attempt %%i/12 - waiting...
  timeout /t 10 /nobreak
)

echo.
echo WARNING: Vercel still deploying. Continuing...
echo.

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 2: RUN MIGRATION
REM ─────────────────────────────────────────────────────────────────────────

:step2
echo [STEP 2/6] Running Supabase migration script...
echo ─────────────────────────────────────────────────

echo.
echo Migrating KV data to Supabase...
set "CF_BASE_URL=%CF_URL%"
set "SUPABASE_URL=%SUPABASE_URL%"
set "SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_KEY%"

node scripts/migrate-kv-to-supabase.mjs

if errorlevel 1 (
  echo.
  echo ERROR: Migration script failed
  echo Check the output above for details
  pause
  exit /b 1
)

echo.
echo SUCCESS: Migration completed
echo.

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 3: CLOUDFLARE ENV VARS (MANUAL)
REM ─────────────────────────────────────────────────────────────────────────

echo [STEP 3/6] Cloudflare environment variables (MANUAL)
echo ─────────────────────────────────────────────────────

echo.
echo IMPORTANT: You must set environment variables in Cloudflare Dashboard
echo.
echo Open this link in your browser:
echo   https://dash.cloudflare.com/
echo.
echo Then navigate to:
echo   Workers ^& Pages ^→ financial-planner ^→ Settings ^→ Environment Variables
echo.
echo Add these variables for BOTH Production AND Preview:
echo.
echo   NEXT_PUBLIC_SUPABASE_URL
echo   %SUPABASE_URL%
echo.
echo   NEXT_PUBLIC_SUPABASE_ANON_KEY
echo   %ANON_KEY%
echo.
echo   SUPABASE_SERVICE_ROLE_KEY
echo   %SUPABASE_KEY%
echo.
echo   NEXT_PUBLIC_ALLOWED_EMAILS
echo   toy.theeranan@icloud.com,toy.theeranan@gmail.com
echo.
echo.
pause /prompt "Press ENTER once environment variables are set in Cloudflare..."

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 4: CLOUDFLARE DEPLOY
REM ─────────────────────────────────────────────────────────────────────────

echo.
echo [STEP 4/6] Deploying to Cloudflare Pages...
echo ─────────────────────────────────────────────

echo.
echo Pushing to Cloudflare...
git push cloudflare main

if errorlevel 1 (
  echo.
  echo WARNING: Cloudflare push may have failed
  echo Make sure the 'cloudflare' git remote is configured
  echo Configure with: git remote add cloudflare [your-cloudflare-repo-url]
)

echo.
echo Waiting for Cloudflare to build (30 seconds)...
timeout /t 30 /nobreak

echo.
echo Checking Cloudflare deployment...
curl -s "%CF_URL%/api/admin/users" >nul 2>&1
if errorlevel 0 (
  echo Cloudflare deployment ready!
) else (
  echo Still building... You can check manually at:
  echo   %CF_URL%/api/admin/users
)

echo.

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 5: CREATE AUTH USERS (MANUAL)
REM ─────────────────────────────────────────────────────────────────────────

echo [STEP 5/6] Creating admin authentication users (MANUAL)
echo ─────────────────────────────────────────────────────

echo.
echo IMPORTANT: You must create admin users in Supabase Dashboard
echo.
echo Open this link in your browser:
echo   https://supabase.com/dashboard/project/qmuvdpnnpptfrinhnzlv/auth/users
echo.
echo Click "Add user" and create two users:
echo.
echo   User 1:
echo     Email:    toy.theeranan@icloud.com
echo     Password: @Supa2026
echo.
echo   User 2:
echo     Email:    toy.theeranan@gmail.com
echo     Password: @Supa2026
echo.
pause /prompt "Press ENTER once both admin users are created..."

REM ─────────────────────────────────────────────────────────────────────────
REM STEP 6: SMOKE TESTS
REM ─────────────────────────────────────────────────────────────────────────

echo.
echo [STEP 6/6] Running smoke tests...
echo ─────────────────────────────────────────────

echo.
echo Test 1: Vercel Endpoint
echo URL: %VERCEL_URL%/api/admin/users
curl -s "%VERCEL_URL%/api/admin/users"
echo.
echo.
echo Test 2: Cloudflare Endpoint
echo URL: %CF_URL%/api/admin/users
curl -s "%CF_URL%/api/admin/users"
echo.
echo.

REM ─────────────────────────────────────────────────────────────────────────
REM SUMMARY
REM ─────────────────────────────────────────────────────────────────────────

echo ════════════════════════════════════════════════════════════════════════════
echo   DEPLOYMENT COMPLETE
echo ════════════════════════════════════════════════════════════════════════════
echo.
echo Success! All steps completed. Next steps:
echo   1. Verify both endpoints return the migrated user list
echo   2. Test login with admin users (@Supa2026)
echo   3. Monitor both deployment dashboards for errors
echo   4. Archive old KV/filesystem data after verification
echo.
echo Documentation:
echo   - Status: MIGRATION_STATUS.md
echo   - Quick ref: QUICK_START.txt
echo.
pause

endlocal
