import { buildPrompt } from "./git/context";
import type { Config, GitContext } from "./types";

export async function generateCommitMessage(
  context: GitContext,
  config: Config
): Promise<string> {
  const prompt = buildPrompt(context);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "https://github.com/pushit",
      "X-Title": "pushit",
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      reasoning: { exclude: true, effort: "none" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  let message = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          message += content;
        }
      } catch {
        // Ignore malformed SSE chunks - expected during streaming
      }
    }
  }

  if (!message) {
    throw new Error("No commit message generated");
  }

  return message.trim();
}
