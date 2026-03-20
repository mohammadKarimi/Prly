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
exports.initConfig = initConfig;
exports.addModule = addModule;
exports.removeModule = removeModule;
exports.isMyPR = isMyPR;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const promises_1 = __importDefault(require("readline/promises"));
const CONFIG_FILENAME = ".prly.config.json";
function findConfigPath() {
    return path_1.default.join(os_1.default.homedir(), CONFIG_FILENAME);
}
function configPath() {
    return findConfigPath();
}
function configExists() {
    return fs_1.default.existsSync(findConfigPath());
}
function loadConfig() {
    const p = findConfigPath();
    if (!fs_1.default.existsSync(p)) {
        throw new Error(`Config not found at ${p}. Run "prly config init" to create one.`);
    }
    const raw = fs_1.default.readFileSync(p, "utf-8");
    return JSON.parse(raw);
}
function saveConfig(config) {
    fs_1.default.writeFileSync(findConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}
exports.DEFAULT_OPENAI_PROMPT = [
    "You are a senior engineer writing internal release notes for your team.",
    "You will receive a list of merged pull requests. Each PR has a title, description (body), author, and a list of changed file paths.",
    "Group the PRs into three sections: ## Features, ## Improvements, ## Bug Fixes. Omit empty sections.",
    "For each PR, produce an entry in this exact format:",
    "  ### #<number> <title>",
    "  **Author:** @<author> | **Domains:** <comma-separated domains inferred from file paths>",
    "  <2–4 sentence summary of WHAT changed and WHY, written in plain English. Use the PR body and file paths as evidence. Focus on the business/user impact, not implementation details.>",
    "Derive domain names from the top-level or meaningful sub-directory names in the changed file paths.",
    "If the PR body is empty, infer the summary from the title and changed files.",
].join(" ");
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
    console.log('   e.g. "ABE" or "src/features/auth"  — leave blank to skip.\n');
    const modules = [...(existing?.myModules ?? [])];
    while (true) {
        const mod = await ask(`Add module path (or press Enter to finish)`);
        if (!mod)
            break;
        const normalized = mod.replace(/\\/g, "/").replace(/\/$/, "");
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
function addModule(modulePath) {
    const config = loadConfig();
    const normalized = modulePath.replace(/\\/g, "/").replace(/\/$/, "");
    if (config.myModules.includes(normalized)) {
        console.log(`Module "${normalized}" is already in the list.`);
        return config;
    }
    config.myModules.push(normalized);
    saveConfig(config);
    return config;
}
function removeModule(modulePath) {
    const config = loadConfig();
    const normalized = modulePath.replace(/\\/g, "/").replace(/\/$/, "");
    const before = config.myModules.length;
    config.myModules = config.myModules.filter((m) => m !== normalized);
    if (config.myModules.length === before) {
        console.log(`Module "${normalized}" was not found in the list.`);
        return config;
    }
    saveConfig(config);
    return config;
}
/** Returns true if any changed file belongs to one of the user's modules */
function isMyPR(changedFiles, myModules) {
    if (myModules.length === 0)
        return true; // no filter → include all
    return changedFiles.some((file) => myModules.some((mod) => file.startsWith(mod + "/") || file === mod));
}
//# sourceMappingURL=config.js.map