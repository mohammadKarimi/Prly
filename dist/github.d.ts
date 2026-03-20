import { PullRequest } from "./types";
/**
 * Fetches all merged pull requests for `owner/repo` within the given date range.
 * Paginates automatically until no pages remain or the oldest PR on a page
 * predates `since`.
 */
export declare function fetchMergedPRs(owner: string, repo: string, since: Date, until: Date): Promise<PullRequest[]>;
/** Returns the list of file paths changed in pull request `prNumber`. */
export declare function fetchPRFiles(owner: string, repo: string, prNumber: number): Promise<string[]>;
/**
 * Runs three diagnostic checks and exits with code 1 on the first failure:
 * 1. Token validity (`GET /user`)
 * 2. OAuth scopes
 * 3. Repository accessibility (`GET /repos/:owner/:repo`)
 */
export declare function testConnection(owner: string, repo: string): Promise<void>;
//# sourceMappingURL=github.d.ts.map