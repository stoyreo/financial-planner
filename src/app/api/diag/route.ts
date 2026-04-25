/**
 * /api/diag — TEMPORARY diagnostic endpoint.
 * Returns a structured summary of:
 *   - whether the Supabase env vars are present at runtime,
 *   - the result of a SELECT and an UPSERT on each table,
 *   - the full PostgREST error envelope (.code/.details/.hint/.message)
 *     so we can see the real cause of the generic "Internal server error"
 *     coming back from /api/sync and /api/admin/users.
 *
 * Delete this file once the sync issue is fixed.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envSummary() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return {
    NEXT_PUBLIC_SUPABASE_URL_len: u.length,
    NEXT_PUBLIC_SUPABASE_URL_host: (() => {
      try { return new URL(u).host; } catch { return null; }
    })(),
    SUPABASE_SERVICE_ROLE_KEY_len: k.length,
    SUPABASE_SERVICE_ROLE_KEY_prefix: k.slice(0, 6),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_len: a.length,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: a.slice(0, 6),
  };
}

function errEnvelope(e: any) {
  if (!e) return null;
  return {
    message: e.message ?? null,
    code: e.code ?? null,
    details: e.details ?? null,
    hint: e.hint ?? null,
    name: e.name ?? null,
    status: (e as any)?.status ?? null,
    statusText: (e as any)?.statusText ?? null,
  };
}

export async function GET() {
  const env = envSummary();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !key) {
    return NextResponse.json({ env, fatal: "missing_url_or_service_role_key" }, { status: 200 });
  }

  let probes: Record<string, any> = {};
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. Read user_data (works in prod today)
    {
      const r = await db.from("user_data").select("storage_key").limit(1);
      probes.user_data_select = { error: errEnvelope(r.error), rowCount: r.data?.length ?? null };
    }
    // 2. Write user_data (fails in prod today)
    {
      const r = await db
        .from("user_data")
        .upsert(
          { storage_key: "_diag_probe", data: { ts: Date.now() }, updated_at: new Date().toISOString() },
          { onConflict: "storage_key" },
        );
      probes.user_data_upsert = { error: errEnvelope(r.error) };
    }
    // 3. Read app_users (fails in prod today)
    {
      const r = await db.from("app_users").select("id").limit(1);
      probes.app_users_select = { error: errEnvelope(r.error), rowCount: r.data?.length ?? null };
    }
    // 4. Read auth.users count (sanity check that service_role works)
    {
      const r = await db.from("app_users").select("id", { count: "exact", head: true });
      probes.app_users_count = { error: errEnvelope(r.error), count: r.count ?? null };
    }
  } catch (err: any) {
    probes.fatal = String(err?.message ?? err);
  }

  return NextResponse.json({ env, probes }, { status: 200 });
}
