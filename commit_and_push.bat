@echo off
setlocal

cd /d "C:\Users\USER\Documents\Claude\Projects\Financial 101 tOy\financial-planner"

echo Cleaning up lock files...
del /f /q .git\index.lock 2>nul

echo Waiting for git to be ready...
timeout /t 2 /nobreak

echo Adding files...
git add package.json src/app/api/statements/import/route.ts

echo Committing...
git commit -m "feat: replace Claude API with local PDF parsing in statement import"

echo Pushing to GitHub...
git push origin main

echo Done!
pause
