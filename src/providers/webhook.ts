import fetch from "node-fetch";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * POSTs an Adaptive Card payload to the webhook URL configured in the
 * `WEBHOOK_URL` env var.
 *
 * Pass the object returned by `summarizePRsAsAdaptiveCard` directly.
 * Silently skips (logs a hint) when `WEBHOOK_URL` is not set.
 */
export async function sendToWebhook(card: object): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      "⚠️  WEBHOOK_URL is not set — skipping webhook. Add it to your .env to enable.",
    );
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    throw new Error(
      `Webhook request failed — ${res.status}: ${await res.text()}`,
    );
  }

  console.log("✅ Webhook notification sent.");
}
