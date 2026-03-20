"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToWebhook = sendToWebhook;
const node_fetch_1 = __importDefault(require("node-fetch"));
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * POSTs an Adaptive Card payload to the webhook URL configured in the
 * `WEBHOOK_URL` env var.
 *
 * Pass the object returned by `summarizePRsAsAdaptiveCard` directly.
 * Silently skips (logs a hint) when `WEBHOOK_URL` is not set.
 */
async function sendToWebhook(card) {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
        console.log("⚠️  WEBHOOK_URL is not set — skipping webhook. Add it to your .env to enable.");
        return;
    }
    const res = await (0, node_fetch_1.default)(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
    });
    if (!res.ok) {
        throw new Error(`Webhook request failed — ${res.status}: ${await res.text()}`);
    }
    console.log("✅ Webhook notification sent.");
}
//# sourceMappingURL=webhook.js.map