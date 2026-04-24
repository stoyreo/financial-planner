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
