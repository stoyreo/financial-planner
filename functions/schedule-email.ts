/**
 * CLOUDFLARE PAGES FUNCTION — Schedule Email Proxy
 * ────────────────────────────────────────────────
 * Proxies scheduled email requests to the scheduled-email-worker.
 */

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as any;
      const { to, subject, html, sendTime } = body;

      if (!to || !subject || !html || !sendTime) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing required fields: to, subject, html, sendTime" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid email address" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const sendTimeDate = new Date(sendTime);
      if (isNaN(sendTimeDate.getTime()) || sendTimeDate < new Date()) {
        return new Response(
          JSON.stringify({ ok: false, error: "sendTime must be a future ISO timestamp" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const emailId = crypto.randomUUID();
      const kv = env.FINANCIAL_PLANNER_KV as KVNamespace;

      await kv.put(`scheduled_email:${emailId}`, JSON.stringify({ to, subject, html, sendTime }));

      return new Response(
        JSON.stringify({ ok: true, emailId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[schedule-email] Error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Internal server error" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};
