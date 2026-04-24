/**
 * LOCAL EMAIL NOTIFIER — runs on port 3001 alongside Next.js
 * Financial 101 Master - Enhanced Email System with Beautiful Templates
 * Uses Gmail App Password via nodemailer (no OAuth needed).
 *
 * Config via environment variables (set in .env.local):
 *   GMAIL_USER     = toy.theeranan@gmail.com
 *   GMAIL_APP_PASS = xxxx xxxx xxxx xxxx  (16-char app password from Google)
 *   NOTIFY_TO      = toy.theeranan@icloud.com,patipat.arc@gmail.com (comma-separated)
 */

const http = require("http");
const https = require("https");

const PORT = 3001;
const GMAIL_USER  = process.env.GMAIL_USER     || "";
const GMAIL_PASS  = process.env.GMAIL_APP_PASS  || "";
const NOTIFY_TO   = process.env.NOTIFY_TO       || "toy.theeranan@icloud.com,patipat.arc@gmail.com";

if (!GMAIL_USER || !GMAIL_PASS) {
  console.log("[notify] WARNING: GMAIL_USER or GMAIL_APP_PASS not set — emails will be skipped.");
}

// Parse multiple email recipients
function getRecipients() {
  return NOTIFY_TO.split(',').map(e => e.trim()).filter(e => e.length > 0);
}

/** Send email via Gmail SMTP using nodemailer */
async function sendEmail(subject, html, text, toRecipient) {
  if (!GMAIL_USER || !GMAIL_PASS) return;
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Financial 101 Master" <${GMAIL_USER}>`,
      to: toRecipient || NOTIFY_TO,
      subject,
      html,
      text,
    });
    console.log(`[notify] Email sent to ${toRecipient || NOTIFY_TO}`);
  } catch (err) {
    console.error("[notify] Email error:", err.message);
  }
}

/** Enhanced HTML email template with styled button */
function buildEmailTemplate(type, data) {
  const appUrl = data.appUrl || "https://financeplan-th.pages.dev";

  const templates = {
    login: () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Financial 101 Master</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Login Alert</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1f2937; font-size: 24px; margin-top: 0;">Welcome Back!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">You have successfully logged in to Financial 101 Master.</p>

      <div style="background-color: #eff6ff; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #4F46E5;">Account:</strong> ${data.user || "Unknown"}<br>
        <strong style="color: #4F46E5;">Email:</strong> ${data.email || ""}<br>
        <strong style="color: #4F46E5;">Time:</strong> ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
      </div>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${appUrl}/profile" style="display: inline-block; padding: 12px 32px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Account Settings</a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">If this wasn't you, please change your password immediately.</p>
    </div>
    <div style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
        © 2026 Financial 101 Master. All rights reserved.
      </p>
      <p style="margin: 8px 0;">
        <a href="${appUrl}" style="color: #4F46E5; text-decoration: none;">Visit App</a> |
        <a href="mailto:toy.theeranan@gmail.com" style="color: #4F46E5; text-decoration: none;">Support</a>
      </p>
    </div>
  </div>
</body>
</html>`,

    account_switch: () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Financial 101 Master</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Account Switched</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1f2937; font-size: 24px; margin-top: 0;">Account Switched Successfully</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">You have switched to a different Financial 101 Master account.</p>

      <div style="background-color: #eff6ff; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #4F46E5;">From:</strong> ${data.fromUser || "Unknown"}<br>
        <strong style="color: #4F46E5;">To:</strong> ${data.toUser || "Unknown"}<br>
        <strong style="color: #4F46E5;">Time:</strong> ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
      </div>

      <p style="color: #4b5563; font-size: 16px;">Your data is isolated and secure. Only the active account can access your financial information.</p>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${appUrl}/profile" style="display: inline-block; padding: 12px 32px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Your Account</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
        Keep your accounts separate, keep your data secure.
      </p>
    </div>
  </div>
</body>
</html>`,

    sync_complete: () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✓ Backup Complete</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Financial 101 Master Data Synced</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1f2937; font-size: 24px; margin-top: 0;">Your Data Has Been Backed Up</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Your Financial 101 Master data has been securely backed up to Google Drive.</p>

      <div style="background-color: #eff6ff; border-left: 4px solid #10B981; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #059669;">Account:</strong> ${data.account || "Unknown"}<br>
        <strong style="color: #059669;">Backup Time:</strong> ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}<br>
        <strong style="color: #059669;">Total Backups:</strong> ${data.backupCount || "N/A"}
      </div>

      <p style="color: #4b5563; font-size: 16px;">Your data is securely stored in Google Drive with automatic versioning. You can restore any previous version at any time.</p>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${appUrl}/settings?tab=backup" style="display: inline-block; padding: 12px 32px; background-color: #10B981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Backups</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
        Your financial data is backed up and protected.
      </p>
    </div>
  </div>
</body>
</html>`,
  };

  return templates[type] ? templates[type]() : "";
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST" || req.url !== "/notify") {
    res.writeHead(404); res.end("Not found"); return;
  }

  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const type = data.type || "login";
      const subject = data.subject || `[Financial 101 Master] ${type === "login" ? "Login Alert" : type === "account_switch" ? "Account Switched" : "Google Drive Backup"}`;
      const html = buildEmailTemplate(type, data);

      // Send to all configured recipients
      const recipients = getRecipients();
      for (const recipient of recipients) {
        await sendEmail(subject, html, "", recipient);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, sent_to: recipients }));
    } catch (e) {
      res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[notify] Financial 101 Master Email Notifier running on http://localhost:${PORT}/notify`);
  console.log(`[notify] From: ${GMAIL_USER}`);
  console.log(`[notify] To: ${getRecipients().join(", ")}`);
  console.log(`[notify] Template types: login, account_switch, sync_complete`);
});
