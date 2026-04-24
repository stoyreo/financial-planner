# Track B Handoff — Unify User Registry on Supabase

**Target executor:** Haiku (or any coding agent)
**Repo:** `financial-planner/`
**Goal:** Make Vercel deploys show the same accounts as Cloudflare and fix the `toy.theeranan@icloud.com` login by moving the user registry + per-user data out of filesystem / KV and into Supabase (single source of truth for both deploys).

---

## Why this is needed (background for the executor)

Today the app has two parallel implementations of `/api/admin/users` and `/api/sync`:

- **Cloudflare Pages** serves `functions/api/admin/users.ts` + `functions/api/sync.ts` → backed by Cloudflare KV (durable).
- **Vercel** serves `src/app/api/admin/users/route.ts` + `src/app/api/sync/route.ts` → backed by `writeFile()` to `data/*.json` (ephemeral on Vercel serverless — wiped between invocations, so only the seeded admin ever appears).

Track B rewrites **both** sides to talk to a single Supabase project. After execution, Vercel and Cloudflare render identical account lists and per-user data.

Login is already Supabase-based (`signInWithPassword`). The admin password failure on Vercel is an env-var + Supabase-user-setup issue, handled in Toy's manual steps below — not code.

---

## Scope boundary

**Haiku executes:**
- All code changes listed in §3 (file by file, copy-paste ready).
- Create the one-time migration script in §4.
- Run the verification commands in §6.

**Toy executes manually** (tag these as blockers for Haiku until done):
- Supabase SQL in §1.
- Env vars in §2.
- Running the migration script (§4).
- Setting the admin password in Supabase Auth (§5).
- Rotating leaked keys (§7).

Haiku should STOP and wait for Toy between phases when marked with 🛑.

---

## §1. Supabase schema (Toy runs in Supabase SQL Editor) 🛑

Open the Supabase dashboard → SQL Editor → New query → paste and run:

```sql
-- ─── app_users ───────────────────────────────────────
create table if not exists public.app_users (
  id             text primary key,
  username       text not null unique,
  email          text not null unique,
  display_name   text not null,
  password_hash  text not null default '',
  role           text not null check (role in ('admin','member','demo')),
  data_mode      text not null default 'own' check (data_mode in ('real','own','demo')),
  storage_key    text not null,
  created_at     timestamptz not null default now(),
  last_login     timestamptz,
  is_active      boolean not null default true
);

create index if not exists app_users_email_lower_idx on public.app_users (lower(email));
create index if not exists app_users_username_lower_idx on public.app_users (lower(username));

-- ─── user_data ───────────────────────────────────────
create table if not exists public.user_data (
  storage_key  text primary key,
  data         jsonb not null,
  updated_at   timestamptz not null default now()
);

-- ─── RLS: deny-all by default. Only service_role bypasses RLS. ──
alter table public.app_users enable row level security;
alter table public.user_data enable row level security;

-- ─── Seed the admin row if missing ──
insert into public.app_users
  (id, username, email, display_name, password_hash, role, data_mode, storage_key, is_active, created_at)
values
  ('user_toy','toy','toy.theeranan@icloud.com','Toy Theeranan','','admin','real','fp_data_toy', true, '2025-04-14T00:00:00Z')
on conflict (id) do nothing;
```

After running, **confirm with**:

```sql
select count(*) from public.app_users;   -- should be >= 1
select count(*) from public.user_data;   -- should be 0 before migration
```

---

## §2. Environment variables (Toy sets in dashboards) 🛑

Collect these once:

- `SUPABASE_URL` — Supabase → Settings → API → Project URL (e.g. `https://abcd.supabase.co`)
- `SUPABASE_ANON_KEY` — Supabase → Settings → API → `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → `service_role` secret key (**never commit this, never expose it to the browser**)

### Set on Vercel (Dashboard → Project → Settings → Environment Variables)

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview |
| `NEXT_PUBLIC_ALLOWED_EMAILS` | `toy.theeranan@gmail.com,toy.theeranan@icloud.com` | Production, Preview, Development |

### Set on Cloudflare (Dashboard → Pages → financeplan-th → Settings → Environment variables)

Add the same four keys. Cloudflare splits "Production" and "Preview" — set both.

| Key | Value |
|---|---|
| `SUPABASE_URL` | `SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` (mark as encrypted/secret) |
| `NEXT_PUBLIC_ALLOWED_EMAILS` | `toy.theeranan@gmail.com,toy.theeranan@icloud.com` |

### Local dev

Create (or append to) `financial-planner/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
NEXT_PUBLIC_ALLOWED_EMAILS=toy.theeranan@gmail.com,toy.theeranan@icloud.com
```

Ensure `.env.local` is in `.gitignore` (it already is by Next.js convention; Haiku should `grep -q ".env.local" .gitignore` and add the line if missing).

---

## §3. Code changes — Haiku executes these in order

### 3.1 New file — `src/lib/supabase/admin.ts`

Server-only service-role client plus row ↔ AppUser mappers.

**Create** `financial-planner/src/lib/supabase/admin.ts`:

```typescript
/**
 * Server-only Supabase admin client (service_role).
 * NEVER import this from a "use client" file.
 *
 * Used by:
 *   - src/app/api/admin/users/route.ts
 *   - src/app/api/sync/route.ts
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── Row ↔ AppUser mapping (snake_case <-> camelCase) ───────────
export type AppUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: "admin" | "member" | "demo";
  data_mode: "real" | "own" | "demo";
  storage_key: string;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
};

export function rowToAppUser(r: AppUserRow) {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    displayName: r.display_name,
    passwordHash: r.password_hash ?? "",
    role: r.role,
    dataMode: r.data_mode,
    storageKey: r.storage_key,
    createdAt: r.created_at,
    lastLogin: r.last_login ?? undefined,
    isActive: r.is_active,
    // legacy field name kept for older clients
    created_at: r.created_at,
  };
}

export function appUserToRow(u: any): AppUserRow {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email).toLowerCase(),
    display_name: String(u.displayName ?? u.display_name ?? u.username),
    password_hash: u.passwordHash ?? u.password_hash ?? "",
    role: u.role,
    data_mode: u.dataMode ?? u.data_mode ?? "own",
    storage_key: u.storageKey ?? u.storage_key,
    created_at: u.createdAt ?? u.created_at ?? new Date().toISOString(),
    last_login: u.lastLogin ?? u.last_login ?? null,
    is_active: u.isActive !== false,
  };
}
```

### 3.2 Replace — `src/app/api/admin/users/route.ts`

**Overwrite** the entire file with:

```typescript
/**
 * /api/admin/users — Supabase-backed user registry.
 * Replaces the previous filesystem-based implementation so Vercel
 * and Cloudflare read from the same durable store.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, appUserToRow, rowToAppUser, AppUserRow } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[GET /api/admin/users]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ users: (data ?? []).map((r: AppUserRow) => rowToAppUser(r)) });
  } catch (err: any) {
    console.error("[GET /api/admin/users]", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getSupabaseAdmin();

    // Bulk replace
    if (Array.isArray(body?.users)) {
      const users = body.users as any[];
      if (!users.some((u) => u.role === "admin")) {
        return NextResponse.json(
          { ok: false, error: "registry must contain at least one admin" },
          { status: 400 },
        );
      }
      const rows = users.map(appUserToRow);
      const { error: delErr } = await db.from("app_users").delete().neq("id", "__never__");
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      if (rows.length) {
        const { error: insErr } = await db.from("app_users").insert(rows);
        if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, count: rows.length, savedAt: new Date().toISOString() });
    }

    // Single add
    const user = body?.user;
    if (!user || !user.id || !user.email || !user.username) {
      return NextResponse.json(
        { ok: false, error: "user payload is required (id, email, username)" },
        { status: 400 },
      );
    }

    const email = String(user.email).toLowerCase();
    const username = String(user.username);
    const { data: existing, error: selErr } = await db
      .from("app_users")
      .select("id,username,email")
      .or(`id.eq.${user.id},email.eq.${email},username.eq.${username}`);
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
    if (existing?.some((r: any) => r.id === user.id)) {
      return NextResponse.json({ ok: false, error: "id_taken" }, { status: 409 });
    }
    if (existing?.some((r: any) => String(r.email).toLowerCase() === email)) {
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409 });
    }
    if (existing?.some((r: any) => String(r.username).toLowerCase() === username.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }

    const { error: insErr } = await db.from("app_users").insert(appUserToRow(user));
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, user, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[POST /api/admin/users]", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, patch } = body ?? {};
    if (!id || typeof id !== "string" || !patch || typeof patch !== "object") {
      return NextResponse.json({ ok: false, error: "id and patch are required" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: target, error: getErr } = await db
      .from("app_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (getErr) return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    if (!target) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    // Last-admin guard
    const wouldLoseAdminRole = patch.role && patch.role !== "admin";
    const wouldDeactivate = patch.isActive === false;
    if (target.role === "admin" && (wouldLoseAdminRole || wouldDeactivate)) {
      const { count, error: cntErr } = await db
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true)
        .neq("id", id);
      if (cntErr) return NextResponse.json({ ok: false, error: cntErr.message }, { status: 500 });
      if (!count || count === 0) {
        return NextResponse.json({ ok: false, error: "cannot_demote_last_admin" }, { status: 400 });
      }
    }

    const merged = { ...rowToAppUser(target as AppUserRow), ...patch, id: target.id };
    const { error: updErr } = await db
      .from("app_users")
      .update(appUserToRow(merged))
      .eq("id", id);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, user: merged, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[PATCH /api/admin/users]", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let userId = req.nextUrl.searchParams.get("id");
    if (!userId) {
      try {
        const body = await req.json();
        if (body?.id && typeof body.id === "string") userId = body.id;
      } catch {
        /* no body — fine */
      }
    }
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID required (?id= or JSON body {id})" },
        { status: 400 },
      );
    }

    const db = getSupabaseAdmin();
    const { data: target, error: selErr } = await db
      .from("app_users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });

    // Idempotent: not found = already gone.
    if (!target) {
      return NextResponse.json({
        ok: true,
        removed: userId,
        note: "not_in_server_registry",
        savedAt: new Date().toISOString(),
      });
    }
    if (target.role === "admin") {
      return NextResponse.json({ ok: false, error: "cannot_remove_admin" }, { status: 400 });
    }

    const { error: delErr } = await db.from("app_users").delete().eq("id", userId);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

    // Best-effort cleanup of the user's data blob
    if (target.storage_key && /^[A-Za-z0-9_-]+$/.test(target.storage_key)) {
      await db.from("user_data").delete().eq("storage_key", target.storage_key);
    }

    return NextResponse.json({ ok: true, removed: userId, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[DELETE /api/admin/users]", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
```

### 3.3 Replace — `src/app/api/sync/route.ts`

**Overwrite** with:

```typescript
/**
 * /api/sync — Supabase-backed per-user data blob.
 * Replaces the previous filesystem-based implementation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeStorageKey(key: string): string | null {
  return key && /^[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

export async function POST(req: NextRequest) {
  try {
    const { storageKey, data } = await req.json();
    if (!storageKey || typeof storageKey !== "string") {
      return NextResponse.json({ ok: false, error: "storageKey is required" }, { status: 400 });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { ok: false, error: "data is required and must be an object" },
        { status: 400 },
      );
    }
    const sanitized = sanitizeStorageKey(storageKey);
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: "invalid storageKey" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { error } = await db
      .from("user_data")
      .upsert(
        { storage_key: sanitized, data, updated_at: new Date().toISOString() },
        { onConflict: "storage_key" },
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[POST /api/sync]", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const storageKey = req.nextUrl.searchParams.get("storageKey");
    if (!storageKey) {
      return NextResponse.json(
        { ok: false, error: "storageKey query param is required" },
        { status: 400 },
      );
    }
    const sanitized = sanitizeStorageKey(storageKey);
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: "invalid storageKey" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: row, error } = await db
      .from("user_data")
      .select("data")
      .eq("storage_key", sanitized)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: (row as any).data });
  } catch (err: any) {
    console.error("[GET /api/sync]", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
```

### 3.4 Replace — `functions/api/admin/users.ts` (Cloudflare Pages Function)

Switch from KV to Supabase PostgREST (raw fetch, no SDK dependency — avoids bundling surprises in Cloudflare's functions build).

**Overwrite** with:

```typescript
/**
 * CLOUDFLARE PAGES FUNCTION — /api/admin/users
 * ────────────────────────────────────────────
 * Supabase-backed (PostgREST) replacement for the previous KV version.
 * Keeps the same request/response contract as before.
 *
 * Requires environment variables:
 *   SUPABASE_URL               (project URL)
 *   SUPABASE_SERVICE_ROLE_KEY  (service-role secret)
 */

type AppUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "member" | "demo";
  dataMode: "real" | "own" | "demo";
  storageKey: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
};

type AppUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: AppUser["role"];
  data_mode: AppUser["dataMode"];
  storage_key: string;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function getSupabase(env: any): { url: string; key: string } | null {
  const url = env?.SUPABASE_URL ?? env?.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: String(url).replace(/\/$/, ""), key: String(key) };
}

function sbHeaders(key: string, extra?: Record<string, string>): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

function rowToAppUser(r: AppUserRow): AppUser & { created_at: string } {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    displayName: r.display_name,
    passwordHash: r.password_hash ?? "",
    role: r.role,
    dataMode: r.data_mode,
    storageKey: r.storage_key,
    createdAt: r.created_at,
    lastLogin: r.last_login ?? undefined,
    isActive: r.is_active,
    created_at: r.created_at,
  };
}

function appUserToRow(u: any): AppUserRow {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email).toLowerCase(),
    display_name: String(u.displayName ?? u.display_name ?? u.username),
    password_hash: u.passwordHash ?? u.password_hash ?? "",
    role: u.role,
    data_mode: u.dataMode ?? u.data_mode ?? "own",
    storage_key: u.storageKey ?? u.storage_key,
    created_at: u.createdAt ?? u.created_at ?? new Date().toISOString(),
    last_login: u.lastLogin ?? u.last_login ?? null,
    is_active: u.isActive !== false,
  };
}

async function fetchAll(url: string, key: string): Promise<AppUserRow[]> {
  const res = await fetch(`${url}/rest/v1/app_users?select=*&order=created_at.asc`, {
    headers: sbHeaders(key),
  });
  if (!res.ok) throw new Error(`supabase GET app_users ${res.status}: ${await res.text()}`);
  return (await res.json()) as AppUserRow[];
}

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const sb = getSupabase(env);
  if (!sb) {
    return json(
      {
        ok: false,
        error:
          "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Cloudflare Pages env.",
      },
      503,
    );
  }

  try {
    const url = new URL(request.url);

    // ── GET ────────────────────────────────────────────
    if (request.method === "GET") {
      const rows = await fetchAll(sb.url, sb.key);
      return json({ users: rows.map(rowToAppUser) });
    }

    // ── POST ───────────────────────────────────────────
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as any;

      // Bulk replace
      if (Array.isArray(body?.users)) {
        const users: any[] = body.users;
        if (!users.some((u) => u.role === "admin")) {
          return json({ ok: false, error: "registry must contain at least one admin" }, 400);
        }
        const rows = users.map(appUserToRow);

        const del = await fetch(`${sb.url}/rest/v1/app_users?id=neq.__never__`, {
          method: "DELETE",
          headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
        });
        if (!del.ok) return json({ ok: false, error: `delete ${del.status}: ${await del.text()}` }, 500);

        if (rows.length) {
          const ins = await fetch(`${sb.url}/rest/v1/app_users`, {
            method: "POST",
            headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
            body: JSON.stringify(rows),
          });
          if (!ins.ok) return json({ ok: false, error: `insert ${ins.status}: ${await ins.text()}` }, 500);
        }
        return json({ ok: true, count: rows.length, savedAt: new Date().toISOString() });
      }

      // Single add
      const user = body?.user;
      if (!user || !user.id || !user.email || !user.username) {
        return json({ ok: false, error: "user payload is required (id, email, username)" }, 400);
      }
      const existing = await fetchAll(sb.url, sb.key);
      if (existing.some((r) => r.id === user.id)) return json({ ok: false, error: "id_taken" }, 409);
      if (existing.some((r) => r.email.toLowerCase() === String(user.email).toLowerCase())) {
        return json({ ok: false, error: "email_taken" }, 409);
      }
      if (existing.some((r) => r.username.toLowerCase() === String(user.username).toLowerCase())) {
        return json({ ok: false, error: "username_taken" }, 409);
      }

      const ins = await fetch(`${sb.url}/rest/v1/app_users`, {
        method: "POST",
        headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
        body: JSON.stringify(appUserToRow(user)),
      });
      if (!ins.ok) return json({ ok: false, error: `insert ${ins.status}: ${await ins.text()}` }, 500);
      return json({ ok: true, user, savedAt: new Date().toISOString() });
    }

    // ── PATCH ──────────────────────────────────────────
    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as any;
      const id = body?.id;
      const patch = body?.patch;
      if (!id || typeof id !== "string" || !patch || typeof patch !== "object") {
        return json({ ok: false, error: "id and patch are required" }, 400);
      }

      const all = await fetchAll(sb.url, sb.key);
      const target = all.find((r) => r.id === id);
      if (!target) return json({ ok: false, error: "not_found" }, 404);

      const wouldLoseAdminRole = patch.role && patch.role !== "admin";
      const wouldDeactivate = patch.isActive === false;
      if (target.role === "admin" && (wouldLoseAdminRole || wouldDeactivate)) {
        const otherActiveAdmins = all.filter(
          (r) => r.id !== id && r.role === "admin" && r.is_active,
        );
        if (otherActiveAdmins.length === 0) {
          return json({ ok: false, error: "cannot_demote_last_admin" }, 400);
        }
      }

      const merged = { ...rowToAppUser(target), ...patch, id: target.id };
      const upd = await fetch(`${sb.url}/rest/v1/app_users?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
        body: JSON.stringify(appUserToRow(merged)),
      });
      if (!upd.ok) return json({ ok: false, error: `update ${upd.status}: ${await upd.text()}` }, 500);
      return json({ ok: true, user: merged, savedAt: new Date().toISOString() });
    }

    // ── DELETE ─────────────────────────────────────────
    if (request.method === "DELETE") {
      let userId = url.searchParams.get("id") ?? "";
      if (!userId) {
        try {
          const body = (await request.json()) as any;
          if (typeof body?.id === "string") userId = body.id;
        } catch {
          /* no body */
        }
      }
      if (!userId) {
        return json({ ok: false, error: "User ID required (?id= or JSON body {id})" }, 400);
      }

      const all = await fetchAll(sb.url, sb.key);
      const target = all.find((r) => r.id === userId);
      if (!target) {
        return json({
          ok: true,
          removed: userId,
          note: "not_in_server_registry",
          savedAt: new Date().toISOString(),
        });
      }
      if (target.role === "admin") {
        return json({ ok: false, error: "cannot_remove_admin" }, 400);
      }

      const del = await fetch(`${sb.url}/rest/v1/app_users?id=eq.${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
      });
      if (!del.ok) return json({ ok: false, error: `delete ${del.status}: ${await del.text()}` }, 500);

      if (target.storage_key && /^[A-Za-z0-9_-]+$/.test(target.storage_key)) {
        await fetch(`${sb.url}/rest/v1/user_data?storage_key=eq.${encodeURIComponent(target.storage_key)}`, {
          method: "DELETE",
          headers: sbHeaders(sb.key, { Prefer: "return=minimal" }),
        });
      }

      return json({ ok: true, removed: userId, savedAt: new Date().toISOString() });
    }

    return json({ ok: false, error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("[/api/admin/users] unhandled error", err);
    return json({ ok: false, error: `server error: ${String(err)}` }, 500);
  }
};
```

### 3.5 Replace — `functions/api/sync.ts` (Cloudflare Pages Function)

**Overwrite** with:

```typescript
/**
 * CLOUDFLARE PAGES FUNCTION — /api/sync
 * ─────────────────────────────────────
 * Supabase-backed (PostgREST) replacement for the previous KV version.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function sanitizeStorageKey(key: string): string | null {
  return key && /^[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

function getSupabase(env: any): { url: string; key: string } | null {
  const url = env?.SUPABASE_URL ?? env?.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: String(url).replace(/\/$/, ""), key: String(key) };
}

function sbHeaders(key: string, extra?: Record<string, string>): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const sb = getSupabase(env);
  if (!sb) {
    return json(
      {
        ok: false,
        error:
          "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Cloudflare Pages env.",
      },
      503,
    );
  }

  try {
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as any;
      const { storageKey, data } = body ?? {};

      if (!storageKey || typeof storageKey !== "string") {
        return json({ ok: false, error: "storageKey is required" }, 400);
      }
      if (!data || typeof data !== "object") {
        return json({ ok: false, error: "data is required and must be an object" }, 400);
      }
      const sanitized = sanitizeStorageKey(storageKey);
      if (!sanitized) return json({ ok: false, error: "invalid storageKey" }, 400);

      const up = await fetch(`${sb.url}/rest/v1/user_data?on_conflict=storage_key`, {
        method: "POST",
        headers: sbHeaders(sb.key, {
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify({
          storage_key: sanitized,
          data,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!up.ok) {
        return json({ ok: false, error: `upsert ${up.status}: ${await up.text()}` }, 500);
      }
      return json({ ok: true, savedAt: new Date().toISOString() });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const storageKey = url.searchParams.get("storageKey") ?? "";
      if (!storageKey) {
        return json({ ok: false, error: "storageKey query param is required" }, 400);
      }
      const sanitized = sanitizeStorageKey(storageKey);
      if (!sanitized) return json({ ok: false, error: "invalid storageKey" }, 400);

      const res = await fetch(
        `${sb.url}/rest/v1/user_data?storage_key=eq.${encodeURIComponent(sanitized)}&select=data`,
        { headers: sbHeaders(sb.key) },
      );
      if (!res.ok) {
        return json({ ok: false, error: `get ${res.status}: ${await res.text()}` }, 500);
      }
      const rows = (await res.json()) as Array<{ data: unknown }>;
      if (!rows.length) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, data: rows[0].data });
    }

    return json({ ok: false, error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("[/api/sync] unhandled error", err);
    return json({ ok: false, error: `server error: ${String(err)}` }, 500);
  }
};
```

### 3.6 Delete — stale sibling function

The file `functions/sync.ts` (at path `/sync`, not `/api/sync`) also hits KV and is no longer referenced by the client. **Delete it** to avoid drift:

```bash
rm "functional-planner/functions/sync.ts" 2>/dev/null || rm "financial-planner/functions/sync.ts"
```

If that path doesn't exist, skip.

### 3.7 Clean `vercel.json` — remove Supabase placeholders and committed secrets

**Overwrite** `financial-planner/vercel.json` with the minimal config below. All secrets now come from Vercel's dashboard env vars, not the repo.

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

⚠️ **Haiku: do NOT commit any API keys, passwords, or tokens to this file. Ever.**

---

## §4. One-time data migration (Toy runs after §3 is deployed to Vercel preview) 🛑

Goal: copy existing accounts + per-user data from the live Cloudflare KV-backed endpoints into Supabase, so both hosts show the same data.

### 4.1 Create `scripts/migrate-kv-to-supabase.mjs`

**Create** `financial-planner/scripts/migrate-kv-to-supabase.mjs`:

```javascript
#!/usr/bin/env node
/**
 * ONE-TIME MIGRATION
 * ──────────────────
 * Reads the live registry + per-user data from the Cloudflare Pages
 * deploy (still KV-backed at the moment this script is run) and writes
 * them into Supabase via service-role PostgREST.
 *
 * Usage:
 *   CF_BASE_URL=https://financeplan-th.pages.dev \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/migrate-kv-to-supabase.mjs
 *
 * Idempotent: uses upsert semantics on both tables.
 */

const CF = process.env.CF_BASE_URL;
const SB = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CF || !SB || !SK) {
  console.error("Missing env. Need: CF_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sbHeaders = (extra = {}) => ({
  apikey: SK,
  Authorization: `Bearer ${SK}`,
  "Content-Type": "application/json",
  ...extra,
});

function toRow(u) {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email).toLowerCase(),
    display_name: String(u.displayName ?? u.username),
    password_hash: u.passwordHash ?? "",
    role: u.role,
    data_mode: u.dataMode ?? "own",
    storage_key: u.storageKey,
    created_at: u.createdAt ?? new Date().toISOString(),
    last_login: u.lastLogin ?? null,
    is_active: u.isActive !== false,
  };
}

async function main() {
  // 1. Pull the user registry from the still-KV-backed CF endpoint.
  //    IMPORTANT: run this script BEFORE you flip Cloudflare to the
  //    Supabase-backed function (§3.4) — otherwise both sides are empty.
  console.log(`[1/3] GET ${CF}/api/admin/users`);
  const regRes = await fetch(`${CF}/api/admin/users`);
  if (!regRes.ok) throw new Error(`registry fetch failed ${regRes.status}`);
  const { users } = await regRes.json();
  console.log(`     → ${users.length} users`);

  // 2. Upsert all users into Supabase.
  console.log(`[2/3] upsert ${users.length} rows into app_users`);
  const rows = users.map(toRow);
  const up = await fetch(`${SB}/rest/v1/app_users?on_conflict=id`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!up.ok) throw new Error(`app_users upsert ${up.status}: ${await up.text()}`);

  // 3. Pull each user's data blob from CF, upsert into user_data.
  console.log(`[3/3] migrating per-user data`);
  let moved = 0;
  let missing = 0;
  for (const u of users) {
    if (!u.storageKey) continue;
    const dRes = await fetch(`${CF}/api/sync?storageKey=${encodeURIComponent(u.storageKey)}`);
    if (dRes.status === 404) {
      missing++;
      continue;
    }
    if (!dRes.ok) {
      console.warn(`     ! skip ${u.storageKey}: sync GET ${dRes.status}`);
      continue;
    }
    const { data } = await dRes.json();
    const up2 = await fetch(`${SB}/rest/v1/user_data?on_conflict=storage_key`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        storage_key: u.storageKey,
        data,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!up2.ok) {
      console.warn(`     ! skip ${u.storageKey}: supabase upsert ${up2.status}: ${await up2.text()}`);
      continue;
    }
    moved++;
    console.log(`     ✓ ${u.username} (${u.storageKey})`);
  }

  console.log(`\nDone. users=${users.length}  data_moved=${moved}  data_missing=${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Make it executable (not strictly needed since we invoke via `node`, but clean):
```bash
chmod +x financial-planner/scripts/migrate-kv-to-supabase.mjs
```

### 4.2 Run order (critical)

Toy runs these **in this exact order**:

1. Apply §1 SQL → Supabase tables exist.
2. Apply §2 env vars → Vercel + Cloudflare have creds.
3. Apply §3.1–§3.3 code → **Vercel preview deploy** → confirm Vercel talks to Supabase (empty registry is expected at this point).
4. **Run migration** (Cloudflare is still on KV at this point — §3.4/§3.5 NOT yet deployed):
   ```bash
   CF_BASE_URL=https://financeplan-th.pages.dev \
   SUPABASE_URL=https://<your-project>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   node financial-planner/scripts/migrate-kv-to-supabase.mjs
   ```
5. Verify Supabase tables now contain the users + data (SQL Editor: `select id, email, role from app_users;`).
6. Deploy §3.4–§3.6 code to Cloudflare → both hosts now read from Supabase.

If you deploy Cloudflare changes BEFORE the migration, the KV data becomes unreachable via the public endpoint. If that happens, recover by running `wrangler kv:key get --namespace-id=805d21b76701462b94137b5f20275066 users-registry` locally and feeding the JSON into Supabase manually.

---

## §5. Fix the `toy.theeranan@icloud.com` login (Toy does in Supabase dashboard) 🛑

The login page calls `supabase.auth.signInWithPassword`. Supabase has its own `auth.users` table; the `app_users` table is separate metadata. Both `toy.theeranan@icloud.com` and `toy.theeranan@gmail.com` need entries with passwords in Supabase Auth.

Supabase Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**:

1. Email: `toy.theeranan@icloud.com` → Password: *(pick a strong one, save to password manager)* → **uncheck** "Auto Confirm User"? Actually **do** check "Auto Confirm User" — otherwise the account stays unconfirmed and can't sign in.
2. Repeat for `toy.theeranan@gmail.com`.

Test both on the Vercel preview URL: `/login` → email + password → should land on `/` authenticated.

---

## §6. Verification checklist (Haiku runs, then hands off to Toy for the deploy checks)

After §3 code changes land:

```bash
cd financial-planner

# 1. TypeScript + shell-escape check
npm run check:shell-escapes
npm run build
```

Build must succeed with no TypeScript errors in the new files. `ignoreBuildErrors: true` is set in `next.config.js` but Haiku should still `grep -n "TypeScript error" .next/` style-check is N/A; just confirm `npm run build` exits 0.

Smoke tests (Toy performs on each deploy):

| Check | Cloudflare | Vercel |
|---|---|---|
| `GET /api/admin/users` returns the same users list on both | ✓ | ✓ |
| `GET /api/sync?storageKey=fp_data_toy` returns real data on both | ✓ | ✓ |
| Login at `/login` with `toy.theeranan@icloud.com` succeeds | ✓ | ✓ |
| `/accounts` page shows identical user set | ✓ | ✓ |
| Add a new user on Cloudflare → appears on Vercel within one reload | ✓ | ✓ |

Paste this one-liner into the browser DevTools console on each deploy to cross-compare:

```javascript
fetch("/api/admin/users").then(r => r.json()).then(j => console.table(j.users.map(u => ({ id: u.id, email: u.email, role: u.role, isActive: u.isActive }))))
```

---

## §7. Housekeeping (Toy does; outside Haiku's scope)

The previous `vercel.json` had these committed secrets — **rotate them now**:

1. `ANTHROPIC_API_KEY` — go to https://console.anthropic.com → Settings → API keys → delete the `sk-ant-api03-20kdPs...` key → create a new one → store in Vercel env vars only.
2. `GMAIL_APP_PASS` (`xjephtpoprlapoio`) — go to https://myaccount.google.com/apppasswords → revoke the existing app password → generate a new one → store in Vercel env vars only (and Cloudflare if used there too).
3. Run a git secret-history scrub if the repo is public or shared: `git log --all --diff-filter=A --name-only | grep vercel.json` to find commits that added the secrets, then `git filter-repo` or BFG to strip them. If the repo is private and only Toy has access, rotation alone is sufficient.

---

## §8. Rollback plan

If anything breaks after §3 goes live:

- **Next.js routes:** `git revert` the commits that changed `src/app/api/admin/users/route.ts` and `src/app/api/sync/route.ts`. The old filesystem-backed version returns. Vercel goes back to its pre-Track-B broken state but Cloudflare is unaffected.
- **Cloudflare Pages Functions:** `git revert` the commits that changed `functions/api/admin/users.ts` and `functions/api/sync.ts`. KV is still intact (we didn't delete anything in KV), so Cloudflare returns to its working state immediately.
- **Supabase rows:** the new tables are non-destructive. If you want to drop them: `drop table public.user_data; drop table public.app_users;` in SQL Editor — the app falls back to whatever the servers now return (which, post-revert, is KV/filesystem).

---

## §9. Out of scope (explicit non-goals for Track B)

- Changing how client-side `localStorage` caches the registry (`src/lib/users.ts`). It still talks to `/api/admin/users` — only the backing store changed.
- Moving the `_cachedSession` / `synthesizeSession` flow. Supabase Auth is unchanged.
- Deleting the legacy sha256 `login()` function in `src/lib/auth.ts` (still kill-switched; removal is a separate PR).
- Removing `functions/schedule-email.ts` or the email-notify Worker.
- Touching `wrangler.toml`'s KV binding (leave it; unused but harmless).

---

## Appendix: file inventory

**New files (Haiku creates):**
- `src/lib/supabase/admin.ts`
- `scripts/migrate-kv-to-supabase.mjs`

**Replaced files (Haiku overwrites):**
- `src/app/api/admin/users/route.ts`
- `src/app/api/sync/route.ts`
- `functions/api/admin/users.ts`
- `functions/api/sync.ts`
- `vercel.json`

**Possibly deleted (if present):**
- `functions/sync.ts`

**Unchanged (do not touch):**
- `src/lib/users.ts` (client-side calls same URLs)
- `src/lib/auth.ts` (Supabase auth unchanged)
- `src/app/login/page.tsx`, `signup/page.tsx`, `auth/callback/route.ts`
- `src/middleware.ts`
- `wrangler.toml`
