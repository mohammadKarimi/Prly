/** Top-level Prly configuration stored in `~/.prly.config.json`. */
export interface Config {
    github: {
        owner: string;
        repo: string;
    };
    /** Directory paths you own, e.g. `["src/features/auth", "libs/ui"]`. */
    myModules: string[];
    email?: {
        /** Recipient address; falls back to the `EMAIL_USER` env var when omitted. */
        to?: string;
    };
    /** System prompt sent to OpenAI. Edit this to customise the summary style. */
    openAiPrompt?: string;
}
/** A pull request as returned by the GitHub REST API. */
export interface PullRequest {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    merged_at: string | null;
    user: {
        login: string;
    };
    /**
     * Changed file paths, populated after calling `fetchPRFiles`.
     * Not part of the raw GitHub API response.
     */
    changedFiles?: string[];
}
/** A single file entry inside a pull request (GitHub REST API). */
export interface PullRequestFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
}
/** Options accepted by `runSummary`. */
export interface RunOptions {
    since?: string;
    until?: string;
    /** When `false`, the email step is skipped. */
    email: boolean;
    /** When `false`, the OpenAI summarization step is skipped. */
    ai: boolean;
    /** Print each PR's changed files while filtering by modules. */
    verbose?: boolean;
}
/** An inclusive, fully-resolved date window. */
export interface DateRange {
    since: Date;
    until: Date;
}
//# sourceMappingURL=types.d.ts.map