"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMergedPRs = fetchMergedPRs;
exports.fetchPRFiles = fetchPRFiles;
exports.testConnection = testConnection;
const node_fetch_1 = __importDefault(require("node-fetch"));
const child_process_1 = require("child_process");
const config_1 = require("./config");
// ─── API helpers ──────────────────────────────────────────────────────────────
function apiBase() {
    return (process.env.GITHUB_API_BASE_URL ?? "https://api.github.com").replace(/\/$/, "");
}
function resolveToken() {
    // Explicit env var always wins
    if (process.env.GITHUB_TOKEN) {
        return { token: process.env.GITHUB_TOKEN, source: "GITHUB_TOKEN env var" };
    }
    // Fall back to GitHub CLI token (OAuth app — bypasses org PAT restrictions)
    try {
        const token = (0, child_process_1.execSync)("gh auth token", { stdio: ["pipe", "pipe", "pipe"] })
            .toString()
            .trim();
        if (token)
            return { token, source: "GitHub CLI (gh auth token)" };
    }
    catch {
        // gh not installed or not authenticated — fall through to error
    }
    throw new Error("No GitHub token found. Set GITHUB_TOKEN in .env or run: gh auth login");
}
function githubHeaders() {
    return {
        Authorization: `Bearer ${resolveToken().token}`,
        Accept: "application/vnd.github+json",
    };
}
// ─── Data fetching ────────────────────────────────────────────────────────────
/**
 * Fetches all merged pull requests for `owner/repo` within the given date range.
 * Paginates automatically until no pages remain or the oldest PR on a page
 * predates `since`.
 */
async function fetchMergedPRs(owner, repo, since, until) {
    const allPRs = [];
    let page = 1;
    while (true) {
        const url = `${apiBase()}/repos/${owner}/${repo}/pulls?state=closed&per_page=100&page=${page}`;
        const res = await (0, node_fetch_1.default)(url, { headers: githubHeaders() });
        if (!res.ok) {
            throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json());
        if (!Array.isArray(data) || data.length === 0)
            break;
        const merged = data.filter((pr) => {
            if (!pr.merged_at)
                return false;
            const mergedAt = new Date(pr.merged_at);
            return mergedAt >= since && mergedAt <= until;
        });
        allPRs.push(...merged);
        // Stop early if the oldest PR on this page predates our window
        const oldest = data[data.length - 1];
        if (oldest.merged_at && new Date(oldest.merged_at) < since)
            break;
        page++;
    }
    return allPRs;
}
/** Returns the list of file paths changed in pull request `prNumber`. */
async function fetchPRFiles(owner, repo, prNumber) {
    const url = `${apiBase()}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
    const res = await (0, node_fetch_1.default)(url, { headers: githubHeaders() });
    if (!res.ok) {
        throw new Error(`GitHub API error ${res.status} for PR #${prNumber}: ${await res.text()}`);
    }
    const files = (await res.json());
    return files.map((f) => f.filename);
}
// ─── Diagnostics ──────────────────────────────────────────────────────────────
/**
 * Runs three diagnostic checks and exits with code 1 on the first failure:
 * 1. Token validity (`GET /user`)
 * 2. OAuth scopes
 * 3. Repository accessibility (`GET /repos/:owner/:repo`)
 */
async function testConnection(owner, repo) {
    const base = apiBase();
    const { token, source: tokenSource } = resolveToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
    };
    console.log(`\n🔌 API base   : ${base}`);
    console.log(`🔑 Token from : ${tokenSource}`);
    // 1. Verify token
    console.log("\n1️⃣  Checking token (GET /user)...");
    const userRes = await (0, node_fetch_1.default)(`${base}/user`, { headers });
    if (!userRes.ok) {
        console.error(`   ❌ Token invalid or wrong API URL — ${userRes.status}: ${await userRes.text()}`);
        console.error("   👉 Check GITHUB_TOKEN and GITHUB_API_BASE_URL in your .env");
        process.exit(1);
    }
    const user = (await userRes.json());
    console.log(`   ✅ Authenticated as @${user.login}${user.name ? ` (${user.name})` : ""}`);
    // 2. Check scopes
    const scopes = userRes.headers.get("x-oauth-scopes");
    if (scopes === null) {
        console.log("\n2️⃣  Token type: fine-grained PAT (no x-oauth-scopes header)");
        console.log("   ℹ️  Fine-grained PATs need all of the following for private org repos:");
        console.log("      1. Resource owner set to the org, not your personal account");
        console.log("      2. The org must approve the token (org Settings → Personal access tokens)");
        console.log("      3. Token permission: 'Pull requests: Read-only'");
        console.log("   👉 Easiest fix: use a classic PAT (ghp_...) with 'repo' scope instead.");
    }
    else if (!scopes.includes("repo")) {
        console.log(`\n2️⃣  Token scopes: ${scopes}`);
        console.warn("   ⚠️  'repo' scope is missing — required to read private repos.");
        console.warn("   👉 Regenerate your token with the 'repo' scope.");
    }
    else {
        console.log(`\n2️⃣  Token scopes: ${scopes}`);
        console.log("   ✅ 'repo' scope present");
    }
    // 3. Check repo access
    console.log(`\n3️⃣  Checking repo access (GET /repos/${owner}/${repo})...`);
    const repoRes = await (0, node_fetch_1.default)(`${base}/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
        console.error(`   ❌ Cannot access repo — ${repoRes.status}: ${await repoRes.text()}`);
        if (repoRes.status === 404) {
            console.error("   👉 Possible causes:");
            console.error("      • The repo is private and your token lacks 'repo' scope");
            console.error("      • Your account is not a member of the org");
            console.error(`      • The owner/repo name is wrong (check ${(0, config_1.configPath)()})`);
        }
        process.exit(1);
    }
    const repoData = (await repoRes.json());
    console.log(`   ✅ Repo accessible: ${repoData.full_name} (private: ${repoData.private})`);
    console.log("\n🎉 All checks passed — ready to run!\n");
}
//# sourceMappingURL=github.js.map