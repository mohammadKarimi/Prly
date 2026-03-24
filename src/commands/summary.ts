import { loadConfig, isMyPR } from "../config";
import { fetchMergedPRs, fetchPRFiles } from "../providers/github";
import { summarizePRs, summarizePRsAsAdaptiveCard } from "../providers/openai";
import { sendEmail } from "../providers/email";
import { sendToWebhook } from "../providers/webhook";
import { RunOptions, PullRequest } from "../types";
import { buildDateRange, formatDateLabel } from "../utils/date-helper";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function printPRList(prs: PullRequest[]): void {
  for (const pr of prs) {
    const date = pr.merged_at?.split("T")[0] ?? "unknown";
    console.log(`  #${pr.number}  ${pr.title}`);
    console.log(`        Author : @${pr.user.login}`);
    console.log(`        Merged : ${date}`);
    console.log(`        URL    : ${pr.html_url}`);
    console.log();
  }
}

async function attachChangedFiles(
  prs: PullRequest[],
  owner: string,
  repo: string,
): Promise<void> {
  for (const pr of prs) {
    if (!pr.changedFiles) {
      pr.changedFiles = await fetchPRFiles(owner, repo, pr.number);
    }
  }
}

async function filterByModules(
  prs: PullRequest[],
  owner: string,
  repo: string,
  myModules: string[],
  verbose = false,
): Promise<PullRequest[]> {
  if (myModules.length === 0) return prs;

  console.log("🔍 Filtering by your modules...");
  const filtered: PullRequest[] = [];

  for (const pr of prs) {
    const files = await fetchPRFiles(owner, repo, pr.number);
    pr.changedFiles = files;
    const matched = isMyPR(files, myModules);
    if (verbose) {
      console.log(`   ${matched ? "✅" : "⬜"} #${pr.number} ${pr.title}`);
      for (const f of files) console.log(`        ${f}`);
    }
    if (matched) filtered.push(pr);
  }

  console.log(`   ${filtered.length} PR(s) touch your modules.`);
  return filtered;
}

// ─── Public commands ──────────────────────────────────────────────────────────

export async function runSummary(options: RunOptions): Promise<void> {
  const config = loadConfig();
  const range = buildDateRange(options);
  const dateLabel = formatDateLabel(range);

  console.log(`\n📅 Date range: ${dateLabel}`);
  console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
  if (config.github.filterModules.length > 0) {
    console.log(`🗂  My modules: ${config.github.filterModules.join(", ")}`);
  }

  console.log("\n⏳ Fetching merged PRs...");
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );
  console.log(`   Found ${allPRs.length} merged PR(s) in range.`);

  const myPRs = await filterByModules(
    allPRs,
    config.github.owner,
    config.github.repo,
    config.github.filterModules,
    options.verbose,
  );

  if (myPRs.length === 0) {
    console.log("\n⚠️  No relevant PRs found for your modules in this range.");
    return;
  }

  console.log("\n📋 Your PRs:");
  printPRList(myPRs);

  // Fetch changed files for AI domain analysis when the module filter didn't already do it
  if (options.ai && config.github.filterModules.length === 0) {
    console.log("🔍 Fetching changed files for domain analysis...");
    await attachChangedFiles(myPRs, config.github.owner, config.github.repo);
  }

  let summary = myPRs
    .map((pr) => `#${pr.number} ${pr.title} (@${pr.user.login})`)
    .join("\n");

  if (options.ai) {
    console.log("\n🧠 Generating AI summary...");
    summary = await summarizePRs(myPRs);
  }

  if (options.email) {
    console.log("📧 Sending email...");
    await sendEmail(`PR Summary for ${dateLabel}\n\n${summary}`);
  }

  if (options.webhook) {
    // Re-use the already-generated text summary when available so we don't
    // run a second independent AI analysis that could produce different content.
    const existingText = options.ai ? summary : undefined;
    console.log("🔔 Building Adaptive Card for Teams...");
    const card = await summarizePRsAsAdaptiveCard(myPRs, existingText);
    console.log("🔔 Sending webhook notification...");
    await sendToWebhook(card);
  }

  console.log("\n🎉 Done!");
}

export async function listPRs(
  options: Pick<RunOptions, "since" | "until">,
): Promise<void> {
  const config = loadConfig();
  const range = buildDateRange(options);
  const dateLabel = formatDateLabel(range);

  console.log(`\n📅 Date range: ${dateLabel}`);
  console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);

  console.log("\n⏳ Fetching merged PRs...");
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );

  const myPRs = await filterByModules(
    allPRs,
    config.github.owner,
    config.github.repo,
    config.github.filterModules,
  );

  if (myPRs.length === 0) {
    console.log("\n⚠️  No relevant PRs found.");
    return;
  }

  console.log(`\n📋 ${myPRs.length} PR(s):\n`);
  printPRList(myPRs);
}

export async function listAllPRs(
  options: Pick<RunOptions, "since" | "until">,
): Promise<void> {
  const config = loadConfig();
  const range = buildDateRange(options);
  const dateLabel = formatDateLabel(range);

  console.log(`\n📅 Date range: ${dateLabel}`);
  console.log(`📦 Repo: ${config.github.owner}/${config.github.repo}`);
  console.log("   (no module filter — showing ALL merged PRs)\n");

  console.log("⏳ Fetching merged PRs...");
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );

  if (allPRs.length === 0) {
    console.log("\n⚠️  No PRs merged in this range.");
    return;
  }

  console.log(`📋 ${allPRs.length} PR(s):\n`);
  printPRList(allPRs);
}
