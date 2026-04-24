// scripts/agents/notifier.mjs
import nodemailer from "nodemailer";
import { callAgent, log } from "./_shared.mjs";

const SYSTEM = `You are NOTIFIER, a concise release-email drafter. Input JSON
describes a Vercel deploy attempt. Output:
- subject: 1 line, prefix "[Financial 101]" then either "DEPLOY OK vX.Y.Z @ <sha>"
  or "DEPLOY FAIL (<stage>)".
- html: small HTML (h2 + ul + a tag). Include version, commitSha, url (if present),
  and for fail include the reason. Do not include secrets.
Keep under 1500 chars of html.`;

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    html:    { type: "string" },
  },
  required: ["subject", "html"],
};

export async function runNotifier(facts) {
  const draft = await callAgent({ system: SYSTEM, userJson: facts, schema: SCHEMA, maxTokens: 800 });

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });

  const recipients = (process.env.NOTIFY_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((addr) => addr.toLowerCase() !== (process.env.GMAIL_USER || "").toLowerCase());

  if (recipients.length === 0) {
    log("notifier", { sent: false, reason: "no recipients after filtering sender" });
    return { sent: false };
  }

  await transport.sendMail({
    from: `"Financial 101 Deploy" <${process.env.GMAIL_USER}>`,
    to: recipients.join(", "),
    subject: draft.subject,
    html: draft.html,
  });

  log("notifier", { sent: true, to: recipients, subject: draft.subject });
  return { sent: true, to: recipients };
}
