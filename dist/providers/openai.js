"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePRs = summarizePRs;
exports.summarizePRsAsAdaptiveCard = summarizePRsAsAdaptiveCard;
const node_fetch_1 = __importDefault(require("node-fetch"));
const config_1 = require("../config");
// ─── Constants ────────────────────────────────────────────────────────────────
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const ADAPTIVE_CARD_SYSTEM_PROMPT = `You are an expert at generating Microsoft Teams Adaptive Cards from pull request data.
Output ONLY a valid JSON object matching the Adaptive Card schema (version 1.4).

The root object must have exactly these keys:
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
  "type": "AdaptiveCard"
  "version": "1.4"
  "msteams": { "width": "full" }
  "body": [ ...elements... ]

Body structure (in order):
1. TextBlock header — text: "🧠 Engineering Changes", weight: "Bolder", size: "Large"

For EACH pull request, append in this order:
2. TextBlock — "🔹 #<number> — <short problem title>", weight: "Bolder", wrap: true, spacing: "Medium"
3. TextBlock — "🧠 TL;DR: <one-line summary>", wrap: true, color: "Accent", spacing: "Small"
4. FactSet — facts: Author (@login), Merged (YYYY-MM-DD from merged_at), Type (one of: 🐛 Bug Fix | ✨ Feature | 🛠 Improvement | ♻️ Refactor), Area (inferred from changedFiles or title)
5. Container — items: [ TextBlock "🧩 Problem" (weight Bolder), TextBlock problem description (wrap true) ]
6. Container — items: [ TextBlock "🔧 Change" (weight Bolder), TextBlock what was changed (wrap true) ]
7. Container — items: [ TextBlock "✅ Result" (weight Bolder), TextBlock results as bullet points using "•" (wrap true) ]
8. Container (only if notable) — items: [ TextBlock "⚠️ Dev Notes" (weight Bolder), TextBlock notes (wrap true, color Warning) ]
9. ActionSet — actions: [ Action.OpenUrl { title: "🔗 View Pull Request", url: <pr.html_url> } ]
10. TextBlock separator (between PRs, not after the last): text: "─────────────────", isSubtle: true, spacing: "Medium"

Output ONLY the JSON object. No markdown fences, no explanations.`;
const ADAPTIVE_CARD_CONVERT_PROMPT = `You are an expert at generating Microsoft Teams Adaptive Cards.
You will receive a pre-written markdown PR summary. Convert it into an Adaptive Card (version 1.4).
Do NOT re-analyse — use exactly the content already in the summary.

The root object must have exactly these keys:
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
  "type": "AdaptiveCard"
  "version": "1.4"
  "msteams": { "width": "full" }
  "body": [ ...elements... ]

Body structure (in order):
1. TextBlock header — text: "🧠 Engineering Changes", weight: "Bolder", size: "Large"

For EACH pull request found in the summary, append in this order:
2. TextBlock — "🔹 #<number> — <title>", weight: "Bolder", wrap: true, spacing: "Medium"
3. TextBlock — TL;DR line (if present), wrap: true, color: "Accent", spacing: "Small"
4. FactSet — extract Author, Merged date, and any other metadata present in the summary
5. Container — items: [ TextBlock "🧩 Problem" (weight Bolder), TextBlock content (wrap true) ]
6. Container — items: [ TextBlock "🔧 Change" (weight Bolder), TextBlock content (wrap true) ]
7. Container — items: [ TextBlock "✅ Result" (weight Bolder), TextBlock content with bullet points (wrap true) ]
8. Container (only if present in summary) — items: [ TextBlock "⚠️ Dev Notes" (weight Bolder), TextBlock content (wrap true, color Warning) ]
9. ActionSet — actions: [ Action.OpenUrl { title: "🔗 View Pull Request", url: <PR url if present> } ]
10. TextBlock separator (between PRs, not after the last): text: "─────────────────", isSubtle: true, spacing: "Medium"

Output ONLY the JSON object. No markdown fences, no explanations.`;
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Parses one `data: ...` line from an OpenAI SSE stream.
 * Returns the text token, or `null` when the line should be skipped.
 */
function parseStreamLine(line) {
    if (!line.startsWith("data:"))
        return null;
    const data = line.slice(5).trim();
    if (data === "[DONE]")
        return null;
    let chunk;
    try {
        chunk = JSON.parse(data);
    }
    catch {
        return null;
    }
    if (chunk.error)
        throw new Error(`OpenAI error: ${chunk.error.message}`);
    return chunk.choices?.[0]?.delta?.content ?? null;
}
function buildUserMessage(prs) {
    const input = prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body ?? "",
        author: pr.user.login,
        url: pr.html_url,
        changedFiles: pr.changedFiles ?? [],
    }));
    return `Summarize these merged pull requests:\n\n${JSON.stringify(input, null, 2)}`;
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Sends `prs` to OpenAI and streams the resulting summary to stdout.
 * Returns the full summary text once the stream is complete.
 *
 * Requires the `OPENAI_API_KEY` environment variable.
 */
async function summarizePRs(prs) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set.");
    }
    const config = (0, config_1.loadConfig)();
    const language = config.llmOptions?.outputLanguage ?? "English";
    const basePrompt = config.llmOptions?.prompt ?? config_1.DEFAULT_OPENAI_PROMPT;
    const systemPrompt = `${basePrompt}\n\nIMPORTANT: Write the entire output in ${language}.`;
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserMessage(prs) },
    ];
    const res = await (0, node_fetch_1.default)(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            temperature: 0.3,
            stream: true,
        }),
    });
    if (!res.ok) {
        throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }
    process.stdout.write("\n");
    let fullText = "";
    for await (const chunk of res.body) {
        for (const line of chunk.toString("utf-8").split("\n")) {
            const token = parseStreamLine(line.trim());
            if (token) {
                process.stdout.write(token);
                fullText += token;
            }
        }
    }
    process.stdout.write("\n");
    return fullText || "No summary generated.";
}
/**
 * Sends `prs` to OpenAI and returns a Microsoft Teams Adaptive Card object
 * (version 1.4) ready to be POSTed to a Teams incoming webhook.
 *
 * When `existingSummary` is provided (e.g. already generated by `summarizePRs`)
 * OpenAI converts that text into the card format — no second analysis is run.
 * When omitted, OpenAI analyses the raw PR data directly.
 *
 * Uses a non-streaming call with `response_format: json_object`.
 */
async function summarizePRsAsAdaptiveCard(prs, existingSummary) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set.");
    }
    const messages = existingSummary
        ? [
            { role: "system", content: ADAPTIVE_CARD_CONVERT_PROMPT },
            { role: "user", content: existingSummary },
        ]
        : [
            { role: "system", content: ADAPTIVE_CARD_SYSTEM_PROMPT },
            { role: "user", content: buildUserMessage(prs) },
        ];
    const res = await (0, node_fetch_1.default)(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });
    if (!res.ok) {
        throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json());
    const content = json.choices?.[0]?.message?.content;
    if (!content)
        throw new Error("OpenAI returned an empty Adaptive Card.");
    return JSON.parse(content);
}
//# sourceMappingURL=openai.js.map