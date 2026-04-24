#!/usr/bin/env node
/**
 * DEPLOY + NOTIFY
 * --------------------------------------------------------------------------
 *   1. npm run build
 *   2. wrangler pages deploy out --project-name=financeplan-th
 *   3. Parse the per-deploy URL (e.g. https://bf7472b1.financeplan-th.pages.dev)
 *      from wrangler's stdout
 *   4. If deploy succeeds, fire scripts/send-deployment-email.js with the
 *      captured URL so both recipients get pinged.
 *
 * Run with:
 *     npm run deploy:notify
 *
 * Requires GMAIL_APP_PASS (or RESEND_API_KEY) in .env.local so the email
 * script has credentials.  Set your Cloudflare API token via
 *     wrangler login              (interactive)
 *   OR
 *     CLOUDFLARE_API_TOKEN=...    (CI)
 * --------------------------------------------------------------------------
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PROJECT_NAME = 'financeplan-th';
const OUT_DIR = 'out';

// ---------------------------------------------------------------------------
// Load .env.local so GMAIL_APP_PASS etc. are visible to child processes
// ---------------------------------------------------------------------------
try {
  const envText = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const raw of envText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) {
      // Strip optional quotes around value
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
} catch { /* .env.local optional */ }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a command, stream its output to the parent console, and capture stdout
 * for downstream parsing. Resolves with {code, stdout}.
 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: process.platform === 'win32', // needed so `npm.cmd` etc. resolve
      env: process.env,
      ...opts,
    });
    let stdout = '';
    child.stdout.on('data', chunk => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', chunk => {
      // wrangler writes the deploy URL to stderr in some versions — capture both
      const s = chunk.toString();
      stdout += s;
      process.stderr.write(s);
    });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout }));
  });
}

/**
 * Pull the per-deploy URL out of wrangler's "✨ Deployment complete! Take a
 * peek over at https://<hash>.<project>.pages.dev" line.
 * Returns null if no URL was found.
 */
function extractDeployUrl(stdout) {
  const re = /https:\/\/[a-z0-9-]+\.financeplan-th\.pages\.dev/gi;
  const matches = stdout.match(re);
  if (!matches || matches.length === 0) return null;
  // Prefer per-deploy URL (has an 8-char hash subdomain) over production alias
  const perDeploy = matches.find(u => /^https:\/\/[a-f0-9]{6,10}\.financeplan-th\.pages\.dev$/i.test(u));
  return perDeploy || matches[matches.length - 1];
}

/**
 * Poll a URL until it responds with a 2xx/3xx status code, meaning the Cloudflare
 * edge has finished propagating the deploy and the page is actually servable.
 * Opening Chrome the instant `wrangler` exits often lands on a "Deploy not
 * found" page because propagation takes a few seconds. Returns true on first
 * live response, false if we time out.
 */
async function waitUntilLive(url, { maxWaitMs = 60_000, intervalMs = 1500 } = {}) {
  if (!url) return false;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      // HEAD is cheap but some Cloudflare configs reject it — fall back to GET.
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.status >= 200 && res.status < 400) return true;
      if (res.status === 405) {
        const res2 = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (res2.status >= 200 && res2.status < 400) return true;
      }
    } catch { /* fetch failed (DNS / TLS / connect) — keep polling */ }
    if (attempt === 1) console.log(`⏳ Waiting for edge to propagate ${url}…`);
    await sleep(intervalMs);
  }
  return false;
}

/**
 * Best-effort "open this URL in Chrome". Falls back to the OS default browser
 * if Chrome isn't available. Detached + unref so the deploy script exits
 * immediately without waiting for the browser process.
 */
function openInChrome(url) {
  if (!url) return;
  console.log(`🌐 Launching browser: ${url}`);
  const platform = process.platform;

  // A small helper so each launch attempt returns a promise that resolves to
  // true on success, false on spawn/exit error. Lets us try multiple strategies
  // in sequence (e.g. Chrome direct → default browser) without crashing.
  // `extraOpts` lets callers add Windows-specific options like
  // `windowsVerbatimArguments: true` (see Windows section below).
  const tryLaunch = (command, args, extraOpts = {}) => new Promise(resolve => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false, ...extraOpts });
      let settled = false;
      child.on('error', () => { if (!settled) { settled = true; resolve(false); } });
      child.on('spawn', () => { if (!settled) { settled = true; child.unref(); resolve(true); } });
      // Safety net: if neither event fires within 2s, assume success (detached processes
      // often don't emit 'spawn' on very old Node versions) and move on.
      setTimeout(() => { if (!settled) { settled = true; try { child.unref(); } catch {} resolve(true); } }, 2000);
    } catch {
      resolve(false);
    }
  });

  (async () => {
    let ok = false;
    if (platform === 'win32') {
      // IMPORTANT: pass `windowsVerbatimArguments: true` so Node does NOT apply
      // CRT-style quoting to the args it hands to cmd.exe. Without this, Node
      // turns `start "" chrome "URL"` into `start \"\" chrome \"URL\"` and cmd
      // does not understand `\"` as an escape — the command line is mangled
      // and Chrome silently fails to open, even though spawn() itself succeeds.
      const winOpts = { windowsVerbatimArguments: true };
      ok = await tryLaunch('cmd', ['/c', `start "" chrome "${url}"`], winOpts);
      if (!ok) {
        // Fallback 1: use the default browser (opens Chrome if it's set as default).
        ok = await tryLaunch('cmd', ['/c', `start "" "${url}"`], winOpts);
      }
      if (!ok) {
        // Fallback 2: shell out via shell:true so cmd.exe parses the line itself.
        ok = await tryLaunch(`start "" chrome "${url}"`, [], { shell: true });
      }
    } else if (platform === 'darwin') {
      ok = await tryLaunch('open', ['-a', 'Google Chrome', url]);
      if (!ok) ok = await tryLaunch('open', [url]);
    } else {
      for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'xdg-open']) {
        ok = await tryLaunch(bin, [url]);
        if (ok) break;
      }
    }
    if (!ok) {
      console.warn(`⚠️  Could not open browser automatically. Open manually: ${url}`);
    }
  })();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Financial 101 Master — Deploy & Notify');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Build
  console.log('[1/3] Building production bundle…\n');
  const build = await run('npm', ['run', 'build']);
  if (build.code !== 0) {
    console.error('\n❌ Build failed — aborting deploy.');
    process.exit(build.code);
  }

  // 2. Deploy via wrangler pages
  console.log('\n[2/3] Deploying to Cloudflare Pages…\n');
  const deploy = await run('npx', [
    'wrangler', 'pages', 'deploy', OUT_DIR,
    `--project-name=${PROJECT_NAME}`,
    '--branch=main',
  ]);
  if (deploy.code !== 0) {
    console.error('\n❌ Deploy failed — skipping email notification.');
    process.exit(deploy.code);
  }

  const deployUrl = extractDeployUrl(deploy.stdout);
  if (!deployUrl) {
    console.warn('\n⚠️  Could not parse per-deploy URL from wrangler output.');
    console.warn('   Falling back to production alias for the email.');
  } else {
    console.log(`\n✅ Deployed:  ${deployUrl}`);
  }

  // 2b. Auto-open the fresh deploy in Chrome — but only once the server is
  //     actually hosting the site. Cloudflare's edge typically needs a few
  //     seconds after `wrangler pages deploy` exits before the per-deploy URL
  //     responds, so poll until we get a 2xx/3xx (or 60s timeout).
  const openUrl = deployUrl || 'https://financeplan-th.pages.dev';
  const live = await waitUntilLive(openUrl, { maxWaitMs: 60_000, intervalMs: 1500 });
  if (live) {
    console.log(`🟢 Server hosted — edge returned a response for ${openUrl}`);
  } else {
    console.warn(`⚠️  Timed out waiting for ${openUrl} to go live. Opening anyway.`);
  }
  openInChrome(openUrl);

  // 3. Fire notification emails
  console.log('\n[3/3] Sending deployment notification emails…\n');
  const notify = await run(
    process.execPath, // node
    [join(ROOT, 'scripts', 'send-deployment-email.js')],
    {
      env: {
        ...process.env,
        DEPLOYMENT_URL: deployUrl || 'https://financeplan-th.pages.dev',
      },
    }
  );

  if (notify.code === 0) {
    console.log('\n🎉 Deployment complete. Recipients notified.');
    process.exit(0);
  } else {
    console.warn('\n⚠️  Deployment succeeded but one or more emails failed to send.');
    console.warn('    Check GMAIL_APP_PASS (or RESEND_API_KEY) in .env.local,');
    console.warn('    and confirm `cd financial-planner && npm install` ran successfully.');
    // Exit non-zero so the calling .bat / CI does NOT treat this as fully green.
    process.exit(2);
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error in deploy pipeline:', err);
  process.exit(1);
});
