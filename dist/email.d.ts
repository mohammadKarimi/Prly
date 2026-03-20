/**
 * Sends `summary` as an HTML email via the configured SMTP transporter.
 *
 * Required env vars: `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`.
 * Optional env vars: `EMAIL_PORT` (default `587`), `EMAIL_SECURE` (default `false`).
 *
 * @param summary            Plain-text summary to send.
 * @param recipientOverride  Override the recipient; defaults to `EMAIL_USER`.
 */
export declare function sendEmail(summary: string, recipientOverride?: string): Promise<void>;
//# sourceMappingURL=email.d.ts.map