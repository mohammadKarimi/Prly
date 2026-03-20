export interface Config {
  github: {
    owner: string;
    repo: string;
  };
  /** Directory paths you own, e.g. ["src/features/auth", "libs/ui"] */
  myModules: string[];
  email?: {
    /** Recipient address; falls back to EMAIL_USER env var */
    to?: string;
  };
  /** System prompt sent to OpenAI. Edit this to customise the summary style. */
  openAiPrompt?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  user: { login: string };
  /** Populated after fetching PR files — not part of the GitHub API response */
  changedFiles?: string[];
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface RunOptions {
  since?: string;
  until?: string;
  email: boolean;
  ai: boolean;
  verbose?: boolean;
}
