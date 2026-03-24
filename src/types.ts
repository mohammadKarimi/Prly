/** Top-level Prly configuration stored in `~/.prly.config.json`. */
export interface Config {
  github: {
    owner: string;
    repo: string;
    token?: string;
    apiBaseUrl?: string;
    filterModules: string[];
  };
  openai?: {
    apiKey?: string;
  };
  email?: {
    smtp?: {
      user?: string;
      pass?: string;
      host?: string;
      port?: number;
      secure?: boolean;
    };
    reciever?: string | string[]; // Email address or addresses to send the summary to. Falls back to `EMAIL_TO` env var.
  };
  webhook?: {
    url?: string;
  };
  llmOptions?: {
    /** System prompt sent to OpenAI. Edit this to customise the summary style. */
    prompt?: string;
    /**
     * Language for the AI-generated summary, e.g. `"English"`, `"Persian"`, `"Spanish"`.
     * Defaults to `"English"` when omitted.
     */
    outputLanguage?: string;
  };
}

/** A pull request as returned by the GitHub REST API. */
export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  user: { login: string };
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
  /** When `true`, the OpenAI summarization step is run. */
  ai: boolean;
  /** When `true`, the summary is sent by email. */
  email: boolean;
  /** When `true`, the summary is posted to the configured webhook. */
  webhook: boolean;
  /** Print each PR's changed files while filtering by modules. */
  verbose?: boolean;
}

/** An inclusive, fully-resolved date window. */
export interface DateRange {
  since: Date;
  until: Date;
}
