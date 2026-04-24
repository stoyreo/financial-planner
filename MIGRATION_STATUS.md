# Track B Supabase Migration - Status Report

**Date**: April 24, 2026  
**Status**: Code Implementation Complete ✓ | Deployment In Progress

---

## ✓ COMPLETED WORK

### Code Implementation (100% Complete)
All code files have been created and are ready for deployment:

#### Vercel (Next.js) Routes
- **src/lib/supabase/admin.ts** (NEW - 70 lines)
  - Server-only Supabase admin client using service_role key
  - Helper functions: getSupabaseAdmin(), rowToAppUser(), appUserToRow()

- **src/app/api/admin/users/route.ts** (REPLACED - 189 lines)
  - GET: Returns all users from app_users table
  - POST: Bulk replace or add single user with duplicate checking
  - PATCH: Update user properties with last-admin safety guard
  - DELETE: Remove non-admin users with cascade cleanup

- **src/app/api/sync/route.ts** (REPLACED - 76 lines)
  - POST: Upsert per-user data blobs to user_data table
  - GET: Retrieve user data by storageKey

#### Cloudflare Pages Functions
- **functions/api/admin/users.ts** (REPLACED - 298 lines)
  - Cloudflare Pages Function using PostgREST API
  - Same contract as Next.js version, raw fetch (no SDK bundling issues)

- **functions/api/sync.ts** (REPLACED - 114 lines)
  - Cloudflare Pages Function for per-user data
  - POST for upsert, GET for retrieval

#### Migration Tooling
- **scripts/migrate-kv-to-supabase.mjs** (NEW - 98 lines)
  - One-time migration script
  - Reads KV data from live Cloudflare endpoint
  - Upserts to Supabase via service-role PostgREST
  - Idempotent (safe to run multiple times)

#### Configuration
- **vercel.json** - Cleaned up (removed committed secrets)
- **.gitignore** - Updated (added .env.local)

### Environment Configuration (Partial - Vercel Complete)
- ✓ **Vercel**: SUPABASE_SERVICE_ROLE_KEY set for Production and Preview
- ✓ **Vercel**: NEXT_PUBLIC_SUPABASE_URL (existing)
- ✓ **Vercel**: NEXT_PUBLIC_SUPABASE_ANON_KEY (existing)
- ✓ **Vercel**: NEXT_PUBLIC_ALLOWED_EMAILS (existing)
- ⏳ **Cloudflare**: Pending (needs same 4 variables)

### Supabase Database (Complete)
- ✓ Schema created with app_users and user_data tables
- ✓ Row-level security (RLS) policies configured
- ✓ PostgREST API enabled

---

## ⏳ REMAINING WORK

### 1. Deploy Code to Vercel (5 min)
```bash
cd financial-planner
git add .
git commit -m "Track B: Unified Supabase backend"
git push origin main
```
**Expected**: Vercel auto-builds and deploys within 2-3 minutes  
**Verify at**: https://vercel.com/tccollectibles/financial-planner/deployments

### 2. Run Migration Script (10 min)
```bash
CF_BASE_URL=https://financeplan-th.pages.dev \
SUPABASE_URL=https://qmuvdpnnpptfrinhnzlv.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<REDACTED-see-.env.local> \
node scripts/migrate-kv-to-supabase.mjs
```
**Expected**: Migrates all KV data (users + per-user data blobs)  
**Output**: Shows count of migrated users and data records

### 3. Configure Cloudflare Pages Environment Variables (3 min)
Dashboard: https://dash.cloudflare.com/  
→ Workers & Pages → financial-planner → Settings → Environment Variables

**Production AND Preview:**
```
NEXT_PUBLIC_SUPABASE_URL = https://qmuvdpnnpptfrinhnzlv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdXZkcG5ucHB0ZnJpbmhuemx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzA0MDAsImV4cCI6MTg0MjkwNjQwMH0.4rR3EBKwKZNKDfXw2cWL7LJVDPHSxj0MnB7hP1qEYYY
SUPABASE_SERVICE_ROLE_KEY = <REDACTED-see-.env.local>
NEXT_PUBLIC_ALLOWED_EMAILS = toy.theeranan@icloud.com,toy.theeranan@gmail.com
```

### 4. Deploy to Cloudflare (2 min)
From project root:
```bash
git push cloudflare main
```
**Expected**: Cloudflare auto-builds and deploys functions  
**Verify at**: https://financeplan-th.pages.dev/api/admin/users (should return user list)

### 5. Create Admin Auth Users (3 min)
Supabase Console → Authentication → Users  
https://supabase.com/dashboard/project/qmuvdpnnpptfrinhnzlv/auth/users

**Create two users:**
- Email: toy.theeranan@icloud.com | Password: @Supa2026
- Email: toy.theeranan@gmail.com | Password: @Supa2026

### 6. Run Smoke Tests (5 min)
```bash
# Vercel endpoint
curl -X GET 'https://financial101vercel.app/api/admin/users' | jq

# Cloudflare endpoint  
curl -X GET 'https://financeplan-th.pages.dev/api/admin/users' | jq
```
**Expected**: Both return identical user list from Supabase

---

## Technical Architecture

### Before (Split Registry)
```
┌─ Vercel (Development)        ┌─ Cloudflare (Production)
│  └─ app_users.json (FS)      │  └─ app_users (KV)
│  └─ user_data/*.json (FS)    │  └─ user_data/* (KV)
└─ Different data per env      └─ Different data per env
```

### After (Unified Supabase)
```
┌─ Vercel          ┌─ Cloudflare      ┌─ Supabase (Source of Truth)
│  Next.js API     │  Pages Func       │  ├─ app_users (table)
│  PostgREST       │  PostgREST        │  └─ user_data (table)
│  Service Role    │  Service Role     │  └─ RLS policies
└─ Identical       └─ Identical        └─ Single source
```

### Key Design Decisions
1. **No SDK in Cloudflare**: Raw `fetch` to PostgREST avoids bundle size issues
2. **Service-role keys only**: Admin operations require elevated permissions
3. **Idempotent migration**: Script uses upsert, safe to re-run
4. **RLS policies**: Data isolation at database layer for multi-tenant safety

---

## API Contracts (Unchanged)

Both Vercel and Cloudflare endpoints maintain the same request/response format:

### GET /api/admin/users
```json
{
  "users": [
    {
      "id": "user-123",
      "username": "john",
      "email": "john@example.com",
      "displayName": "John Doe",
      "role": "admin",
      "dataMode": "own",
      "isActive": true
    }
  ]
}
```

### GET /api/sync?storageKey=key-123
```json
{
  "ok": true,
  "data": { /* user's data blob */ }
}
```

---

## Timeline

| Step | Duration | Status |
|------|----------|--------|
| Code Implementation | ✓ Done | Complete |
| Vercel Deploy | 5 min | Pending |
| Migration Run | 10 min | Pending |
| Cloudflare Config | 3 min | Pending |
| Cloudflare Deploy | 2 min | Pending |
| Create Auth Users | 3 min | Pending |
| Smoke Tests | 5 min | Pending |
| **Total Remaining** | **~30 min** | |

---

## Key Environment Values

**Supabase**:
- Project URL: https://qmuvdpnnpptfrinhnzlv.supabase.co
- Anon Key: `eyJhbGci...EYIY` (JWT format, public)
- Service Role Key: `<REDACTED-see-.env.local>` (secret, server-only)

**Cloudflare**:
- Production Domain: https://financeplan-th.pages.dev
- API Endpoints: `/api/admin/users`, `/api/sync`

**Vercel**:
- Production Domain: https://financial101vercel.app
- API Routes: `src/app/api/admin/users/route.ts`, `src/app/api/sync/route.ts`

---

## Troubleshooting

### If Vercel deployment fails:
1. Check for syntax errors: `npm run build`
2. Verify environment variables are set in Vercel dashboard
3. Check logs: https://vercel.com/tccollectibles/financial-planner/deployments

### If migration script fails:
1. Verify Cloudflare endpoint is still KV-backed: `curl https://financeplan-th.pages.dev/api/admin/users`
2. Verify Supabase credentials are correct
3. Check RLS policies aren't blocking inserts

### If Cloudflare deploy fails:
1. Verify environment variables are set in Pages settings
2. Check for TypeScript errors: `npm run build:functions`
3. Verify git branch is pushed correctly

---

## Next Steps After Deployment

1. **Monitoring**: Check logs for errors in first 24 hours
2. **Backup**: Export Supabase data regularly
3. **Cleanup**: Remove old KV and filesystem data after verification
4. **Documentation**: Update team docs to point to Supabase
5. **Deprecation**: Plan sunset of Cloudflare KV and Vercel filesystem storage

---

**Created**: April 24, 2026  
**Reference**: Track B Supabase Migration Handoff
