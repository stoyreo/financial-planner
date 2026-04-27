@echo off
cd /d "C:\Users\USER\Documents\Claude\Projects\Financial 101 tOy\financial-planner"

echo === Financial 101 Master crafted by Toy - Rebranding Commit ===
echo.

REM Remove stale git lock if it exists
if exist .git\index.lock (
  echo Removing stale git lock...
  del /f /q .git\index.lock
)

REM Reset any prior staged changes
echo Resetting prior staged changes...
git reset HEAD

echo.
echo Staging rebranding changes...
git add src/app/layout.tsx
git add src/app/login/page.tsx
git add src/components/layout/AppShell.tsx
git add src/components/layout/VersionPanel.tsx
git add src/lib/accounts.ts
git add src/lib/email-templates.ts
git add archive/

echo.
echo Current status:
git status

echo.
echo Committing rebranding changes...
git commit -m "feat(brand): rebrand to Financial 101 Master crafted by Toy + new monogram logo" -m "- Add Logo component (gold F+101 monogram on navy) at src/components/brand/Logo.tsx" -m "- Add app icon + apple-icon SVGs auto-resolved by Next 14" -m "- Replace inline ฿ logo on login screen, sidebar, mobile header" -m "- Rename brand strings (incl. email templates) to full 'Financial 101 Master crafted by Toy'" -m "- Update fallback deploy URL from financeplan-th.pages.dev to Vercel" -m "- Archive Cloudflare-only deploy scripts (Vercel is now sole deploy target)"

echo.
echo Pushing to main...
git push origin main

echo.
echo === Done! Vercel will auto-deploy in ~30 seconds ===
echo.
echo Next steps:
echo   1. Wait 90 seconds for Vercel to finish
echo   2. Run: node check-deployment.js
echo   3. Run: npm run send-deployment-email
echo.
pause
