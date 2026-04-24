// scripts/vercel-multi-agent-deploy.mjs
import "dotenv/config";
import { runScout }    from "./agents/scout.mjs";
import { runBuilder }  from "./agents/builder.mjs";
import { runDeployer } from "./agents/deployer.mjs";
import { runVerifier } from "./agents/verifier.mjs";
import { runNotifier } from "./agents/notifier.mjs";
import { log } from "./agents/_shared.mjs";

const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY", "VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_ORG_ID",
  "GMAIL_USER", "GMAIL_APP_PASS", "NOTIFY_TO",
];

function halt(reason, stage, extra = {}) {
  log("orchestrator", { halt: true, stage, reason, ...extra });
  // Best-effort final email even on failure
  runNotifier({ ok: false, stage, reason, ...extra }).catch(() => {});
  process.exitCode = 1;
}

(async () => {
  for (const k of REQUIRED_ENV) {
    if (!process.env[k]) return halt(`Missing env: ${k}`, "preflight");
  }

  log("orchestrator", { stage: "start", model: "haiku-4.5", agents: 5 });

  const scout = await runScout({ cwd: process.cwd() });
  if (!scout.ok) return halt(scout.reason, "scout", scout);

  const build = await runBuilder(scout);
  if (!build.ok) return halt(build.reason, "builder", build);

  const deploy = await runDeployer(build);
  if (!deploy.ok) return halt(deploy.reason, "deployer", deploy);

  const verify = await runVerifier(deploy);
  if (!verify.ok) return halt(verify.reason, "verifier", { ...deploy, ...verify });

  const notify = await runNotifier({ ok: true, ...deploy, ...verify });
  log("orchestrator", { stage: "done", url: deploy.url, notified: notify.sent });
})().catch((e) => halt(String(e?.stack || e), "fatal"));
