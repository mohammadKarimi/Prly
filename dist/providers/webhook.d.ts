/**
 * Posts `summary` to the webhook URL configured in the `WEBHOOK_URL` env var.
 *
 * The payload is formatted as a Microsoft Teams MessageCard so it renders
 * natively in Teams channels, but any webhook that accepts a JSON POST will
 * receive the raw payload.
 *
 * Silently skips (logs a hint) when `WEBHOOK_URL` is not set.
 */
export declare function sendToWebhook(summary: string): Promise<void>;
//# sourceMappingURL=webhook.d.ts.map