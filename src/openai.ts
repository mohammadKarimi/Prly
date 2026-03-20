import fetch from "node-fetch";
import { PullRequest } from "./types";
import { loadConfig, DEFAULT_OPENAI_PROMPT } from "./config";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: { message: string };
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  error?: { message: string };
}

export async function summarizePRs(prs: PullRequest[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("OPENAI_API_KEY environment variable is not set.");

  const config = loadConfig();
  const systemPrompt = config.openAiPrompt ?? DEFAULT_OPENAI_PROMPT;

  const input = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    author: pr.user.login,
    url: pr.html_url,
    changedFiles: pr.changedFiles ?? [],
  }));

  const messages: OpenAIMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `Summarize these merged pull requests:\n\n${JSON.stringify(input, null, 2)}`,
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  for await (const line of res.body as AsyncIterable<Buffer>) {
    const raw = line.toString("utf-8");
    for (const part of raw.split("\n")) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") break;

      let chunk: OpenAIStreamChunk;
      try {
        chunk = JSON.parse(data) as OpenAIStreamChunk;
      } catch {
        continue;
      }

      if (chunk.error) throw new Error(`OpenAI error: ${chunk.error.message}`);

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
