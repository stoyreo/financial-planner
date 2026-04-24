// scripts/agents/builder.mjs
import { execSync, spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { callAgent, log } from "./_shared.mjs";

const SYSTEM = `You are BUILDER, a build-analysis agent. Given build stdout tail
and an outDir summary, decide if the static export is healthy.
Rules:
- FAIL if exitCode != 0.
- FAIL if outDir.fileCount < 10 (clearly incomplete).
- FAIL if outDir.missingIndex is true.
- PASS otherwise, even with warnings.`;

const SCHEMA = {
  type: "object",
  properties: {
    ok:        { type: "boolean" },
    reason:    { type: "string" },
    fileCount: { type: "integer" },
    totalKB:   { type: "integer" },
  },
  required: ["ok", "reason", "fileCount", "totalKB"],
};

function walk(dir) {
  let count = 0, bytes = 0, hasIndex = false;
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    const s = statSync(p);
    if (s.isDirectory()) {
      const sub = walk(p);
      count += sub.count; bytes += sub.bytes; hasIndex ||= sub.hasIndex;
    } else {
      count++; bytes += s.size;
      if (name === "index.html" && dir.endsWith("/out")) hasIndex = true;
    }
  }
  return { count, bytes, hasIndex };
}

export async function runBuilder(prev) {
  const proc = spawnSync("npx", ["next", "build"], {
    cwd: process.cwd(), shell: true, encoding: "utf8",
  });
  const tail = (proc.stdout + "\n" + proc.stderr).split("\n").slice(-40).join("\n");
  const outDir = `${process.cwd()}/out`;
  const w = existsSync(outDir) ? walk(outDir) : { count: 0, bytes: 0, hasIndex: false };

  const facts = {
    previous: prev,
    exitCode: proc.status,
    buildLogTail: tail,
    outDir: {
      exists: existsSync(outDir),
      fileCount: w.count,
      totalKB: Math.round(w.bytes / 1024),
      missingIndex: !w.hasIndex,
    },
  };

  const out = await callAgent({ system: SYSTEM, userJson: facts, schema: SCHEMA, maxTokens: 300 });
  out.version   = prev.version;
  out.commitSha = prev.commitSha;
  log("builder", out);
  return out;
}
