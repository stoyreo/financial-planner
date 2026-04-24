/**
 * CLOUDFLARE PAGES FUNCTION — Sync API
 * ────────────────────────────────────
 * Replaces /api/sync/route.ts for remote persistence.
 * Uses Cloudflare KV (FINANCIAL_PLANNER_KV) to store user data.
 */

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  function sanitizeStorageKey(key: string): string | null {
    if (!key || !/^[A-Za-z0-9_-]+$/.test(key)) {
      return null;
    }
    return key;
  }

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as any;
      const { storageKey, data } = body;

      if (!storageKey || typeof storageKey !== "string") {
        return new Response(
          JSON.stringify({ ok: false, error: "storageKey is required" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!data || typeof data !== "object") {
        return new Response(
          JSON.stringify({ ok: false, error: "data is required and must be an object" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const sanitized = sanitizeStorageKey(storageKey);
      if (!sanitized) {
        return new Response(
          JSON.stringify({ ok: false, error: "invalid storageKey" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const kvKey = `user-${sanitized}`;
      const kv = env.FINANCIAL_PLANNER_KV as KVNamespace;

      await kv.put(kvKey, JSON.stringify(data), { expirationTtl: 31536000 });

      const savedAt = new Date().toISOString();
      return new Response(
        JSON.stringify({ ok: true, savedAt }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[POST /sync] Error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Internal server error" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const storageKey = url.searchParams.get("storageKey");

      if (!storageKey || typeof storageKey !== "string") {
        return new Response(
          JSON.stringify({ ok: false, error: "storageKey query param is required" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const sanitized = sanitizeStorageKey(storageKey);
      if (!sanitized) {
        return new Response(
          JSON.stringify({ ok: false, error: "invalid storageKey" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const kvKey = `user-${sanitized}`;
      const kv = env.FINANCIAL_PLANNER_KV as KVNamespace;
      const value = await kv.get(kvKey);

      if (!value) {
        return new Response(
          JSON.stringify({ ok: false, error: "not_found" }),
          { status: 404, headers: corsHeaders }
        );
      }

      const data = JSON.parse(value);
      return new Response(
        JSON.stringify({ ok: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[GET /sync] Error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Internal server error" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};
