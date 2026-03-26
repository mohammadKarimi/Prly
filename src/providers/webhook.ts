import fetch from "node-fetch";
import { loadConfig } from "../config";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendToWebhook(existingText: string): Promise<void> {
  const config = loadConfig();
  const webhookUrl = config.integrations?.webhook?.url;

  if (!webhookUrl) {
    console.log(
      "⚠️  integrations.webhook.url is not set — skipping webhook. Add it to your config to enable.",
    );
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: existingText }),
  });

  if (!res.ok) {
    throw new Error(
      `Webhook request failed — ${res.status}: ${await res.text()}`,
    );
  }
}
