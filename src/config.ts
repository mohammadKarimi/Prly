import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline/promises";
import { Config } from "./types";

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
  if (config.myModules.includes(normalized)) {
    console.log(`Module "${normalized}" is already in the list.`);
    return config;
  }
  config.myModules.push(normalized);
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
  const before = config.myModules.length;
  config.myModules = config.myModules.filter((m) => m !== normalized);
  if (config.myModules.length === before) {
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

  console.log(
    `\n⚙️  Setting up prly — config will be saved to: ${configPath()}\n`,
  );

  const owner = await ask("GitHub org / owner", existing?.github.owner ?? "");
  const repo = await ask("GitHub repo name", existing?.github.repo ?? "");
  const emailTo = await ask(
    "Email recipient (leave blank to skip)",
    existing?.email?.to ?? "",
  );

  console.log(
    "\n📦 Modules filter (optional): enter directory prefixes to filter PRs.",
  );
  console.log('   e.g. "src/features/auth"  — leave blank to finish.\n');

  const modules: string[] = [...(existing?.myModules ?? [])];
  while (true) {
    const mod = await ask("Add module path (or press Enter to finish)");
    if (!mod) break;
    const normalized = normalizeModulePath(mod);
    if (!modules.includes(normalized)) modules.push(normalized);
    console.log(`   ✅ Modules so far: ${modules.join(", ")}`);
  }

  rl.close();

  const config: Config = {
    github: { owner, repo },
    myModules: modules,
    ...(emailTo ? { email: { to: emailTo } } : {}),
    openAiPrompt: existing?.openAiPrompt ?? DEFAULT_OPENAI_PROMPT,
  };

  saveConfig(config);
  return config;
}
