import * as p from "@clack/prompts";
import color from "picocolors";
import { buildContext, buildPrompt, type GitContext } from "./context";
import * as git from "./git";

// Display commit message prominently
function displayCommitMessage(message: string): void {
  const padding = 3;
  const boxWidth = message.length + padding * 2;

  const topBorder = "╭" + "─".repeat(boxWidth) + "╮";
  const bottomBorder = "╰" + "─".repeat(boxWidth) + "╯";
  const emptyLine = "│" + " ".repeat(boxWidth) + "│";
  const messageLine =
    "│" + " ".repeat(padding) + message + " ".repeat(padding) + "│";

  console.log();
  console.log(color.dim(topBorder));
  console.log(color.dim(emptyLine));
  console.log(
    color.dim("│") +
      " ".repeat(padding) +
      color.bold(color.cyan(message)) +
      " ".repeat(padding) +
      color.dim("│")
  );
  console.log(color.dim(emptyLine));
  console.log(color.dim(bottomBorder));
  console.log();
}

// Configuration
interface Config {
  apiKey: string;
  model: string;
  apiUrl: string;
}

function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    p.cancel("OPENROUTER_API_KEY environment variable is not set");
    process.exit(1);
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || "",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  };
}

// OpenRouter streaming API call
async function generateCommitMessage(
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
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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
      } catch {}
    }
  }

  if (!message) {
    throw new Error("No commit message generated");
  }

  return message.trim();
}

// Main function
async function main(): Promise<void> {
  p.intro("pushit - AI-powered git commits");

  // Load configuration
  const config = loadConfig();

  // Validate git repository
  if (!git.isGitRepo()) {
    p.cancel("Not a git repository");
    process.exit(1);
  }

  // Check for changes
  if (!git.hasChanges()) {
    p.outro("No changes to commit");
    process.exit(0);
  }

  // Stage all changes
  const stageSpinner = p.spinner();
  stageSpinner.start("Staging changes...");
  git.stageAll();
  stageSpinner.stop("Changes staged");

  // Build context
  const contextSpinner = p.spinner();
  contextSpinner.start("Analyzing changes...");
  const context = await buildContext();
  contextSpinner.stop("Analysis complete");

  // Check if remote exists
  const remoteExists = git.hasRemote();

  // Generate commit message loop
  while (true) {
    const generateSpinner = p.spinner();
    generateSpinner.start("Generating commit message...");

    let message: string;
    try {
      message = await generateCommitMessage(context, config);
      generateSpinner.stop("Message generated");
    } catch (error) {
      generateSpinner.stop("Failed to generate message");
      p.cancel(error instanceof Error ? error.message : "Unknown error");
      git.unstage();
      process.exit(1);
    }

    // Display the generated commit message
    displayCommitMessage(message);

    // Build options based on remote availability
    const options = remoteExists
      ? [
          { value: "commit_push" as const, label: "Commit and push" },
          { value: "regenerate" as const, label: "Regenerate" },
          { value: "cancel" as const, label: "Cancel" },
        ]
      : [
          { value: "commit" as const, label: "Commit" },
          { value: "regenerate" as const, label: "Regenerate" },
          { value: "cancel" as const, label: "Cancel" },
        ];

    const action = await p.select({
      message: "What would you like to do?",
      options,
    });

    if (p.isCancel(action) || action === "cancel") {
      git.unstage();
      p.cancel("Commit cancelled");
      process.exit(0);
    }

    if (action === "regenerate") {
      continue;
    }

    // Commit
    const commitResult = git.commit(message);
    if (!commitResult.success) {
      p.cancel(`Failed to commit: ${commitResult.error}`);
      process.exit(1);
    }
    p.log.success("Commit created successfully!");

    // Push if requested
    if (action === "commit_push") {
      const pushSpinner = p.spinner();
      pushSpinner.start("Pushing to remote...");
      const pushResult = git.push();
      if (pushResult.success) {
        pushSpinner.stop("Changes pushed successfully!");
      } else {
        pushSpinner.stop("Failed to push (remote may not be configured)");
      }
    }

    break;
  }

  p.outro("Done!");
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
