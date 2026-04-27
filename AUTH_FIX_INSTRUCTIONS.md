# Auth Bug Fix - Final Steps

## What Was Done ✅

All 6 files have been updated with Supabase Auth integration:

1. **`src/lib/supabase/admin.ts`** — Added `auth_user_id` column support
2. **`src/app/api/admin/users/route.ts`** — Syncs user creation & password resets to Supabase Auth
3. **`functions/api/admin/users.ts`** — Cloudflare Pages equivalent with GoTrue REST API
4. **`src/lib/users.ts`** — Returns plaintext password from `addUser()` for server handoff
5. **`src/app/admin/users/page.tsx`** — Updated UI to call new server endpoints
6. **`src/lib/auth.ts`** — Deprecated client-side `changePassword()` with error throw

## Final Steps (3 minutes)

### 1. Run SQL on Supabase (1 minute)

1. Go to https://supabase.com/dashboard/
2. Select the **Financial 101** project (https://qmuvdpnnpptfrinhnzlv.supabase.co)
3. Click **SQL Editor** → **New Query**
4. Paste the contents of `AUTH_FIX.sql` and click **Run**
5. Verify output shows `auth_user_id | uuid | NO`

### 2. Commit and Push (1 minute)

Open PowerShell/Command Prompt in the `financial-planner` folder and run:

```bash
COMPLETE_AUTH_FIX.bat
```

This will:
- Stage all 6 modified files
- Commit with a detailed message
- Push to `origin/main`

### 3. Verify Build Passes (1 minute local, ~2 min on CI)

```bash
npm run build
```

### 4. Wait for Deploy (~2 minutes)

Deploy to Cloudflare Pages will happen automatically. Check:
- https://financeplan-th (or your Pages project URL)

### 5. Smoke Test (2 minutes)

#### Test 1: Password Reset
1. Go to `/admin/users`
2. Click 🔑 icon next to any non-toy user
3. Set password: `Smoke2026!`
4. Toast should say: **"✓ Password reset for X (Supabase Auth updated)"**
5. Sign out → `/login` → sign in with email + `Smoke2026!` → should land on `/`

#### Test 2: Add User
1. `/admin/users` → Click **"Add User"**
2. Fill: 
   - Username: `smoke`
   - Email: `smoke@example.com`
   - Name: `Smoke Test`
   - Role: `member`
   - Password: `Smoke2026!`
3. Toast should say: **"✓ Added smoke@example.com (Supabase Auth + registry synced)"**
4. Sign out → `/login` → sign in as `smoke@example.com` / `Smoke2026!` → should land on `/`

#### Test 3: Verify in Supabase
1. Go to Supabase dashboard → **Authentication** → **Users**
2. Confirm `smoke@example.com` exists with today's date

✅ **All tests pass** = Bug is fixed!

---

## What Changed (Summary)

| Operation | Before | After |
|-----------|--------|-------|
| **Add User** | Hashed password client-side, synced only to `app_users` | Creates `auth.users` row first via `supabase.auth.admin.createUser()` |
| **Password Reset** | Hashed password client-side, wrote to `app_users` | Calls `supabase.auth.admin.updateUserById()` directly |
| **Login** | `signInWithPassword` checked `app_users.passwordHash` (wrong!) | `signInWithPassword` checks `auth.users` (correct!) |
| **User Deletion** | Only deleted from `app_users` | Deletes from both `auth.users` and `app_users` |

---

## Files to Run

- **`COMPLETE_AUTH_FIX.bat`** — Git operations (stage, commit, push)
- **`AUTH_FIX.sql`** — Supabase schema migration

## Need Help?

- **SQL fails:** Check that `SUPABASE_SERVICE_ROLE_KEY` is set in your Cloudflare/Vercel env
- **Build fails:** Run `npm install` first
- **Tests fail:** Check browser console for network errors on `/api/admin/users` endpoints
- **Deploy stuck:** Verify no active deployments in Cloudflare Pages dashboard
