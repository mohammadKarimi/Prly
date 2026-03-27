import ora from "ora";
import { loadConfig, isMyPR } from "../config";
import {
  fetchMergedPRs,
  fetchPRFiles,
  fetchPRDiffs,
} from "../providers/github";
import {
  summarizePRs,
  buildAdaptiveCardFromSummary,
} from "../providers/openai";
import { sendEmail } from "../providers/email";
import { sendToWebhook } from "../providers/webhook";
import { sendToMsTeams, sendAdaptiveCardToMsTeams } from "../providers/msTeams";
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

  const spinner = verbose ? null : ora("Filtering by your modules...").start();
  if (verbose) console.log("🔍 Filtering by your modules...");
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

  if (spinner) {
    spinner.succeed(`${filtered.length} PR(s) touch your modules.`);
  } else {
    console.log(`   ${filtered.length} PR(s) touch your modules.`);
  }
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

  const fetchSpinner = ora("Fetching merged PRs...").start();
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );
  fetchSpinner.succeed(`Found ${allPRs.length} merged PR(s) in range.`);

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
    const filesSpinner = ora(
      "Fetching changed files for domain analysis...",
    ).start();
    await attachChangedFiles(myPRs, config.github.owner, config.github.repo);
    filesSpinner.succeed("Changed files fetched.");
  }

  // Fetch per-file diffs when --diff is requested
  if (options.ai && options.diff) {
    const diffSpinner = ora("Fetching PR diffs...").start();
    for (const pr of myPRs) {
      pr.diffs = await fetchPRDiffs(
        config.github.owner,
        config.github.repo,
        pr.number,
      );
    }
    diffSpinner.succeed("PR diffs fetched.");
  }

  let summary = myPRs
    .map((pr) => `#${pr.number} ${pr.title} (@${pr.user.login})`)
    .join("\n");

  if (options.ai) {
    const aiSpinner = ora("Generating AI summary...").start();
    summary = await summarizePRs(myPRs, () => aiSpinner.stop());
    console.log("\n✔ AI summary ready.");
  }

  if (options.email) {
    const emailSpinner = ora("Sending email...").start();
    await sendEmail(`PR Summary for ${dateLabel}\n\n${summary}`);
    emailSpinner.succeed("Email sent.");
  }

  if (options.webhook) {
    const webhookSpinner = ora("Sending webhook notification...").start();
    await sendToWebhook(summary);
    webhookSpinner.succeed("Webhook sent.");
  }

  if (options.msTeams) {
    const teamsSpinner = ora("Sending MS Teams notification...").start();
    if (options.ai) {
      // Wrap the already-generated summary into an Adaptive Card (no second AI call)
      const card = buildAdaptiveCardFromSummary(summary, myPRs);
      await sendAdaptiveCardToMsTeams(card);
    } else {
      await sendToMsTeams(summary);
    }
    teamsSpinner.succeed("MS Teams notification sent.");
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

  const fetchSpinner = ora("Fetching merged PRs...").start();
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );
  fetchSpinner.succeed(`Found ${allPRs.length} merged PR(s) in range.`);

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

  const fetchSpinner = ora("Fetching merged PRs...").start();
  const allPRs = await fetchMergedPRs(
    config.github.owner,
    config.github.repo,
    range.since,
    range.until,
  );
  fetchSpinner.succeed(`Found ${allPRs.length} merged PR(s).`);

  if (allPRs.length === 0) {
    console.log("\n⚠️  No PRs merged in this range.");
    return;
  }

  console.log(`📋 ${allPRs.length} PR(s):\n`);
  printPRList(allPRs);
}
