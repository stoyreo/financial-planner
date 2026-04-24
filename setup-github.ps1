# PowerShell script to set up GitHub repository
cd "C:\Users\USER\Documents\Claude\Projects\Financial 101 tOy\financial-planner"

Write-Host "Removing corrupted .git folder..." -ForegroundColor Yellow
Remove-Item -Path .\.git -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Initializing git repository..." -ForegroundColor Yellow
git init

Write-Host "Configuring git user..." -ForegroundColor Yellow
git config user.email "techcraftlab.bkk@gmail.com"
git config user.name "TechCraftLab"

Write-Host "Adding GitHub remote..." -ForegroundColor Yellow
git remote add origin https://github.com/stoyreo/financial-planner.git

Write-Host "Setting main branch..." -ForegroundColor Yellow
git branch -M main

Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .

Write-Host "Committing code..." -ForegroundColor Yellow
git commit -m "Initial commit: Track B Supabase migration with unified backend"

Write-Host "Pushing to GitHub (this may take a moment)..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Git setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Run run-migration.bat" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to exit"
