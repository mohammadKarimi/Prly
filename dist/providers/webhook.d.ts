/**
 * POSTs an Adaptive Card payload to the webhook URL configured in the
 * `WEBHOOK_URL` env var.
 *
 * Pass the object returned by `summarizePRsAsAdaptiveCard` directly.
 * Silently skips (logs a hint) when `WEBHOOK_URL` is not set.
 */
export declare function sendToWebhook(card: object): Promise<void>;
//# sourceMappingURL=webhook.d.ts.map