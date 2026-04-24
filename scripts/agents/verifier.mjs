// scripts/agents/verifier.mjs
import { callAgent, log } from "./_shared.mjs";

const SYSTEM = `You are VERIFIER, a smoke-test agent. Given an array of HTTP
probe results, set ok=true only if every probe returned status 200. Include a
one-line human reason naming the first failing path if any.`;

const SCHEMA = {
  type: "object",
  properties: {
    ok:     { type: "boolean" },
    reason: { type: "string" },
    probes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path:   { type: "string" },
          status: { type: "integer" },
          ms:     { type: "integer" },
        },
        required: ["path", "status", "ms"],
      },
    },
  },
  required: ["ok", "reason", "probes"],
};

// Keep probes to human paths — hashed chunk names change per build and cause false fails.
const PROBE_PATHS = ["/", "/admin/"];

export async function runVerifier(prev) {
  const probes = [];
  for (const p of PROBE_PATHS) {
    const started = Date.now();
    let status = 0;
    try {
      const r = await fetch(prev.url.replace(/\/$/, "") + p, { redirect: "manual" });
      status = r.status;
    } catch { status = 0; }
    probes.push({ path: p, status, ms: Date.now() - started });
  }

  const out = await callAgent({
    system: SYSTEM,
    userJson: { previous: prev, probes },
    schema: SCHEMA,
    maxTokens: 300,
  });
  out.url       = prev.url;
  out.version   = prev.version;
  out.commitSha = prev.commitSha;
  log("verifier", out);
  return out;
}
