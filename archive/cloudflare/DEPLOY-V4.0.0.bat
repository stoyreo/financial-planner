@echo off
REM ============================================
REM Financial 101 Master v4.0.0 Deployment
REM ============================================
REM Build on top of V3 with multi-platform support
REM ============================================
setlocal enabledelayedexpansion

echo.
echo ============================================
echo  FINANCIAL 101 v4.0.0 DEPLOYMENT
echo ============================================
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Step 1: Build
echo [1/4] Building application...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo BUILD FAILED - Check errors above
    pause
    exit /b 1
)

echo.
echo [2/4] Build successful!
echo.

REM Step 2: Display Deployment Menu
:MENU
echo ============================================
echo  DEPLOYMENT OPTIONS
echo ============================================
echo.
echo 1) Deploy to Cloudflare Pages
echo 2) Deploy to Both (Cloudflare + Vercel)
echo 3) Deploy to Vercel (Production)
echo 4) Cancel
echo.
set /p DEPLOY_OPTION="Select deployment option (1-4): "

if "%DEPLOY_OPTION%"=="1" (
    call :DEPLOY_CLOUDFLARE
) else if "%DEPLOY_OPTION%"=="2" (
    call :DEPLOY_CLOUDFLARE
    call :DEPLOY_VERCEL
) else if "%DEPLOY_OPTION%"=="3" (
    call :DEPLOY_VERCEL
) else if "%DEPLOY_OPTION%"=="4" (
    echo.
    echo Deployment cancelled.
    pause
    exit /b 0
) else (
    echo.
    echo Invalid option. Please select 1-4.
    echo.
    goto MENU
)

echo.
echo ============================================
echo  ✓ DEPLOYMENT COMPLETE
echo ============================================
echo.
pause
exit /b 0

REM ============================================
REM Subroutine: Deploy to Cloudflare Pages
REM ============================================
:DEPLOY_CLOUDFLARE
echo.
echo [3/4] Deploying to Cloudflare Pages...
call npm run deploy
if %errorlevel% neq 0 (
    echo.
    echo CLOUDFLARE DEPLOY FAILED - Check errors above
    pause
    exit /b 1
)

echo.
echo ✓ Cloudflare deployment successful!
echo Live at: https://financeplan-th.pages.dev
echo.

REM Send deployment notification emails for Cloudflare
echo [Bonus] Sending deployment notification emails...
call node scripts/send-deployment-email.js
if %errorlevel% equ 0 (
    echo ✓ Notification emails sent
) else (
    echo ⚠ Some notification emails failed (but deployment succeeded)
)
echo.
goto :EOF

REM ============================================
REM Subroutine: Deploy to Vercel
REM ============================================
:DEPLOY_VERCEL
echo.
echo [3/4] Deploying to Vercel (Production)...

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Vercel CLI is not installed. Installing now...
    call npm install -g vercel
    if %errorlevel% neq 0 (
        echo.
        echo FAILED to install Vercel CLI
        pause
        exit /b 1
    )
)

REM Deploy to Vercel Production
call vercel --prod --yes
if %errorlevel% neq 0 (
    echo.
    echo VERCEL DEPLOY FAILED - Check errors above
    pause
    exit /b 1
)

echo.
echo ✓ Vercel deployment successful!
echo Check your Vercel dashboard for live URL
echo.

REM Send deployment notification for Vercel
echo [Bonus] Sending deployment notification emails...
call node scripts/send-deployment-email.js
if %errorlevel% equ 0 (
    echo ✓ Notification emails sent
) else (
    echo ⚠ Some notification emails failed (but deployment succeeded)
)
echo.
goto :EOF
