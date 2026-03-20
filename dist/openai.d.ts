import { PullRequest } from "./types";
/**
 * Sends `prs` to OpenAI and streams the resulting summary to stdout.
 * Returns the full summary text once the stream is complete.
 *
 * Requires the `OPENAI_API_KEY` environment variable.
 */
export declare function summarizePRs(prs: PullRequest[]): Promise<string>;
//# sourceMappingURL=openai.d.ts.map