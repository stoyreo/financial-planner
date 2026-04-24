@echo off
REM Clean up corrupted .git folder
echo Removing corrupted .git folder...
rmdir /s /q .git

REM Initialize git
echo.
echo Initializing git repository...
git init

REM Configure user
echo Configuring git user...
git config user.email "techcraftlab.bkk@gmail.com"
git config user.name "TechCraftLab"

REM Add remote
echo Adding GitHub remote...
git remote add origin https://github.com/stoyreo/financial-planner.git

REM Set main branch
echo Setting main branch...
git branch -M main

REM Add all files
echo Adding files to git...
git add .

REM Commit
echo Committing code...
git commit -m "Initial commit: Track B Supabase migration with unified backend"

REM Push to GitHub
echo.
echo Pushing to GitHub (this may take a moment)...
git push -u origin main

echo.
echo ================================================
echo Git setup complete!
echo.
echo Next step: Run run-migration.bat
echo ================================================
pause
