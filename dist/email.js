"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function sendEmail(summary, recipientOverride) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) {
        throw new Error("EMAIL_USER and EMAIL_PASS environment variables must be set.");
    }
    const to = recipientOverride || user;
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);
    const secure = process.env.EMAIL_SECURE === "true";
    const transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });
    const html = `
    <h2>🚀 Prly Summary</h2>
    <pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(summary)}</pre>
  `;
    const info = await transporter.sendMail({
        from: `"Prly Bot" <${user}>`,
        to,
        subject: "📦 Prly Summary",
        text: summary,
        html,
    });
    console.log(`✅ Email sent to ${to} (${info.messageId})`);
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
//# sourceMappingURL=email.js.map