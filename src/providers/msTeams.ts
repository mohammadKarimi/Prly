import fetch from "node-fetch";
import { loadConfig } from "../config";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Posts `summary` to a Microsoft Teams channel via an Incoming Webhook.
 * Uses the Teams MessageCard format which works with all Teams tenants.
 *
 * Requires `msTeams.webhookUrl` to be set in the config.
 */
export async function sendToMsTeams(summary: string): Promise<void> {
  const config = loadConfig();
  const webhookUrl = config.integrations?.msTeams?.webhookUrl;

  if (!webhookUrl) {
    console.log(
      "⚠️  integrations.msTeams.webhookUrl is not set — skipping MS Teams notification. Add it to your config to enable.",
    );
    return;
  }

  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: "PR Summary",
    themeColor: "0076D7",
    sections: [
      {
        activityTitle: "📋 PR Summary",
        text: summary,
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      `MS Teams webhook request failed — ${res.status}: ${await res.text()}`,
    );
  }
}

/**
 * Posts a pre-built Adaptive Card JSON object to a Microsoft Teams channel
 * via an Incoming Webhook.
 *
 * Requires `integrations.msTeams.webhookUrl` to be set in the config.
 */
export async function sendAdaptiveCardToMsTeams(card: object): Promise<void> {
  const config = loadConfig();
  const webhookUrl = config.integrations?.msTeams?.webhookUrl;

  if (!webhookUrl) {
    console.log(
      "⚠️  integrations.msTeams.webhookUrl is not set — skipping MS Teams notification. Add it to your config to enable.",
    );
    return;
  }

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: card,
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      `MS Teams Adaptive Card request failed — ${res.status}: ${await res.text()}`,
    );
  }
}
