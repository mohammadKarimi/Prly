import fetch from "node-fetch";
import { PullRequest } from "../types";
import { loadConfig, DEFAULT_OPENAI_PROMPT } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

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

const MAX_PATCH_CHARS = 1500;

function buildUserMessage(prs: PullRequest[]): string {
  const input = prs.map((pr) => {
    const entry: Record<string, unknown> = {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? "",
      author: pr.user.login,
      url: pr.html_url,
      changedFiles: pr.changedFiles ?? [],
    };
    if (pr.diffs && pr.diffs.length > 0) {
      entry.diffs = pr.diffs.map((d) => ({
        filename: d.filename,
        patch:
          d.patch.length > MAX_PATCH_CHARS
            ? d.patch.slice(0, MAX_PATCH_CHARS) + "\n... (truncated)"
            : d.patch,
      }));
    }
    return entry;
  });
  return `Summarize these merged pull requests:\n\n${JSON.stringify(input, null, 2)}`;
}

// ─── Card builder (no AI call) ───────────────────────────────────────────────

/**
 * Wraps an already-generated text `summary` into an Adaptive Card object.
 * Uses the same card structure as the full adaptive-card prompt but does NOT
 * make any additional AI call — the content is exactly what was produced by
 * `summarizePRs`.
 */
export function buildAdaptiveCardFromSummary(
  summary: string,
  prs: PullRequest[],
): object {
  const body: object[] = [
    {
      type: "TextBlock",
      text: "🧠 Engineering Changes",
      weight: "Bolder",
      size: "Large",
    },
    {
      type: "TextBlock",
      text: summary,
      wrap: true,
      spacing: "Medium",
    },
  ];

  const actions = prs.map((pr) => ({
    type: "Action.OpenUrl",
    title: `🔗 #${pr.number} — ${pr.title}`,
    url: pr.html_url,
  }));

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    msteams: { width: "full" },
    body,
    actions,
  };
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
