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
