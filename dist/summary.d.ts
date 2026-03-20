import { RunOptions } from "./types";
export declare function runSummary(options: RunOptions): Promise<void>;
export declare function listPRs(options: Pick<RunOptions, "since" | "until">): Promise<void>;
export declare function listAllPRs(options: Pick<RunOptions, "since" | "until">): Promise<void>;
//# sourceMappingURL=summary.d.ts.map