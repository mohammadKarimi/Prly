import fetch from "node-fetch";
import { PullRequest } from "../types";
import { loadConfig, DEFAULT_OPENAI_PROMPT } from "../config";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  error?: { message: string };
}

interface OpenAIResponse {
  choices?: Array<{
    message: { content: string };
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses one `data: ...` line from an OpenAI SSE stream.
 * Returns the text token, or `null` when the line should be skipped.
 */
function parseStreamLine(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trim();
  if (data === "[DONE]") return null;

  let chunk: OpenAIStreamChunk;
  try {
    chunk = JSON.parse(data) as OpenAIStreamChunk;
  } catch {
    return null;
  }

  if (chunk.error) throw new Error(`OpenAI error: ${chunk.error.message}`);
  return chunk.choices?.[0]?.delta?.content ?? null;
}

function buildUserMessage(prs: PullRequest[]): string {
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
 * @param onBeforeStream  Called once, right before the first token is written.
 *                        Use it to stop a spinner or print a header line.
 * Requires the `OPENAI_API_KEY` environment variable.
 */
export async function summarizePRs(
  prs: PullRequest[],
  onBeforeStream?: () => void,
): Promise<string> {
  const config = loadConfig();
  const apiKey = config.openai?.apiKey;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key is not configured. Set "openai.apiKey" in your config.',
    );
  }
  const language = config.llmOptions?.outputLanguage ?? "English";
  const basePrompt = config.llmOptions?.prompt ?? DEFAULT_OPENAI_PROMPT;
  const systemPrompt = `${basePrompt}\n\nIMPORTANT: Write the entire output in ${language}.`;

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildUserMessage(prs) },
  ];

  const res = await fetch(OPENAI_CHAT_URL, {
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

  onBeforeStream?.();
  process.stdout.write("\n");
  let fullText = "";

  for await (const chunk of res.body as AsyncIterable<Buffer>) {
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
 * Sends `prs` to OpenAI and returns a parsed Adaptive Card JSON object
 * ready to be posted to a Microsoft Teams Incoming Webhook.
 *
 * Uses a non-streaming request so the full JSON can be parsed reliably.
 * Requires `openai.apiKey` to be set in the config.
 */
export async function summarizePRsAsAdaptiveCard(
  prs: PullRequest[],
): Promise<object> {
  const config = loadConfig();
  const apiKey = config.openai?.apiKey;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key is not configured. Set "openai.apiKey" in your config.',
    );
  }

  const messages: OpenAIMessage[] = [
    { role: "system", content: ADAPTIVE_CARD_SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(prs) },
  ];

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  // Strip markdown fences if the model wraps the JSON anyway
  const cleaned = content.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();

  try {
    return JSON.parse(cleaned) as object;
  } catch {
    throw new Error(`OpenAI returned invalid JSON for the Adaptive Card:\n${cleaned}`);
  }
}
