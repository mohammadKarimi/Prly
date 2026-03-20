"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSummary = runSummary;
exports.listPRs = listPRs;
exports.listAllPRs = listAllPRs;
const config_1 = require("../config");
const github_1 = require("../providers/github");
const openai_1 = require("../providers/openai");
const email_1 = require("../providers/email");
const webhook_1 = require("../providers/webhook");
// ─── Date helpers ─────────────────────────────────────────────────────────────
function buildDateRange(options) {
    const until = options.until ? new Date(options.until) : new Date();
    until.setHours(23, 59, 59, 999);
    let since;
    if (options.since) {
        since = new Date(options.since);
        since.setHours(0, 0, 0, 0);
    }
    else {
        // Default: yesterday
        since = new Date(until);
        since.setDate(since.getDate() - 1);
        since.setHours(0, 0, 0, 0);
    }
    return { since, until };
}
function formatDateLabel({ since, until }) {
    const fmt = (d) => d.toISOString().split("T")[0];
    return since.toDateString() === until.toDateString()
        ? fmt(since)
        : `${fmt(since)} → ${fmt(until)}`;
}
// ─── Shared helpers ───────────────────────────────────────────────────────────
function printPRList(prs) {
    for (const pr of prs) {
        const date = pr.merged_at?.split("T")[0] ?? "unknown";
        console.log(`  #${pr.number}  ${pr.title}`);
        console.log(`        Author : @${pr.user.login}`);
        console.log(`        Merged : ${date}`);
        console.log(`        URL    : ${pr.html_url}`);
        console.log();
    }
}
async function attachChangedFiles(prs, owner, repo) {
    for (const pr of prs) {
        if (!pr.changedFiles) {
            pr.changedFiles = await (0, github_1.fetchPRFiles)(owner, repo, pr.number);
        }
    }
}
async function filterByModules(prs, owner, repo, myModules, verbose = false) {
    if (myModules.length === 0)
        return prs;
    console.log("🔍 Filtering by your modules...");
    const filtered = [];
    for (const pr of prs) {
        const files = await (0, github_1.fetchPRFiles)(owner, repo, pr.number);
        pr.changedFiles = files;
        const matched = (0, config_1.isMyPR)(files, myModules);
        if (verbose) {
            console.log(`   ${matched ? "✅" : "⬜"} #${pr.number} ${pr.title}`);
            for (const f of files)
                console.log(`        ${f}`);
        }
        if (matched)
            filtered.push(pr);
    }
    console.log(`   ${filtered.length} PR(s) touch your modules.`);
    return filtered;
}
// ─── Public commands ──────────────────────────────────────────────────────────
async function runSummary(options) {
    const config = (0, config_1.loadConfig)();
    const range = buildDateRange(options);
    const dateLabel = formatDateLabel(range);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    if (config.myModules.length > 0) {
        console.log(`🗂  My modules: ${config.myModules.join(", ")}`);
    }
    console.log("\n⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, range.since, range.until);
    console.log(`   Found ${allPRs.length} merged PR(s) in range.`);
    const myPRs = await filterByModules(allPRs, config.github.owner, config.github.repo, config.myModules, options.verbose);
    if (myPRs.length === 0) {
        console.log("\n⚠️  No relevant PRs found for your modules in this range.");
        return;
    }
    console.log("\n📋 Your PRs:");
    printPRList(myPRs);
    // Fetch changed files for AI domain analysis when the module filter didn't already do it
    if (options.ai && config.myModules.length === 0) {
        console.log("🔍 Fetching changed files for domain analysis...");
        await attachChangedFiles(myPRs, config.github.owner, config.github.repo);
    }
    let summary = myPRs
        .map((pr) => `#${pr.number} ${pr.title} (@${pr.user.login})`)
        .join("\n");
    if (options.ai) {
        console.log("\n🧠 Generating AI summary...");
        summary = await (0, openai_1.summarizePRs)(myPRs);
    }
    if (options.email) {
        console.log("📧 Sending email...");
        await (0, email_1.sendEmail)(`PR Summary for ${dateLabel}\n\n${summary}`, config.email?.to);
    }
    if (options.webhook) {
        // Re-use the already-generated text summary when available so we don't
        // run a second independent AI analysis that could produce different content.
        const existingText = options.ai ? summary : undefined;
        console.log("🔔 Building Adaptive Card for Teams...");
        const card = await (0, openai_1.summarizePRsAsAdaptiveCard)(myPRs, existingText);
        console.log("🔔 Sending webhook notification...");
        await (0, webhook_1.sendToWebhook)(card);
    }
    console.log("\n🎉 Done!");
}
async function listPRs(options) {
    const config = (0, config_1.loadConfig)();
    const range = buildDateRange(options);
    const dateLabel = formatDateLabel(range);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    console.log("\n⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, range.since, range.until);
    const myPRs = await filterByModules(allPRs, config.github.owner, config.github.repo, config.myModules);
    if (myPRs.length === 0) {
        console.log("\n⚠️  No relevant PRs found.");
        return;
    }
    console.log(`\n📋 ${myPRs.length} PR(s):\n`);
    printPRList(myPRs);
}
async function listAllPRs(options) {
    const config = (0, config_1.loadConfig)();
    const range = buildDateRange(options);
    const dateLabel = formatDateLabel(range);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    console.log("   (no module filter — showing ALL merged PRs)\n");
    console.log("⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, range.since, range.until);
    if (allPRs.length === 0) {
        console.log("\n⚠️  No PRs merged in this range.");
        return;
    }
    console.log(`📋 ${allPRs.length} PR(s):\n`);
    printPRList(allPRs);
}
//# sourceMappingURL=summary.js.map