import { PullRequest } from "./types";
export declare function fetchMergedPRs(owner: string, repo: string, since: Date, until: Date): Promise<PullRequest[]>;
export declare function fetchPRFiles(owner: string, repo: string, prNumber: number): Promise<string[]>;
export declare function testConnection(owner: string, repo: string): Promise<void>;
//# sourceMappingURL=github.d.ts.map