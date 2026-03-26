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
- [Secrets & Credentials](#secrets--credentials)
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
- Posts the result to a **Microsoft Teams** channel as a native **Adaptive Card** (version 1.4) via `--ms-teams`
- Posts the summary to any **generic webhook** endpoint via `--webhook` (e.g. Slack-compatible incoming webhooks)
- Sends the summary as an HTML email via any SMTP server via `--email`
- Works with a personal access token **or** the GitHub CLI (`gh auth login`) — no token setup required if you already use the CLI
- All configuration — including secrets — stored in a single JSON file in your home directory; nothing committed to the repo

---

## Prerequisites

| Requirement       | Version                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| Node.js           | ≥ 18                                                                         |
| npm               | ≥ 9                                                                          |
| GitHub token      | Personal access token **or** [GitHub CLI](https://cli.github.com/) logged in |
| OpenAI API key    | Required only for AI summarization (`--ai`)                                  |
| SMTP credentials  | Required only for email (`--email`)                                          |
| Teams webhook URL | Required only for MS Teams delivery (`--ms-teams`)                           |
| Webhook URL       | Required only for generic webhook delivery (`--webhook`)                     |

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
# 1. Create your config and enter all credentials interactively
#    (GitHub token, OpenAI key, SMTP settings, Teams/webhook URLs)
prly config init

# 2. Run a summary for yesterday's merged PRs
prly run

# 3. Add AI summarization and post to MS Teams
prly run --ai --ms-teams
```

> All secrets (GitHub token, OpenAI key, SMTP password, webhook URLs) are collected by `prly config init` and stored in `~/.prly.config.json`. No environment variables are required.

---

## Secrets & Credentials

Prly stores all secrets inside `~/.prly.config.json`. Run `prly config init` to enter them interactively — the wizard walks you through every credential and saves them to the config file.

| Credential           | Config key                        | When needed  |
| -------------------- | --------------------------------- | ------------ |
| GitHub token         | `github.token`                    | Always†      |
| OpenAI API key       | `openai.apiKey`                   | `--ai`       |
| SMTP user / sender   | `integrations.email.smtp.user`    | `--email`    |
| SMTP password        | `integrations.email.smtp.pass`    | `--email`    |
| SMTP host            | `integrations.email.smtp.host`    | `--email`    |
| MS Teams webhook URL | `integrations.msTeams.webhookUrl` | `--ms-teams` |
| Generic webhook URL  | `integrations.webhook.url`        | `--webhook`  |

† If `github.token` is not set in the config, Prly calls `gh auth token` automatically. Run `gh auth login` once and you never need to manage a token manually.

---

## Configuration File

Prly stores all configuration — including secrets — in `~/.prly.config.json`. Create or update it interactively with `prly config init`.

```jsonc
{
  "github": {
    "owner": "my-org", // GitHub organisation or username
    "repo": "my-repo", // Repository name
    "token": "ghp_...", // Optional: falls back to gh CLI
    "apiBaseUrl": "https://api.github.com", // Optional: override for GitHub Enterprise
    "filterModules": [
      // Directory prefixes you own (optional filter)
      "src/features/auth",
      "libs/payments",
    ],
  },
  "openai": {
    "apiKey": "sk-...", // Required for --ai
  },
  "integrations": {
    "email": {
      "reciever": "team@example.com", // or ["a@b.com", "c@d.com"]
      "smtp": {
        "user": "you@example.com",
        "pass": "your-app-password",
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
      },
    },
    "msTeams": {
      "webhookUrl": "https://your-org.webhook.office.com/webhookb2/...",
    },
    "webhook": {
      "url": "https://your-endpoint.example.com/hook",
    },
  },
  "llmOptions": {
    "outputLanguage": "English", // Language for the AI output
    "prompt": "...", // Optional: custom system prompt for OpenAI
  },
}
```

`github.filterModules` is the most important setting. When set, only PRs that touch at least one file inside those directories are included in the summary and deliveries.

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

| Option           | Description                                                                                            | Default   |
| ---------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| `--since <date>` | Start of the date range (`YYYY-MM-DD`)                                                                 | Yesterday |
| `--until <date>` | End of the date range (`YYYY-MM-DD`)                                                                   | Today     |
| `--ai`           | Generate an AI summary via OpenAI                                                                      | Off       |
| `--email`        | Send the summary by email                                                                              | Off       |
| `--ms-teams`     | Post to MS Teams — sends a rich Adaptive Card when combined with `--ai`, otherwise a plain MessageCard | Off       |
| `--webhook`      | POST the summary as JSON to the configured generic webhook URL                                         | Off       |
| `--verbose`      | Print each PR's changed files while filtering by modules                                               | Off       |

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

# Post a rich Adaptive Card to MS Teams (AI analyses PRs, card is built from that analysis)
prly run --ai --ms-teams

# Post to MS Teams without AI (sends a plain MessageCard)
prly run --ms-teams

# POST summary JSON to a generic webhook (e.g. a Slack-compatible incoming webhook)
prly run --webhook

# Summarize a specific date range and email the result
prly run --since 2026-03-01 --until 2026-03-07 --ai --email

# Summarize this week and post to Teams only (no email)
prly run --since 2026-03-16 --ai --ms-teams

# Full delivery: AI summary + email + MS Teams Adaptive Card + generic webhook
prly run --ai --email --ms-teams --webhook

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
