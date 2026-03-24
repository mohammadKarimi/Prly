import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline/promises";
import { Config } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIG_FILENAME = ".prly.config.json";

// ─── Path helpers ─────────────────────────────────────────────────────────────

function findConfigPath(): string {
  return path.join(os.homedir(), CONFIG_FILENAME);
}

/** Absolute path to the config file in the user's home directory. */
export function configPath(): string {
  return findConfigPath();
}

/** Returns `true` when the config file exists on disk. */
export function configExists(): boolean {
  return fs.existsSync(findConfigPath());
}

// ─── Read / write ─────────────────────────────────────────────────────────────

/**
 * Loads and parses the config file.
 * Throws a descriptive error when the file does not exist.
 */
export function loadConfig(): Config {
  const p = findConfigPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Config not found at ${p}. Run "prly config init" to create one.`,
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Config;
}

/** Serializes `config` and writes it to disk. */
export function saveConfig(config: Config): void {
  fs.writeFileSync(findConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

// ─── Module-path helpers ──────────────────────────────────────────────────────

/**
 * Normalizes a module path to use forward slashes and strips any trailing slash.
 * Applied consistently to every path stored in or compared against `myModules`.
 */
function normalizeModulePath(modulePath: string): string {
  return modulePath.replace(/\\/g, "/").replace(/\/$/, "");
}

/**
 * Returns `true` when at least one file in `changedFiles` falls inside one of
 * the directories listed in `myModules`.
 * When `myModules` is empty the function always returns `true` (no filter).
 */
export function isMyPR(changedFiles: string[], myModules: string[]): boolean {
  if (myModules.length === 0) return true;
  return changedFiles.some((file) =>
    myModules.some((mod) => file === mod || file.startsWith(mod + "/")),
  );
}

// ─── Config mutations ─────────────────────────────────────────────────────────

/**
 * Adds `modulePath` to the `myModules` list and saves the config.
 * Is a no-op (with a console message) when the path is already present.
 */
export function addModule(modulePath: string): Config {
  const config = loadConfig();
  const normalized = normalizeModulePath(modulePath);
  if (config.github.filterModules.includes(normalized)) {
    console.log(`Module "${normalized}" is already in the list.`);
    return config;
  }
  config.github.filterModules.push(normalized);
  saveConfig(config);
  return config;
}

/**
 * Removes `modulePath` from the `myModules` list and saves the config.
 * Is a no-op (with a console message) when the path is not found.
 */
export function removeModule(modulePath: string): Config {
  const config = loadConfig();
  const normalized = normalizeModulePath(modulePath);
  const before = config.github.filterModules.length;
  config.github.filterModules = config.github.filterModules.filter(
    (m) => m !== normalized,
  );
  if (config.github.filterModules.length === before) {
    console.log(`Module "${normalized}" was not found in the list.`);
    return config;
  }
  saveConfig(config);
  return config;
}

// ─── OpenAI prompt ────────────────────────────────────────────────────────────

export const DEFAULT_OPENAI_PROMPT = [
  "You are a senior engineer writing internal release notes for your team.",
  "You will receive a list of merged pull requests.",
  "Each PR has a title, description (body), author, and a list of changed file paths.",
  "Group the PRs into three sections: ## Features, ## Improvements, ## Bug Fixes. Omit empty sections.",
  "For each PR, produce an entry in this exact format:",
  "  ### #<number> <title>",
  "  **Author:** @<author> | **Domains:** <comma-separated domains inferred from file paths>",
  "  <2–4 sentence summary of WHAT changed and WHY, written in plain English.",
  "  Use the PR body and file paths as evidence. Focus on the business/user impact, not implementation details.>",
  "Derive domain names from the top-level or meaningful sub-directory names in the changed file paths.",
  "If the PR body is empty, infer the summary from the title and changed files.",
].join(" ");

// ─── Interactive init ─────────────────────────────────────────────────────────

/** Runs an interactive prompt to create or update the config file. */
export async function initConfig(): Promise<Config> {
  const existing = configExists() ? loadConfig() : undefined;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (question: string, fallback = ""): Promise<string> => {
    const hint = fallback ? ` (${fallback})` : "";
    const answer = await rl.question(`${question}${hint}: `);
    return answer.trim() || fallback;
  };

  /** Show "***" when a sensitive value is already set so the user knows it exists. */
  const sensitiveHint = (value: string | undefined): string =>
    value ? "***" : "";

  console.log(
    `\n⚙️  Setting up prly — config will be saved to: ${configPath()}\n`,
  );

  // ── GitHub ────────────────────────────────────────────────────────────────
  console.log(
    "── GitHub ───────────────────────────────────────────────────\n",
  );
  const owner = await ask("GitHub org / owner", existing?.github.owner ?? "");
  const repo = await ask("GitHub repo name", existing?.github.repo ?? "");
  const githubToken = await ask(
    "GitHub Personal Access Token (leave blank to use gh CLI fallback)",
    sensitiveHint(existing?.github.token),
  );
  const apiBaseUrl = await ask(
    "GitHub API base URL",
    existing?.github.apiBaseUrl ?? "https://api.github.com",
  );
  console.log("   Enter directory prefixes to filter PRs to your areas.");
  console.log('   e.g. "src/features/auth"  — leave blank to finish.\n');

  const modules: string[] = [...(existing?.github.filterModules ?? [])];
  while (true) {
    const mod = await ask("Add module path (or press Enter to finish)");
    if (!mod) break;
    const normalized = normalizeModulePath(mod);
    if (!modules.includes(normalized)) modules.push(normalized);
    console.log(`   ✅ Modules so far: ${modules.join(", ")}`);
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────
  console.log(
    "\n── OpenAI ───────────────────────────────────────────────────\n",
  );
  const openAiKey = await ask(
    "OpenAI API key",
    sensitiveHint(existing?.openai?.apiKey),
  );

  // ── Email ─────────────────────────────────────────────────────────────────
  console.log(
    "\n── Email ────────────────────────────────────────────────────\n",
  );
  const emailReceiver = await ask(
    "Email recipient address(es), comma-separated (leave blank to skip email)",
    Array.isArray(existing?.email?.reciever)
      ? existing.email.reciever.join(", ")
      : (existing?.email?.reciever ?? ""),
  );
  const emailUser = await ask(
    "SMTP user / sender address",
    existing?.email?.smtp?.user ?? "",
  );
  const emailPass = await ask(
    "SMTP password",
    sensitiveHint(existing?.email?.smtp?.pass),
  );
  const emailHost = await ask("SMTP host", existing?.email?.smtp?.host ?? "");
  const emailPort = await ask(
    "SMTP port",
    existing?.email?.smtp?.port?.toString() ?? "587",
  );
  const emailSecure = await ask(
    "SMTP secure / TLS (true/false)",
    existing?.email?.smtp?.secure?.toString() ?? "false",
  );

  // ── Webhook ───────────────────────────────────────────────────────────────
  console.log(
    "\n── Webhook ──────────────────────────────────────────────────\n",
  );
  const webhookUrl = await ask(
    "Teams / webhook URL",
    existing?.webhook?.url ?? "",
  );

  // ── LLM options ───────────────────────────────────────────────────────────
  console.log(
    "\n── LLM / AI options ─────────────────────────────────────────\n",
  );
  const outputLanguage = await ask(
    "Summary output language",
    existing?.llmOptions?.outputLanguage ?? "English",
  );
  console.log("   Custom AI prompt (leave blank to keep the default):");
  console.log(
    `   Current: ${(existing?.llmOptions?.prompt ?? DEFAULT_OPENAI_PROMPT).slice(0, 80)}…`,
  );
  const customPrompt = await ask("Custom prompt (or press Enter to keep)");

  rl.close();

  // ── Build & save config ───────────────────────────────────────────────────

  // Resolve sensitive fields: "***" means "keep the existing value"
  const resolvedToken =
    githubToken === "***" ? existing?.github.token : githubToken || undefined;
  const resolvedOpenAiKey =
    openAiKey === "***" ? existing?.openai?.apiKey : openAiKey || undefined;
  const resolvedEmailPass =
    emailPass === "***" ? existing?.email?.smtp?.pass : emailPass || undefined;

  // Parse comma-separated receiver addresses
  const parsedReceiver = emailReceiver
    ? emailReceiver
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const reciever =
    parsedReceiver && parsedReceiver.length === 1
      ? parsedReceiver[0]
      : parsedReceiver?.length
        ? parsedReceiver
        : undefined;

  const hasEmailConfig =
    reciever || emailUser || resolvedEmailPass || emailHost;

  const config: Config = {
    github: {
      owner,
      repo,
      ...(resolvedToken ? { token: resolvedToken } : {}),
      ...(apiBaseUrl && apiBaseUrl !== "https://api.github.com"
        ? { apiBaseUrl }
        : {}),
      filterModules: modules,
    },
    ...(resolvedOpenAiKey ? { openai: { apiKey: resolvedOpenAiKey } } : {}),
    ...(hasEmailConfig
      ? {
          email: {
            ...(reciever ? { reciever } : {}),
            smtp: {
              ...(emailUser ? { user: emailUser } : {}),
              ...(resolvedEmailPass ? { pass: resolvedEmailPass } : {}),
              ...(emailHost ? { host: emailHost } : {}),
              ...(emailPort ? { port: parseInt(emailPort, 10) } : {}),
              ...(emailSecure ? { secure: emailSecure === "true" } : {}),
            },
          },
        }
      : {}),
    ...(webhookUrl ? { webhook: { url: webhookUrl } } : {}),
    llmOptions: {
      prompt:
        customPrompt || existing?.llmOptions?.prompt || DEFAULT_OPENAI_PROMPT,
      outputLanguage: outputLanguage || "English",
    },
  };

  saveConfig(config);
  return config;
}
