# Comprehensive Deployment Verification Script
# Run this to diagnose the rebranding deployment

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Financial 101 Master - Deployment Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check git commit
Write-Host "[1/6] Checking git commit..." -ForegroundColor Yellow
Write-Host ""
git log --oneline -3
Write-Host ""

# 2. Verify specific files changed
Write-Host "[2/6] Verifying files in latest commit..." -ForegroundColor Yellow
Write-Host ""
git show --name-only --pretty=format:"%h %s" -1
Write-Host ""

# 3. Check for Logo component
Write-Host "[3/6] Checking Logo component exists..." -ForegroundColor Yellow
if (Test-Path "src/components/brand/Logo.tsx") {
    Write-Host "✅ Logo.tsx found" -ForegroundColor Green
    $logoContent = Get-Content "src/components/brand/Logo.tsx" -Raw
    if ($logoContent -match "Financial 101 Master crafted by Toy") {
        Write-Host "✅ Logo has correct branding text" -ForegroundColor Green
    } else {
        Write-Host "❌ Logo missing branding text" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Logo.tsx not found" -ForegroundColor Red
}
Write-Host ""

# 4. Check login page
Write-Host "[4/6] Checking login page changes..." -ForegroundColor Yellow
$loginContent = Get-Content "src/app/login/page.tsx" -Raw
if ($loginContent -match "Financial 101 Master crafted by Toy") {
    Write-Host "✅ Login page has correct branding" -ForegroundColor Green
} else {
    Write-Host "❌ Login page still has old branding" -ForegroundColor Red
}
if ($loginContent -match 'import.*Logo.*from.*@/components/brand/Logo') {
    Write-Host "✅ Login page imports Logo component" -ForegroundColor Green
} else {
    Write-Host "❌ Login page missing Logo import" -ForegroundColor Red
}
Write-Host ""

# 5. Check email templates
Write-Host "[5/6] Checking email templates..." -ForegroundColor Yellow
$emailContent = Get-Content "src/lib/email-templates.ts" -Raw
if ($emailContent -match "Financial 101 Master crafted by Toy") {
    Write-Host "✅ Email templates have correct branding" -ForegroundColor Green
} else {
    Write-Host "❌ Email templates have old branding" -ForegroundColor Red
}
if ($emailContent -match "financial-planner.vercel.app") {
    Write-Host "✅ Email templates have Vercel URL" -ForegroundColor Green
} else {
    Write-Host "❌ Email templates missing Vercel URL" -ForegroundColor Red
}
Write-Host ""

# 6. Check deployment status
Write-Host "[6/6] Checking Vercel deployment status..." -ForegroundColor Yellow
Write-Host ""
node check-deployment.js
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Verification Complete" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If all checks pass but the site still shows old branding:" -ForegroundColor Yellow
Write-Host "1. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)" -ForegroundColor White
Write-Host "2. Clear browser cache and cookies" -ForegroundColor White
Write-Host "3. Visit the Vercel URL directly (from check-deployment.js output)" -ForegroundColor White
Write-Host "4. Wait 5 minutes and try again" -ForegroundColor White
Write-Host ""
pause
