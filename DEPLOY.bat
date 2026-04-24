@echo off
REM ============================================
REM Financial 101 Master — One-Step Deploy & Notify
REM --------------------------------------------
REM   Builds, deploys to Cloudflare Pages, captures the per-deploy URL,
REM   and automatically emails toy.theeranan@icloud.com and
REM   Patipat.arc@gmail.com with the deploy URL.
REM
REM Requires in .env.local:
REM   GMAIL_USER      = toy.theeranan@gmail.com
REM   GMAIL_APP_PASS  = xxxx xxxx xxxx xxxx   (16-char Google App Password)
REM   -- OR --
REM   RESEND_API_KEY  = re_xxxxxxxx           (fallback)
REM ============================================
echo.
echo ============================================
echo  FINANCIAL 101 — DEPLOY AND NOTIFY
echo ============================================
echo.

REM Fail fast if npm missing
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

call npm run deploy:notify
set EXITCODE=%errorlevel%

echo.
if %EXITCODE% equ 0 (
    echo ============================================
    echo  DONE — emails dispatched
    echo ============================================
) else (
    echo ============================================
    echo  DEPLOYMENT OR NOTIFICATION ISSUE
    echo  Check the output above for details.
    echo ============================================
)

pause
exit /b %EXITCODE%
