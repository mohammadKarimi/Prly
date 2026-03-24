import fetch from "node-fetch";
import { loadConfig } from "../config";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * POSTs an Adaptive Card payload to the webhook URL configured in the config file.
 *
 * Pass the object returned by `summarizePRsAsAdaptiveCard` directly.
 * Silently skips (logs a hint) when `webhook.url` is not set.
 */
export async function sendToWebhook(card: object): Promise<void> {
  const config = loadConfig();
  const webhookUrl = config.webhook?.url;

  if (!webhookUrl) {
    console.log(
      "⚠️  webhook.url is not set — skipping webhook. Add it to your config to enable.",
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
