@echo off
REM ============================================
REM Financial 101 Deployment Diagnostic
REM ============================================
echo.
echo [DEBUG] Starting deployment diagnostic...
echo.

REM Check npm
echo [1/5] Checking npm installation...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ npm found
echo.

REM Check build
echo [2/5] Running npm run build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    echo Exit code: %errorlevel%
    pause
    exit /b 1
)
echo ✓ Build successful
echo.

REM Check vercel cli
echo [3/5] Checking Vercel CLI...
vercel --version
if %errorlevel% neq 0 (
    echo WARNING: Vercel CLI not found. Installing...
    call npm install -g vercel
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Vercel CLI
        pause
        exit /b 1
    )
)
echo ✓ Vercel CLI ready
echo.

REM Show deployment options
echo [4/5] Deployment options:
echo.
echo 1) Deploy to Vercel (Production)
echo 2) Cancel
echo.
set /p CHOICE="Select option (1-2): "

if "%CHOICE%"=="1" (
    echo.
    echo [5/5] Deploying to Vercel...
    echo.
    call vercel --prod --yes
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Deployment failed!
        pause
        exit /b 1
    )
    echo.
    echo ✓ Deployment successful!
    echo Check your Vercel dashboard for the live URL
    echo.
    echo Sending notification emails...
    call node scripts/send-deployment-email.js
    pause
) else if "%CHOICE%"=="2" (
    echo Deployment cancelled.
    pause
) else (
    echo Invalid option.
    pause
)

exit /b 0
