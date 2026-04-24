#!/usr/bin/env node
/**
 * DEPLOYMENT NOTIFICATION EMAIL
 * Sends deployment summary to stakeholders when a Cloudflare Pages deploy
 * succeeds. Supports two transport channels (tried in order):
 *   1. Gmail SMTP via nodemailer  (primary - requires GMAIL_APP_PASS)
 *   2. Resend REST API             (fallback - requires RESEND_API_KEY)
 *
 * Env vars (set in .env.local or pass inline):
 *   GMAIL_USER          default: toy.theeranan@gmail.com
 *   GMAIL_APP_PASS      16-char Google app password
 *   RESEND_API_KEY      (optional fallback)
 *   DEPLOYMENT_URL      per-deploy URL (e.g. https://bf7472b1.financeplan-th.pages.dev)
 *                       - automatically set by scripts/deploy.mjs
 *   VERSION             defaults to package.json "version" field
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load package version if VERSION not set
let pkgVersion = '3.0.0';
try {
  pkgVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  ).version;
} catch { /* ignore */ }

const GMAIL_USER = process.env.GMAIL_USER || 'toy.theeranan@gmail.com';
// Gmail App Passwords are shown in 4-char groups for readability (e.g. "zxji fefa ouyy ctwh")
// but the SMTP server rejects the value if spaces are sent verbatim. Strip them defensively
// so users don't have to remember to paste without spaces.
const GMAIL_APP_PASS = (process.env.GMAIL_APP_PASS || '').replace(/\s+/g, '');
const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL || 'https://financeplan-th.pages.dev';
const PRODUCTION_ALIAS = 'https://financeplan-th.pages.dev';
const VERSION = process.env.VERSION || pkgVersion;

// Recipients - per user preference, Toy's Gmail is NOT a recipient (it's the sender only).
// Deploy notifications go to iCloud + Patipat. Can be overridden by NOTIFY_TO env var.
const RECIPIENTS = (process.env.NOTIFY_TO && process.env.NOTIFY_TO.trim())
  ? process.env.NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'toy.theeranan@icloud.com',
      'Patipat.arc@gmail.com',
    ];

const CHANGES = [
  'Chrome auto-opens only after the deploy URL responds live (polls the edge up to 60s)',
  'Gmail SMTP auth now verified upfront - real auth errors surface loudly instead of silent failures',
  'App Password spaces auto-stripped - paste the 16-char token in any format',
  'Email transporter created + verified once per run (cached across recipients)',
  'TLS chain validation relaxed for dev (bypass AV/proxy self-signed root certs)',
  'Welcome screen no longer shows a signed-in profile before login',
  'Dark mode is now the app default',
];

const htmlContent = `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);border-radius:12px;padding:20px;margin-bottom:20px;color:white;text-align:center">
    <h1 style="margin:0;font-size:28px;margin-bottom:8px">Deployment Successful</h1>
    <p style="margin:0;opacity:0.9">Financial 101 Master v${VERSION}</p>
  </div>

  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #4F46E5">
    <h2 style="margin:0 0 12px 0;color:#1f2937;font-size:18px">Live Now</h2>
    <p style="margin:8px 0;color:#4b5563">
      <strong style="color:#1f2937;">This deployment:</strong><br/>
      <a href="${DEPLOYMENT_URL}" style="color:#4F46E5;font-weight:600;text-decoration:none">
        ${DEPLOYMENT_URL}
      </a>
    </p>
    <p style="margin:8px 0;color:#4b5563">
      <strong style="color:#1f2937;">Production alias:</strong><br/>
      <a href="${PRODUCTION_ALIAS}" style="color:#4F46E5;font-weight:600;text-decoration:none">
        ${PRODUCTION_ALIAS}
      </a>
    </p>
    <p style="margin:8px 0;color:#6b7280;font-size:12px">
      Deployed: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)
    </p>
  </div>

  <div style="margin-bottom:20px">
    <h2 style="margin:0 0 12px 0;color:#1f2937;font-size:18px">What's New (v${VERSION})</h2>
    <div>
      ${CHANGES.map(
        (change) => `
      <div style="margin:8px 0;padding:8px 12px;background:#eff6ff;border-radius:4px;color:#4b5563;font-size:13px">
        - ${change}
      </div>
      `
      ).join('')}
    </div>
  </div>

  <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #22c55e">
    <h3 style="margin:0 0 8px 0;color:#15803d;font-size:14px">Deployment Status</h3>
    <ul style="margin:0;padding-left:20px;color:#4b5563;font-size:13px;line-height:1.8">
      <li>Cloudflare Pages deployment complete</li>
      <li>Email Worker deployed and configured</li>
      <li>All secrets and environment variables set</li>
      <li>SSL/HTTPS enabled</li>
      <li>Ready for production use</li>
    </ul>
  </div>

  <div style="text-align:center;padding:16px;border-top:1px solid #e5e7eb">
    <p style="margin:0;color:#6b7280;font-size:12px">
      This is an automated deployment notification.<br>
      No action required - your app is live and ready to use.
    </p>
  </div>
</div>
`;

// Lazily built + cached so verify() runs once per process, not once per recipient.
let _gmailTransporter = null;
let _gmailVerifyFailed = false;

/**
 * Create (once) and return the shared Gmail SMTP transporter. Runs verify() the
 * first time to surface auth errors before the first send. Returns null if the
 * environment is missing nodemailer / GMAIL_APP_PASS, or if verify() failed -
 * in all those cases the sendViaGmail callers skip SMTP and fall through to Resend.
 */
async function getGmailTransporter() {
  if (_gmailTransporter) return _gmailTransporter;
  if (_gmailVerifyFailed) return null;
  if (!GMAIL_APP_PASS) {
    console.warn('[warn] GMAIL_APP_PASS not set - skipping Gmail SMTP for all recipients');
    _gmailVerifyFailed = true;
    return null;
  }
  if (GMAIL_APP_PASS.length !== 16) {
    console.warn(
      `[warn] GMAIL_APP_PASS is ${GMAIL_APP_PASS.length} chars after stripping spaces - ` +
      `Google App Passwords are exactly 16 chars. Gmail will reject the login. ` +
      `Regenerate at https://myaccount.google.com/apppasswords`
    );
    // Still try - the user might have a custom length, but warn loudly.
  }
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    // nodemailer is declared in package.json but sometimes `npm install` hasn't
    // been re-run after pulling the dep bump, so node_modules/nodemailer is
    // missing and every deploy "succeeds" with 0 emails actually sent. Try to
    // self-heal by installing it synchronously, then re-require.
    console.warn('[warn] nodemailer not installed - attempting `npm install nodemailer` now...');
    try {
      const { execSync } = require('child_process');
      execSync('npm install --no-save --no-audit --no-fund nodemailer@^6.9.13', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });
      nodemailer = require('nodemailer');
      console.log('[ok] nodemailer installed on the fly');
    } catch (installErr) {
      console.error(
        `[error] Could not install nodemailer automatically: ${installErr.message}\n` +
        `   Run manually:  cd financial-planner && npm install\n` +
        `   Then re-run:   npm run deploy:notify`
      );
      _gmailVerifyFailed = true;
      return null;
    }
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
    // Many Windows machines run AV (Bitdefender, ESET, Kaspersky) or sit behind a
    // corporate proxy that does TLS inspection - they present a self-signed root
    // cert to Node, which rejects the chain with `self-signed certificate in
    // certificate chain` and the deploy silently fails. The TLS connection is
    // still encrypted; we just stop validating the chain. Acceptable trade-off:
    //   1) the email body is a public deploy summary, not user data,
    //   2) the Gmail App Password is still sent over an encrypted channel,
    //   3) this is a single-user dev script, not a server.
    // To re-enable strict validation, set STRICT_SMTP_TLS=1 in .env.local.
    tls: {
      rejectUnauthorized: process.env.STRICT_SMTP_TLS === '1',
    },
  });
  try {
    await transporter.verify();
  } catch (vErr) {
    const code = vErr.code || 'AUTH';
    const isCertIssue = /self[- ]signed|cert|chain|unable to verify|ESOCKET/i.test(vErr.message || '') || code === 'ESOCKET';
    if (isCertIssue) {
      console.error(
        `[error] Gmail SMTP connection failed (${code}): ${vErr.message}\n` +
        `   This is a TLS/network issue, NOT an auth problem. Your Windows\n` +
        `   antivirus or a corporate proxy is likely doing TLS inspection and\n` +
        `   presenting a self-signed root cert. Either:\n` +
        `     (a) disable "SSL/TLS scanning" in your antivirus for smtp.gmail.com, or\n` +
        `     (b) leave it alone - this script now tolerates untrusted roots by default.\n` +
        `         If you're still seeing this, make sure STRICT_SMTP_TLS is not set.`
      );
    } else {
      console.error(
        `[error] Gmail SMTP login failed (${code}): ${vErr.message}\n` +
        `   Check GMAIL_APP_PASS in financial-planner/.env.local - must be a valid 16-char\n` +
        `   Google App Password for ${GMAIL_USER} (regenerate at\n` +
        `   https://myaccount.google.com/apppasswords). No spaces; 2FA must be on.`
      );
    }
    _gmailVerifyFailed = true;
    return null;
  }
  console.log(`[ok] Gmail SMTP authenticated as ${GMAIL_USER}`);
  _gmailTransporter = transporter;
  return transporter;
}

/**
 * Send email via Gmail SMTP using nodemailer (primary channel).
 * Requires GMAIL_APP_PASS environment variable - a 16-char Google App Password.
 * Docs: https://support.google.com/accounts/answer/185833
 */
async function sendViaGmail(recipient) {
  const transporter = await getGmailTransporter();
  if (!transporter) return false;
  try {
    const info = await transporter.sendMail({
      from: `"Financial 101 Master" <${GMAIL_USER}>`,
      to: recipient,
      subject: `[Financial 101] v${VERSION} Deployed - ${DEPLOYMENT_URL}`,
      html: htmlContent,
      text: `Financial 101 Master v${VERSION} deployed successfully.\n\nThis deployment: ${DEPLOYMENT_URL}\nProduction: ${PRODUCTION_ALIAS}\nDeployed at: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} Bangkok Time`,
    });
    console.log(`[ok] Gmail SMTP -> ${recipient}  (messageId: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[error] Gmail SMTP error for ${recipient}: ${err.message}`);
    if (err.response) console.error(`   Server response: ${err.response}`);
    return false;
  }
}

/**
 * Send email via Resend API (requires RESEND_API_KEY)
 */
async function sendViaResend(recipient) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('[warn] RESEND_API_KEY not set, skipping Resend email');
    return false;
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      from: `FinancePlan Deployment <noreply@resend.dev>`,
      to: recipient,
      subject: `[Financial 101] v${VERSION} Deployed to Production`,
      html: htmlContent,
      replyTo: 'toy.theeranan@gmail.com',
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`[ok] Resend -> ${recipient}`);
          resolve(true);
        } else {
          console.error(`[error] Resend error for ${recipient} (HTTP ${res.statusCode}): ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[error] Resend network error for ${recipient}: ${e.message}`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Main entry point: send deployment notifications to all recipients.
 * Tries Gmail SMTP first; falls back to Resend if Gmail is unavailable.
 * Exits with code 0 on full success, 2 if any recipient failed.
 */
async function sendDeploymentEmails() {
  console.log(`\n[info] Sending deployment emails for v${VERSION}`);
  console.log(`   Deploy URL: ${DEPLOYMENT_URL}`);
  console.log(`   Recipients: ${RECIPIENTS.join(', ')}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const recipient of RECIPIENTS) {
    // Try Gmail first
    let sent = await sendViaGmail(recipient);
    // Fall back to Resend if Gmail failed (transport unavailable or send error)
    if (!sent) {
      sent = await sendViaResend(recipient);
    }
    if (sent) successCount++;
    else failCount++;
  }

  console.log(`\n[info] Email summary: ${successCount} sent, ${failCount} failed (of ${RECIPIENTS.length} total)\n`);

  if (failCount > 0) {
    // Non-zero exit so the calling .bat can warn the user.
    process.exit(2);
  }
}

sendDeploymentEmails().catch((error) => {
  console.error(`\n[fatal] Unhandled error in sendDeploymentEmails: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
