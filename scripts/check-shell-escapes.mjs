#!/usr/bin/env node
// Fails the build if bash-escape artifacts leak into source files.
// Catches \! (history-expansion escape) and other suspicious backslash
// escapes that are almost never valid in TS/JS/TSX/JSX/JSON/MD.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCAN_DIRS = ["src", "scripts", "functions", "cloudflare"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md"]);
const PATTERNS = [
  { re: /\\!/g, msg: "Found '\\!' — bash history-expansion artifact. Use '!' instead." },
];

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      walk(p);
    } else if (EXTS.has(extname(name))) {
      // Skip this script itself (it contains the patterns it's checking for)
      if (name === "check-shell-escapes.mjs") continue;
      const text = readFileSync(p, "utf8");
      for (const { re, msg } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text))) {
          const line = text.slice(0, m.index).split("\n").length;
          hits.push({ file: p, line, msg });
        }
      }
    }
  }
}

for (const d of SCAN_DIRS) {
  try { walk(join(ROOT, d)); } catch {}
}

if (hits.length) {
  console.error("Shell-escape check failed:");
  for (const h of hits) console.error(`  ${h.file}:${h.line} — ${h.msg}`);
  console.error("\nFix: replace the offending sequence with its unescaped form. Do not use bash heredocs or sed to write TS source — use the editor directly.");
  process.exit(1);
}
console.log("Shell-escape check passed.");
