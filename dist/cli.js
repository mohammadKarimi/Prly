#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProgram = buildProgram;
// Load .env from the current working directory before anything else.
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
const commander_1 = require("commander");
const summary_1 = require("./summary");
const config_1 = require("./config");
const package_json_1 = require("../package.json");
// ─── Command: run ─────────────────────────────────────────────────────────────
function registerRunCommand(program) {
    program
        .command("run")
        .description("Fetch, filter, summarize, and optionally email your PRs")
        .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
        .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
        .option("--no-email", "Skip sending the email")
        .option("--no-ai", "Skip OpenAI summarization, just list PRs")
        .option("--verbose", "Show every PR's changed files during module filtering")
        .action(async (opts) => {
        await (0, summary_1.runSummary)({
            since: opts.since,
            until: opts.until,
            email: opts.email !== false,
            ai: opts.ai !== false,
            verbose: !!opts.verbose,
        });
    });
}
// ─── Command: list ────────────────────────────────────────────────────────────
function registerListCommand(program) {
    program
        .command("list")
        .description("List your PRs (filtered by modules) without summarizing or emailing")
        .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
        .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
        .action(async (opts) => {
        await (0, summary_1.listPRs)({ since: opts.since, until: opts.until });
    });
}
// ─── Command: list-all ────────────────────────────────────────────────────────
function registerListAllCommand(program) {
    program
        .command("list-all")
        .description("List ALL merged PRs with no module filter (useful for debugging)")
        .option("--since <date>", "Start date (YYYY-MM-DD), default: yesterday")
        .option("--until <date>", "End date   (YYYY-MM-DD), default: today")
        .action(async (opts) => {
        await (0, summary_1.listAllPRs)({ since: opts.since, until: opts.until });
    });
}
// ─── Command group: config ────────────────────────────────────────────────────
function registerConfigCommands(program) {
    const config = program
        .command("config")
        .description("Manage your prly configuration");
    config
        .command("init")
        .description(`Interactively create or update your config (${(0, config_1.configPath)()})`)
        .action(async () => {
        const saved = await (0, config_1.initConfig)();
        console.log(`\n✅ Config saved to: ${(0, config_1.configPath)()}`);
        console.log(`   Repo   : ${saved.github.owner}/${saved.github.repo}`);
        console.log(`   Modules: ${saved.myModules.join(", ") || "(none)"}`);
        console.log(`\n💡 Set secrets as environment variables (e.g. in your shell profile):`);
        console.log(`   OPENAI_API_KEY=sk-...`);
        console.log(`   EMAIL_PASS=...`);
        console.log(`   EMAIL_USER=...`);
    });
    config
        .command("show")
        .description("Print the current configuration")
        .action(() => {
        console.log(`📁 Config file: ${(0, config_1.configPath)()}\n`);
        console.log(JSON.stringify((0, config_1.loadConfig)(), null, 2));
    });
    config
        .command("add-module <path>")
        .description('Add a directory to "my modules" (e.g. src/features/auth)')
        .action((modulePath) => {
        const updated = (0, config_1.addModule)(modulePath);
        console.log(`✅ Modules: ${updated.myModules.join(", ") || "(none)"}`);
    });
    config
        .command("remove-module <path>")
        .description("Remove a directory from your modules")
        .action((modulePath) => {
        const updated = (0, config_1.removeModule)(modulePath);
        console.log(`✅ Modules: ${updated.myModules.join(", ") || "(none)"}`);
    });
    config
        .command("test")
        .description("Test GitHub token and repo access")
        .action(async () => {
        const { testConnection } = await Promise.resolve().then(() => __importStar(require("./github")));
        const cfg = (0, config_1.loadConfig)();
        await testConnection(cfg.github.owner, cfg.github.repo);
    });
}
// ─── Program factory ──────────────────────────────────────────────────────────
/**
 * Builds and returns the fully-configured Commander program.
 * Exported so it can be instantiated in unit tests without side-effects.
 */
function buildProgram() {
    const program = new commander_1.Command();
    program
        .name("prly")
        .description("Summarize your daily merged PRs with AI — for any GitHub repo")
        .version(package_json_1.version);
    registerRunCommand(program);
    registerListCommand(program);
    registerListAllCommand(program);
    registerConfigCommands(program);
    return program;
}
// ─── Entry point ──────────────────────────────────────────────────────────────
buildProgram()
    .parseAsync(process.argv)
    .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌", message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map