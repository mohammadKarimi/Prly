"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePRs = summarizePRs;
const node_fetch_1 = __importDefault(require("node-fetch"));
const config_1 = require("./config");
async function summarizePRs(prs) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error("OPENAI_API_KEY environment variable is not set.");
    const config = (0, config_1.loadConfig)();
    const systemPrompt = config.openAiPrompt ?? config_1.DEFAULT_OPENAI_PROMPT;
    const input = prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body ?? "",
        author: pr.user.login,
        url: pr.html_url,
        changedFiles: pr.changedFiles ?? [],
    }));
    const messages = [
        {
            role: "system",
            content: systemPrompt,
        },
        {
            role: "user",
            content: `Summarize these merged pull requests:\n\n${JSON.stringify(input, null, 2)}`,
        },
    ];
    const res = await (0, node_fetch_1.default)("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.3,
            stream: true,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }
    // Stream the response, printing each token as it arrives
    process.stdout.write("\n");
    let fullText = "";
    for await (const line of res.body) {
        const raw = line.toString("utf-8");
        for (const part of raw.split("\n")) {
            const trimmed = part.trim();
            if (!trimmed.startsWith("data:"))
                continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]")
                break;
            let chunk;
            try {
                chunk = JSON.parse(data);
            }
            catch {
                continue;
            }
            if (chunk.error)
                throw new Error(`OpenAI error: ${chunk.error.message}`);
            const token = chunk.choices?.[0]?.delta?.content ?? "";
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