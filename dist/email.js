"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
// ─── Constants ────────────────────────────────────────────────────────────────
const EMAIL_SUBJECT = "📦 Prly Summary";
// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function buildHtml(summary) {
    return (`<h2>🚀 Prly Summary</h2>` +
        `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(summary)}</pre>`);
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Sends `summary` as an HTML email via the configured SMTP transporter.
 *
 * Required env vars: `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`.
 * Optional env vars: `EMAIL_PORT` (default `587`), `EMAIL_SECURE` (default `false`).
 *
 * @param summary            Plain-text summary to send.
 * @param recipientOverride  Override the recipient; defaults to `EMAIL_USER`.
 */
async function sendEmail(summary, recipientOverride) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) {
        throw new Error("EMAIL_USER and EMAIL_PASS environment variables must be set.");
    }
    const to = recipientOverride ?? user;
    const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);
    const secure = process.env.EMAIL_SECURE === "true";
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.EMAIL_HOST,
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
//# sourceMappingURL=email.js.map