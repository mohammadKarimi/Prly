# Prly

> **Summarize your daily merged pull requests with AI — for any GitHub repo.**

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mohammadKarimi/Prly)

Prly is a command-line tool that fetches merged PRs from a GitHub repository, optionally filters them to the modules you own, generates an AI-powered summary using OpenAI, and can email the result to you — all in a single command.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Configuration File](#configuration-file)
- [Commands](#commands)
  - [run](#run)
  - [list](#list)
  - [list-all](#list-all)
  - [config init](#config-init)
  - [config show](#config-show)
  - [config add-module](#config-add-module)
  - [config remove-module](#config-remove-module)
  - [config test](#config-test)
- [Examples](#examples)
- [GitHub Action](#github-action)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- Fetches all merged PRs from any GitHub repository within a configurable date range
- Filters PRs to only those that touch directories **you own** (your modules)
- Generates a structured, section-by-section AI analysis (Problem / Change / Result) via OpenAI
- Posts the result to a Microsoft Teams channel as a native **Adaptive Card** (version 1.4) via an incoming webhook
- Sends the summary as an HTML email via any SMTP server
- Works with a personal access token **or** the GitHub CLI (`gh auth login`) — no token setup required if you already use the CLI
- Config stored in a single JSON file in your home directory — nothing committed to the repo

---

## Prerequisites

| Requirement      | Version                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| Node.js          | ≥ 18                                                                         |
| npm              | ≥ 9                                                                          |
| GitHub token     | Personal access token **or** [GitHub CLI](https://cli.github.com/) logged in |
| OpenAI API key   | Required only for AI summarization (`--ai`)                                  |
| SMTP credentials | Required only for email (`--email`)                                          |
| Teams webhook    | Required only for webhook delivery (`--webhook`)                             |

---

## Installation

### From npm (recommended)

```bash
npm install -g @prly/prly
```

### From source

```bash
# Clone the repository
git clone https://github.com/mohammadKarimi/Prly.git
cd Prly

# Install dependencies
npm install

# Build
npm run build

# Link globally so the `prly` command is available everywhere
npm link
```

---

## Quick Start

```bash
# 1. Create your config interactively
prly config init

# 2. Set your secrets (add these to your shell profile for persistence)
export GITHUB_TOKEN=ghp_...
export OPENAI_API_KEY=sk-...
export EMAIL_USER=you@example.com
export EMAIL_PASS=your-smtp-password

# 3. Run a summary for yesterday's merged PRs
prly run
```

---

## Environment Variables

All secrets are provided via environment variables. Prly loads a `.env` file from the **current working directory** automatically (via `dotenv`), or you can export them in your shell profile.

| Variable              | Required               | Description                                                                                                 |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`        | Optional†              | GitHub personal access token with `repo` read scope. Falls back to `gh auth token` if not set.              |
| `OPENAI_API_KEY`      | Yes (`--ai`)           | OpenAI API key for generating summaries.                                                                    |
| `EMAIL_USER`          | Yes (with `--email`)   | SMTP username and the default sender/recipient address.                                                     |
| `EMAIL_PASS`          | Yes (with `--email`)   | SMTP password or app password.                                                                              |
| `EMAIL_HOST`          | No                     | SMTP host (e.g. `smtp.gmail.com`). Required when sending email.                                             |
| `EMAIL_PORT`          | No                     | SMTP port. Defaults to `587`.                                                                               |
| `EMAIL_SECURE`        | No                     | Set to `true` to use TLS (port 465). Defaults to `false`.                                                   |
| `WEBHOOK_URL`         | Yes (with `--webhook`) | Incoming webhook URL for Microsoft Teams. Create one via **Teams channel → Connectors → Incoming Webhook**. |
| `GITHUB_API_BASE_URL` | No                     | Override the GitHub API base URL (e.g. for GitHub Enterprise). Defaults to `https://api.github.com`.        |

† If `GITHUB_TOKEN` is not set, Prly will call `gh auth token` automatically. Run `gh auth login` once and you never need to manage a token manually.

**Example `.env` file:**

```dotenv
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
EMAIL_USER=you@example.com
EMAIL_PASS=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/...
```

---

## Configuration File

Prly stores non-secret configuration in `~/.prly.config.json`. Create or update it interactively with `prly config init`.

```jsonc
{
  "github": {
    "owner": "my-org", // GitHub organisation or username
    "repo": "my-repo", // Repository name
  },
  "myModules": [
    // Directory prefixes you own (optional)
    "src/features/auth",
    "libs/payments",
  ],
  "email": {
    "to": "team@example.com", // Recipient address (falls back to EMAIL_USER)
  },
  "llmOptions": {
    "outputLanguage": "English", // Language for the AI output, e.g. "Persian", "Spanish"
    "prompt": "...", // Custom system prompt sent to OpenAI
  },
}
```

`myModules` is the most important setting. When set, only PRs that touch at least one file inside those directories are included in the summary and email.

### `llmOptions`

| Field            | Description                                                                               | Default         |
| ---------------- | ----------------------------------------------------------------------------------------- | --------------- |
| `outputLanguage` | Natural language for the AI-generated summary, e.g. `"English"`, `"Persian"`, `"Spanish"` | `"English"`     |
| `prompt`         | Full system prompt sent to OpenAI. Omit to use the built-in release-notes prompt.         | Built-in prompt |

---

## Commands

### `run`

Fetch, filter, and summarize your PRs. Outputs and delivery channels are **opt-in** — nothing is sent unless you explicitly ask.

```
prly run [options]
```

| Option           | Description                                                               | Default   |
| ---------------- | ------------------------------------------------------------------------- | --------- |
| `--since <date>` | Start of the date range (`YYYY-MM-DD`)                                    | Yesterday |
| `--until <date>` | End of the date range (`YYYY-MM-DD`)                                      | Today     |
| `--ai`           | Generate an AI summary via OpenAI                                         | Off       |
| `--email`        | Send the summary by email                                                 | Off       |
| `--webhook`      | Build a Teams Adaptive Card with AI and post it to the configured webhook | Off       |
| `--verbose`      | Print each PR's changed files while filtering by modules                  | Off       |

---

### `list`

List PRs that touch your modules, without summarizing or emailing.

```
prly list [options]
```

| Option           | Description                            | Default   |
| ---------------- | -------------------------------------- | --------- |
| `--since <date>` | Start of the date range (`YYYY-MM-DD`) | Yesterday |
| `--until <date>` | End of the date range (`YYYY-MM-DD`)   | Today     |

---

### `list-all`

List **all** merged PRs in the repo with no module filter. Useful for debugging your module paths.

```
prly list-all [options]
```

| Option           | Description                            | Default   |
| ---------------- | -------------------------------------- | --------- |
| `--since <date>` | Start of the date range (`YYYY-MM-DD`) | Yesterday |
| `--until <date>` | End of the date range (`YYYY-MM-DD`)   | Today     |

---

### `config init`

Interactively create or update your config file (`~/.prly.config.json`).

```
prly config init
```

Prompts for GitHub owner, repo, email recipient, and module paths. Re-running this command preserves your existing values as defaults.

---

### `config show`

Print the current configuration as JSON.

```
prly config show
```

---

### `config add-module`

Add a directory path to your modules list without re-running the full wizard.

```
prly config add-module <path>
```

| Argument | Description                                       |
| -------- | ------------------------------------------------- |
| `<path>` | Directory prefix to add, e.g. `src/features/auth` |

---

### `config remove-module`

Remove a directory path from your modules list.

```
prly config remove-module <path>
```

| Argument | Description                |
| -------- | -------------------------- |
| `<path>` | Directory prefix to remove |

---

### `config test`

Verify that your GitHub token is valid and that Prly can reach the configured repository.

```
prly config test
```

---

## Examples

```bash
# List yesterday's PRs (no AI, no delivery)
prly run

# Summarize with AI only — inspect the output before wiring up delivery
prly run --ai

# Post an Adaptive Card to Teams (AI analyses PRs, card is built from that analysis)
prly run --ai --webhook

# Summarize a specific date range and email the result
prly run --since 2026-03-01 --until 2026-03-07 --ai --email

# Summarize this week and post to Teams only (no email)
prly run --since 2026-03-16 --ai --webhook

# Full delivery: AI summary + email + Teams Adaptive Card
prly run --ai --email --webhook

# Webhook-only (card generated directly from raw PR data, no separate text summary)
prly run --webhook

# See which files each PR touched while filtering
prly run --verbose

# Quick check of what merged yesterday (no outputs)
prly list

# See every merged PR (ignore module filter), useful when setting up modules
prly list-all --since 2026-03-01

# Add a new module path
prly config add-module src/billing

# Remove an old module path
prly config remove-module libs/legacy
```

---

## GitHub Action

Prly is available as a GitHub Action on the [Marketplace](https://github.com/marketplace/actions/prly-pr-summary). Drop it into any workflow to get automatic daily PR summaries posted to MS Teams, email, or a webhook — no extra tooling required.

### Minimal example

```yaml
# .github/workflows/daily-pr-summary.yml
name: Daily PR Summary

on:
  schedule:
    - cron: "0 9 * * 1-5" # weekdays at 09:00 UTC
  workflow_dispatch:

jobs:
  summary:
    runs-on: ubuntu-latest
    steps:
      - uses: mohammadKarimi/Prly@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-owner: my-org
          github-repo: my-repo
```

### Full example — AI summary posted to MS Teams as an Adaptive Card

```yaml
- uses: mohammadKarimi/Prly@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    github-owner: my-org
    github-repo: my-repo
    since: "2026-03-01"
    until: "2026-03-07"
    filter-modules: "src/features/auth,src/payments"
    ai: "true"
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    output-language: "English"
    ms-teams: "true"
    ms-teams-webhook-url: ${{ secrets.TEAMS_WEBHOOK_URL }}
    email: "true"
    email-receiver: "team@example.com"
    smtp-user: ${{ secrets.SMTP_USER }}
    smtp-pass: ${{ secrets.SMTP_PASS }}
    smtp-host: "smtp.gmail.com"
    smtp-port: "587"
    smtp-secure: "false"
```

### Action inputs

| Input                  | Required | Default                  | Description                                      |
| ---------------------- | -------- | ------------------------ | ------------------------------------------------ |
| `github-token`         | ✅       | —                        | GitHub token with `repo` read scope              |
| `github-owner`         | ✅       | —                        | GitHub org or user                               |
| `github-repo`          | ✅       | —                        | Repository name                                  |
| `github-api-base-url`  |          | `https://api.github.com` | Override for GitHub Enterprise                   |
| `since`                |          | yesterday                | Start date `YYYY-MM-DD`                          |
| `until`                |          | today                    | End date `YYYY-MM-DD`                            |
| `filter-modules`       |          | —                        | Comma-separated directory prefixes               |
| `ai`                   |          | `false`                  | Generate AI summary via OpenAI                   |
| `openai-api-key`       |          | —                        | Required when `ai: true`                         |
| `output-language`      |          | `English`                | Language for the AI output                       |
| `custom-prompt`        |          | —                        | Custom system prompt for OpenAI                  |
| `email`                |          | `false`                  | Send summary by email                            |
| `email-receiver`       |          | —                        | Recipient address(es), comma-separated           |
| `smtp-user`            |          | —                        | SMTP username / sender                           |
| `smtp-pass`            |          | —                        | SMTP password                                    |
| `smtp-host`            |          | —                        | SMTP host                                        |
| `smtp-port`            |          | `587`                    | SMTP port                                        |
| `smtp-secure`          |          | `false`                  | Use TLS                                          |
| `webhook`              |          | `false`                  | Post to a generic webhook URL                    |
| `webhook-url`          |          | —                        | Webhook URL                                      |
| `ms-teams`             |          | `false`                  | Post to MS Teams (Adaptive Card when `ai: true`) |
| `ms-teams-webhook-url` |          | —                        | MS Teams Incoming Webhook URL                    |

### Action outputs

| Output    | Description                                                |
| --------- | ---------------------------------------------------------- |
| `summary` | The generated PR summary text (usable in downstream steps) |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and create a feature branch: `git checkout -b feat/my-feature`
2. Install dependencies: `npm install`
3. Make your changes in `src/`
4. Build and verify: `npm run build`
5. Open a pull request with a clear description of the change

Please keep PRs focused — one feature or fix per PR.

---

## License

MIT © [Mohammad Karimi](https://github.com/mohammadKarimi)
