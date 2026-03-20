"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OPENAI_PROMPT = void 0;
exports.configPath = configPath;
exports.configExists = configExists;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.isMyPR = isMyPR;
exports.addModule = addModule;
exports.removeModule = removeModule;
exports.initConfig = initConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const promises_1 = __importDefault(require("readline/promises"));
// ─── Constants ────────────────────────────────────────────────────────────────
const CONFIG_FILENAME = ".prly.config.json";
// ─── Path helpers ─────────────────────────────────────────────────────────────
function findConfigPath() {
    return path_1.default.join(os_1.default.homedir(), CONFIG_FILENAME);
}
/** Absolute path to the config file in the user's home directory. */
function configPath() {
    return findConfigPath();
}
/** Returns `true` when the config file exists on disk. */
function configExists() {
    return fs_1.default.existsSync(findConfigPath());
}
// ─── Read / write ─────────────────────────────────────────────────────────────
/**
 * Loads and parses the config file.
 * Throws a descriptive error when the file does not exist.
 */
function loadConfig() {
    const p = findConfigPath();
    if (!fs_1.default.existsSync(p)) {
        throw new Error(`Config not found at ${p}. Run "prly config init" to create one.`);
    }
    return JSON.parse(fs_1.default.readFileSync(p, "utf-8"));
}
/** Serializes `config` and writes it to disk. */
function saveConfig(config) {
    fs_1.default.writeFileSync(findConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}
// ─── Module-path helpers ──────────────────────────────────────────────────────
/**
 * Normalizes a module path to use forward slashes and strips any trailing slash.
 * Applied consistently to every path stored in or compared against `myModules`.
 */
function normalizeModulePath(modulePath) {
    return modulePath.replace(/\\/g, "/").replace(/\/$/, "");
}
/**
 * Returns `true` when at least one file in `changedFiles` falls inside one of
 * the directories listed in `myModules`.
 * When `myModules` is empty the function always returns `true` (no filter).
 */
function isMyPR(changedFiles, myModules) {
    if (myModules.length === 0)
        return true;
    return changedFiles.some((file) => myModules.some((mod) => file === mod || file.startsWith(mod + "/")));
}
// ─── Config mutations ─────────────────────────────────────────────────────────
/**
 * Adds `modulePath` to the `myModules` list and saves the config.
 * Is a no-op (with a console message) when the path is already present.
 */
function addModule(modulePath) {
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
function removeModule(modulePath) {
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
exports.DEFAULT_OPENAI_PROMPT = [
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
async function initConfig() {
    const existing = configExists() ? loadConfig() : undefined;
    const rl = promises_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = async (question, fallback = "") => {
        const hint = fallback ? ` (${fallback})` : "";
        const answer = await rl.question(`${question}${hint}: `);
        return answer.trim() || fallback;
    };
    console.log(`\n⚙️  Setting up prly — config will be saved to: ${configPath()}\n`);
    const owner = await ask("GitHub org / owner", existing?.github.owner ?? "");
    const repo = await ask("GitHub repo name", existing?.github.repo ?? "");
    const emailTo = await ask("Email recipient (leave blank to skip)", existing?.email?.to ?? "");
    console.log("\n📦 Modules filter (optional): enter directory prefixes to filter PRs.");
    console.log('   e.g. "src/features/auth"  — leave blank to finish.\n');
    const modules = [...(existing?.myModules ?? [])];
    while (true) {
        const mod = await ask("Add module path (or press Enter to finish)");
        if (!mod)
            break;
        const normalized = normalizeModulePath(mod);
        if (!modules.includes(normalized))
            modules.push(normalized);
        console.log(`   ✅ Modules so far: ${modules.join(", ")}`);
    }
    rl.close();
    const config = {
        github: { owner, repo },
        myModules: modules,
        ...(emailTo ? { email: { to: emailTo } } : {}),
        openAiPrompt: existing?.openAiPrompt ?? exports.DEFAULT_OPENAI_PROMPT,
    };
    saveConfig(config);
    return config;
}
//# sourceMappingURL=config.js.map