import { buildPrompt } from "./git/context";
import type { Config, GitContext } from "./types";

const COMMIT_TYPES =
  "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert";
const CONVENTIONAL_RE = new RegExp(
  `((?:${COMMIT_TYPES})(?:\\([^)]+\\))?:\\s*.+)$`,
);

function sanitizeMessage(raw: string): string {
  let msg = raw.trim();

  // Unwrap code fences: ```<optional lang>\n...\n```
  const fenceMatch = msg.match(/^```\w*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    msg = fenceMatch[1].trim();
  }

  // Unwrap inline backticks
  if (msg.startsWith("`") && msg.endsWith("`") && !msg.includes("\n")) {
    msg = msg.slice(1, -1);
  }

  // Unwrap quotes
  if (
    (msg.startsWith('"') && msg.endsWith('"')) ||
    (msg.startsWith("'") && msg.endsWith("'"))
  ) {
    msg = msg.slice(1, -1);
  }

  // Search all lines for a conventional commit pattern (even mid-line)
  for (const line of msg.split("\n")) {
    const match = line.match(CONVENTIONAL_RE);
    if (match) {
      msg = match[1].trim();
      break;
    }
  }

  // Fallback: first non-empty line
  const firstLine = msg.split("\n").find((l) => l.trim() !== "");
  if (firstLine) {
    msg = firstLine.trim();
  }

  // Strip trailing period
  if (msg.endsWith(".")) {
    msg = msg.slice(0, -1);
  }

  return msg.trim();
}

export async function generateCommitMessage(
  context: GitContext,
  config: Config,
): Promise<string> {
  const prompt = buildPrompt(context);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 64,
      reasoning: { exclude: true, effort: "none" },
      messages: [{ role: "user", content: prompt }],
      provider: { sort: "latency" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const message = data.choices?.[0]?.message?.content;

  if (!message) {
    throw new Error("No commit message generated");
  }

  return sanitizeMessage(message);
}
