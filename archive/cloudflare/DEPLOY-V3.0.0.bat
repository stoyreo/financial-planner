@echo off
REM ============================================
REM Financial 101 Master v3.0.0 Deployment
REM ============================================
setlocal enabledelayedexpansion

echo.
echo ============================================
echo  FINANCIAL 101 v3.0.0 DEPLOYMENT
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
echo [1/3] Building application...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo BUILD FAILED - Check errors above
    pause
    exit /b 1
)

echo.
echo [2/3] Build successful!
echo.
echo [3/3] Deploy to Cloudflare? (Y/N)
set /p DEPLOY="Enter choice: "

if /i "%DEPLOY%"=="Y" (
    echo.
    echo Deploying to Cloudflare Pages and Workers...
    call npm run deploy
    if %errorlevel% neq 0 (
        echo.
        echo DEPLOY FAILED - Check errors above
        pause
        exit /b 1
    )
    echo.
    echo ============================================
    echo  ✓ DEPLOYMENT SUCCESSFUL
    echo ============================================
    echo.
    echo Live at: https://financeplan-th.pages.dev
    echo.

    REM Send deployment notification emails
    echo.
    echo [Bonus] Sending deployment notification emails...
    call node scripts/send-deployment-email.js
    if %errorlevel% equ 0 (
        echo ✓ Notification emails sent
    ) else (
        echo ⚠ Some notification emails failed (but deployment succeeded)
    )
    echo.
) else (
    echo Deployment cancelled.
)

pause
