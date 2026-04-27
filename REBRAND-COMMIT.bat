@echo off
cd /d "C:\Users\USER\Documents\Claude\Projects\Financial 101 tOy\financial-planner"

echo === Financial 101 Master crafted by Toy - Rebranding Commit ===
echo.
echo Staging changes...
git add src/
git add archive/

echo.
echo Checking status...
git status

echo.
echo Committing...
git commit -m "feat(brand): rebrand to Financial 101 Master crafted by Toy + new monogram logo

- Add Logo component (gold F+101 monogram on navy) at src/components/brand/Logo.tsx
- Add app icon + apple-icon SVGs auto-resolved by Next 14
- Replace inline ฿ logo on login screen, sidebar, mobile header
- Rename brand strings (incl. email templates) to full 'Financial 101 Master crafted by Toy'
- Update fallback deploy URL from financeplan-th.pages.dev to Vercel
- Archive Cloudflare-only deploy scripts (Vercel is now sole deploy target)"

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
pause
