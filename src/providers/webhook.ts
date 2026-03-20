import fetch from "node-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Microsoft Teams MessageCard payload (Connector Card schema). */
interface TeamsMessageCard {
  "@type": "MessageCard";
  "@context": "http://schema.org/extensions";
  summary: string;
  themeColor: string;
  title: string;
  text: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Posts `summary` to the webhook URL configured in the `WEBHOOK_URL` env var.
 *
 * The payload is formatted as a Microsoft Teams MessageCard so it renders
 * natively in Teams channels, but any webhook that accepts a JSON POST will
 * receive the raw payload.
 *
 * Silently skips (logs a hint) when `WEBHOOK_URL` is not set.
 */
export async function sendToWebhook(summary: string): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      "⚠️  WEBHOOK_URL is not set — skipping webhook. Add it to your .env to enable.",
    );
    return;
  }

  const payload: TeamsMessageCard = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: "Daily PR Summary",
    themeColor: "0076D7",
    title: "🚀 Daily PR Summary",
    text: summary.replace(/\n/g, "<br>"),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      `Webhook request failed — ${res.status}: ${await res.text()}`,
    );
  }

  console.log("✅ Webhook notification sent.");
}
