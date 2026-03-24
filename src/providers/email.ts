import nodemailer from "nodemailer";
import { loadConfig } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_SUBJECT = "📦 Prly Summary";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(summary: string): string {
  return (
    `<h2>🚀 Prly Summary</h2>` +
    `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(summary)}</pre>`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends `summary` as an HTML email using the SMTP settings in the config file.
 *
 * The recipient(s) are taken from `config.email.reciever`; when omitted the
 * SMTP sender address (`config.email.smtp.user`) is used as a fallback.
 */
export async function sendEmail(summary: string): Promise<void> {
  const config = loadConfig();
  const smtp = config.email?.smtp;
  const user = smtp?.user;
  const pass = smtp?.pass;

  if (!user || !pass) {
    throw new Error(
      'Email SMTP credentials are not configured. Set "email.smtp.user" and "email.smtp.pass" in your config.',
    );
  }

  // Resolve recipient(s)
  const reciever = config.email?.reciever;
  const to = Array.isArray(reciever) ? reciever.join(", ") : (reciever ?? user);

  const port = smtp?.port ?? 587;
  const secure = smtp?.secure ?? false;

  const transporter = nodemailer.createTransport({
    host: smtp?.host,
    port,
    secure,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"Prly Bot" <${user}>`,
    to,
    subject: EMAIL_SUBJECT,
    text: summary,
    html: buildHtml(summary),
  });

  console.log(`✅ Email sent to ${to} (${info.messageId})`);
}
