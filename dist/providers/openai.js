"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePRs = summarizePRs;
const node_fetch_1 = __importDefault(require("node-fetch"));
const config_1 = require("../config");
// ─── Constants ────────────────────────────────────────────────────────────────
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
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
//# sourceMappingURL=openai.js.map