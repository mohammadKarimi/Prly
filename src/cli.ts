#!/usr/bin/env node

import { Command } from "commander";
import { runSummary, listPRs, listAllPRs } from "./commands/summary";
import {
  initConfig,
  loadConfig,
  addModule,
  removeModule,
  configPath,
} from "./config";
import { version } from "../package.json";

// ─── Command: run ─────────────────────────────────────────────────────────────

function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Fetch, filter, and summarize your PRs")
    .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
    .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
    .option("--ai", "Generate an AI summary via OpenAI")
    .option("--email", "Send the summary by email")
    .option("--webhook", "Post the summary to the configured webhook")
    .option("--ms-teams", "Post the summary to the configured MS Teams channel")
    .option(
      "--verbose",
      "Show every PR's changed files during module filtering",
    )
    .option(
      "--diff",
      "Include per-file code diffs in the AI prompt (requires --ai)",
    )
    .action(async (opts) => {
      await runSummary({
        since: opts.since,
        until: opts.until,
        ai: !!opts.ai,
        email: !!opts.email,
        webhook: !!opts.webhook,
        msTeams: !!opts.msTeams,
        verbose: !!opts.verbose,
        diff: !!opts.diff,
      });
    });
}

// ─── Command: list ────────────────────────────────────────────────────────────

function registerListCommand(program: Command): void {
  program
    .command("list")
    .description(
      "List your PRs (filtered by modules) without summarizing or emailing",
    )
    .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
    .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
    .action(async (opts) => {
      await listPRs({ since: opts.since, until: opts.until });
    });
}

// ─── Command: list-all ────────────────────────────────────────────────────────

function registerListAllCommand(program: Command): void {
  program
    .command("list-all")
    .description(
      "List ALL merged PRs with no module filter (useful for debugging)",
    )
    .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
    .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
    .action(async (opts) => {
      await listAllPRs({ since: opts.since, until: opts.until });
    });
}

// ─── Command group: config ────────────────────────────────────────────────────

function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Manage your prly configuration");

  config
    .command("init")
    .description(`Interactively create or update your config (${configPath()})`)
    .action(async () => {
      const saved = await initConfig();
      console.log(`\n✅ Config saved to: ${configPath()}`);
      console.log(`   Repo   : ${saved.github.owner}/${saved.github.repo}`);
      console.log(
        `   Modules: ${saved.github.filterModules.join(", ") || "(none)"}`,
      );
    });

  config
    .command("show")
    .description("Print the current configuration")
    .action(() => {
      console.log(`📁 Config file: ${configPath()}\n`);
      console.log(JSON.stringify(loadConfig(), null, 2));
    });

  config
    .command("add-module <path>")
    .description('Add a directory to "my modules" (e.g. src/features/auth)')
    .action((modulePath: string) => {
      const updated = addModule(modulePath);
      console.log(
        `✅ Modules: ${updated.github.filterModules.join(", ") || "(none)"}`,
      );
    });

  config
    .command("remove-module <path>")
    .description("Remove a directory from your modules")
    .action((modulePath: string) => {
      const updated = removeModule(modulePath);
      console.log(
        `✅ Modules: ${updated.github.filterModules.join(", ") || "(none)"}`,
      );
    });

  config
    .command("test")
    .description("Test GitHub token and repo access")
    .action(async () => {
      const { testConnection } = await import("./providers/github");
      const cfg = loadConfig();
      await testConnection(cfg.github.owner, cfg.github.repo);
    });
}

// ─── Program factory ──────────────────────────────────────────────────────────

/**
 * Builds and returns the fully-configured Commander program.
 * Exported so it can be instantiated in unit tests without side-effects.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("prly")
    .description(
      "Summarize your daily merged PRs with AI — for any GitHub repo",
    )
    .version(version);

  registerRunCommand(program);
  registerListCommand(program);
  registerListAllCommand(program);
  registerConfigCommands(program);

  return program;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌", message);
    process.exit(1);
  });
