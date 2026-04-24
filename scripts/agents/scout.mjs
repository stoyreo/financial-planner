// scripts/agents/scout.mjs
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { callAgent, log } from "./_shared.mjs";

const SYSTEM = `You are SCOUT, a release-gate agent. You receive a facts JSON
about the repo. Decide whether the repo is in a safe state to deploy to Vercel.
Rules:
- FAIL if package.json version is missing.
- FAIL if gitDirty is true AND allowDirty is false.
- FAIL if any requiredFiles entry is missing.
- Otherwise PASS.
Always emit emit_result with ok, reason (short), version, commitSha.`;

const SCHEMA = {
  type: "object",
  properties: {
    ok:        { type: "boolean" },
    reason:    { type: "string" },
    version:   { type: "string" },
    commitSha: { type: "string" },
  },
  required: ["ok", "reason", "version", "commitSha"],
};

export async function runScout({ cwd }) {
  const pkg = JSON.parse(readFileSync(`${cwd}/package.json`, "utf8"));
  let gitDirty = true, commitSha = "unknown";
  try {
    gitDirty  = execSync("git status --porcelain", { cwd }).toString().trim().length > 0;
    commitSha = execSync("git rev-parse --short HEAD", { cwd }).toString().trim();
  } catch { /* not a git repo — treat as dirty */ }

  const facts = {
    version: pkg.version,
    gitDirty,
    commitSha,
    allowDirty: process.env.ALLOW_DIRTY === "1",
    requiredFiles: {
      "next.config.js":   existsSync(`${cwd}/next.config.js`),
      ".vercel/project.json": existsSync(`${cwd}/.vercel/project.json`),
      ".env.local":       existsSync(`${cwd}/.env.local`),
    },
  };

  const out = await callAgent({ system: SYSTEM, userJson: facts, schema: SCHEMA, maxTokens: 256 });
  log("scout", out);
  return out;
}
