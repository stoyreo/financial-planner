// scripts/agents/deployer.mjs
import { spawnSync } from "node:child_process";
import { callAgent, log } from "./_shared.mjs";

const SYSTEM = `You are DEPLOYER, a Vercel-output parser. Given the raw stdout
from a Vercel CLI deploy, extract the first https URL that matches
https://<slug>.vercel.app. If exitCode != 0 OR no URL is found, set ok=false.`;

const SCHEMA = {
  type: "object",
  properties: {
    ok:     { type: "boolean" },
    reason: { type: "string" },
    url:    { type: "string" },
  },
  required: ["ok", "reason", "url"],
};

export async function runDeployer(prev) {
  const env = {
    ...process.env,
    VERCEL_ORG_ID:     process.env.VERCEL_ORG_ID,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  };
  const proc = spawnSync(
    "vercel",
    ["deploy", "--prod", "--yes", "--token", process.env.VERCEL_TOKEN],
    { cwd: process.cwd(), shell: true, encoding: "utf8", env },
  );
  const stdout = (proc.stdout || "") + "\n" + (proc.stderr || "");

  const facts = {
    previous: prev,
    exitCode: proc.status,
    stdoutTail: stdout.split("\n").slice(-30).join("\n"),
  };

  const out = await callAgent({ system: SYSTEM, userJson: facts, schema: SCHEMA, maxTokens: 200 });
  out.version   = prev.version;
  out.commitSha = prev.commitSha;
  log("deployer", out);
  return out;
}
