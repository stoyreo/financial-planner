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
