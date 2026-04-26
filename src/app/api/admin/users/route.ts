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
