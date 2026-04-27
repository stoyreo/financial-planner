@echo off
REM Complete automation script for Supabase Auth fix
REM Run this from the financial-planner directory

echo.
echo ========================================
echo Auth Bug Fix - Automation Script
echo ========================================
echo.

REM Step 1: Configure git
echo [1/5] Configuring git...
git config user.email "toy.theeranan@gmail.com"
git config user.name "Toy Theeranan"

REM Step 2: Clean up any lock files
echo [2/5] Cleaning git state...
if exist .git\index.lock del .git\index.lock
git reset --hard HEAD

REM Step 3: Stage the auth fix files
echo [3/5] Staging files...
git add src/lib/supabase/admin.ts
git add src/app/api/admin/users/route.ts
git add functions/api/admin/users.ts
git add src/lib/users.ts
git add src/app/admin/users/page.tsx
git add src/lib/auth.ts

REM Step 4: Commit
echo [4/5] Committing changes...
git commit -m "fix(admin): admin password reset + add user now sync to Supabase Auth

The admin UI used to compute sha256 client-side and only write the hash
into localStorage and the public.app_users mirror table. supabase.auth's
auth.users (which signInWithPassword checks) was never touched, so password
changes and new accounts could not log in.

- POST /api/admin/users now requires a plaintext password and calls
  supabase.auth.admin.createUser() before mirroring into app_users.
- PATCH /api/admin/users { id, newPassword } now calls
  supabase.auth.admin.updateUserById().
- DELETE also tears down the auth.users row.
- Added auth_user_id link column on public.app_users.
- Removed sha256 hashing from the admin path; deprecated changePassword()
  surfaces an error instead of silently writing to localStorage."

REM Step 5: Push
echo [5/5] Pushing to origin/main...
git push origin main

echo.
echo ========================================
echo Build locally next
echo ========================================
echo.
echo Run this next:
echo   npm run build
echo.
echo Then test the endpoints after ~2 min deploy
echo ========================================
pause
