"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSummary = runSummary;
exports.listPRs = listPRs;
exports.listAllPRs = listAllPRs;
const config_1 = require("./config");
const github_1 = require("./github");
const openai_1 = require("./openai");
const email_1 = require("./email");
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
function formatDateLabel(since, until) {
    const sameDay = since.toDateString() === until.toDateString();
    const fmt = (d) => d.toISOString().split("T")[0];
    return sameDay ? fmt(since) : `${fmt(since)} → ${fmt(until)}`;
}
async function runSummary(options) {
    const config = (0, config_1.loadConfig)();
    const { since, until } = buildDateRange(options);
    const dateLabel = formatDateLabel(since, until);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    if (config.myModules.length > 0) {
        console.log(`🗂  My modules: ${config.myModules.join(", ")}`);
    }
    // 1. Fetch all merged PRs in the time range
    console.log("\n⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, since, until);
    console.log(`   Found ${allPRs.length} merged PR(s) in range.`);
    // 2. Filter by my modules (requires fetching files per PR)
    let myPRs = allPRs;
    if (config.myModules.length > 0) {
        console.log("🔍 Filtering by your modules...");
        const filtered = [];
        for (const pr of allPRs) {
            const files = await (0, github_1.fetchPRFiles)(config.github.owner, config.github.repo, pr.number);
            pr.changedFiles = files;
            const matched = (0, config_1.isMyPR)(files, config.myModules);
            if (options.verbose) {
                const icon = matched ? "✅" : "⬜";
                console.log(`   ${icon} #${pr.number} ${pr.title}`);
                for (const f of files)
                    console.log(`        ${f}`);
            }
            if (matched)
                filtered.push(pr);
        }
        myPRs = filtered;
        console.log(`   ${myPRs.length} PR(s) touch your modules.`);
    }
    if (myPRs.length === 0) {
        console.log("\n⚠️  No relevant PRs found for your modules in this range.");
        return;
    }
    // 3. Print PR list
    console.log("\n📋 Your PRs:");
    for (const pr of myPRs) {
        console.log(`   #${pr.number} [${pr.user.login}] ${pr.title}`);
        console.log(`          ${pr.html_url}`);
        console.log();
    }
    // 4. If AI is on and files weren't fetched yet (no module filter), fetch them now
    if (options.ai && config.myModules.length === 0) {
        console.log("🔍 Fetching changed files for domain analysis...");
        for (const pr of myPRs) {
            if (!pr.changedFiles) {
                pr.changedFiles = await (0, github_1.fetchPRFiles)(config.github.owner, config.github.repo, pr.number);
            }
        }
    }
    // 5. Summarize with OpenAI (optional)
    let summary = myPRs
        .map((pr) => `#${pr.number} ${pr.title} (@${pr.user.login})`)
        .join("\n");
    if (options.ai) {
        console.log("\n🧠 Generating AI summary...");
        summary = await (0, openai_1.summarizePRs)(myPRs);
        // tokens are streamed to stdout live; no need to reprint
    }
    // 6. Send email (optional)
    if (options.email) {
        const recipient = config.email?.to || undefined;
        console.log("📧 Sending email...");
        await (0, email_1.sendEmail)(`PR Summary for ${dateLabel}\n\n${summary}`, recipient);
    }
    console.log("\n🎉 Done!");
}
async function listPRs(options) {
    const config = (0, config_1.loadConfig)();
    const { since, until } = buildDateRange({
        ...options,
        email: false,
        ai: false,
    });
    const dateLabel = formatDateLabel(since, until);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    console.log("\n⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, since, until);
    let myPRs = allPRs;
    if (config.myModules.length > 0) {
        console.log("🔍 Filtering by your modules...");
        const filtered = [];
        for (const pr of allPRs) {
            const files = await (0, github_1.fetchPRFiles)(config.github.owner, config.github.repo, pr.number);
            if ((0, config_1.isMyPR)(files, config.myModules))
                filtered.push(pr);
        }
        myPRs = filtered;
    }
    if (myPRs.length === 0) {
        console.log("\n⚠️  No relevant PRs found.");
        return;
    }
    console.log(`\n📋 ${myPRs.length} PR(s):\n`);
    for (const pr of myPRs) {
        const date = pr.merged_at ? pr.merged_at.split("T")[0] : "unknown";
        console.log(`  #${pr.number}  ${pr.title}`);
        console.log(`        Author : @${pr.user.login}`);
        console.log(`        Merged : ${date}`);
        console.log(`        URL    : ${pr.html_url}`);
        console.log();
    }
}
async function listAllPRs(options) {
    const config = (0, config_1.loadConfig)();
    const { since, until } = buildDateRange({
        ...options,
        email: false,
        ai: false,
    });
    const dateLabel = formatDateLabel(since, until);
    console.log(`\n📅 Date range: ${dateLabel}`);
    console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
    console.log("   (no module filter — showing ALL merged PRs)\n");
    console.log("⏳ Fetching merged PRs...");
    const allPRs = await (0, github_1.fetchMergedPRs)(config.github.owner, config.github.repo, since, until);
    if (allPRs.length === 0) {
        console.log("\n⚠️  No PRs merged in this range.");
        return;
    }
    console.log(`📋 ${allPRs.length} PR(s):\n`);
    for (const pr of allPRs) {
        const date = pr.merged_at ? pr.merged_at.split("T")[0] : "unknown";
        console.log(`  #${pr.number}  ${pr.title}`);
        console.log(`        Author : @${pr.user.login}`);
        console.log(`        Merged : ${date}`);
        console.log(`        URL    : ${pr.html_url}`);
        console.log();
    }
}
//# sourceMappingURL=summary.js.map