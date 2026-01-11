import * as p from "@clack/prompts";
import pc from "picocolors";
import { generateCommitMessage } from "./api";
import { loadConfig } from "./config";
import { buildContext } from "./git/context";
import * as git from "./git/commands";
import type { GitOptions } from "./types";

const TYPE_COLORS: Record<string, (s: string) => string> = {
  feat: pc.green,
  fix: pc.red,
  docs: pc.blue,
  style: pc.magenta,
  refactor: pc.yellow,
  perf: pc.cyan,
  test: pc.gray,
  build: pc.gray,
  ci: pc.gray,
  chore: pc.gray,
  revert: pc.red,
};

function formatCommitMessage(message: string): string {
  const lines = message.split("\n");
  const headerLine = lines[0];
  const body = lines.slice(1).join("\n").trim();

  // Parse conventional commit: type(scope): description or type: description
  const match = headerLine.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  if (!match) {
    return message;
  }

  const [, type, scope, description] = match;
  const colorFn = TYPE_COLORS[type] || pc.white;

  let formatted = colorFn(pc.bold(type));
  if (scope) {
    formatted += pc.dim("(") + pc.cyan(scope) + pc.dim(")");
  }
  formatted += pc.dim(": ") + description;

  if (body) {
    formatted += "\n\n" + pc.dim(body);
  }

  return formatted;
}

function displayCommitMessage(message: string): void {
  const formatted = formatCommitMessage(message);
  const type = message.match(/^(\w+)/)?.[1] || "";
  const colorFn = TYPE_COLORS[type] || pc.white;
  console.log(`${pc.gray("│")}\n${colorFn("✦")}  ${formatted}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const gitOptions: GitOptions = { dryRun };

  const config = await loadConfig();

  if (!(await git.isGitRepo())) {
    p.cancel("Not a git repository");
    process.exit(1);
  }

  if (!(await git.hasChanges())) {
    p.outro("No changes to commit");
    process.exit(0);
  }

  const stageSpinner = p.spinner();
  stageSpinner.start("Staging changes...");
  await git.stageAll(gitOptions);
  stageSpinner.stop("Changes staged");

  const contextSpinner = p.spinner();
  contextSpinner.start("Analyzing changes...");
  const context = await buildContext(gitOptions);
  contextSpinner.stop("Analysis complete");

  const remoteExists = await git.hasRemote();

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
      await git.unstage(gitOptions);
      process.exit(1);
    }

    displayCommitMessage(message);

    const branch = context.branch;
    const options = [
      remoteExists
        ? {
            value: "commit_push" as const,
            label: `Commit and push to ${branch}`,
          }
        : { value: "commit" as const, label: `Commit to ${branch}` },
      { value: "regenerate" as const, label: "Regenerate" },
      { value: "cancel" as const, label: "Cancel" },
    ];

    const action = await p.select({
      message: "What would you like to do?",
      options,
    });

    if (p.isCancel(action) || action === "cancel") {
      await git.unstage(gitOptions);
      p.cancel("Commit cancelled");
      process.exit(0);
    }

    if (action === "regenerate") {
      continue;
    }

    const commitSpinner = p.spinner();
    commitSpinner.start("Creating commit...");
    const commitResult = await git.commit(message, gitOptions);
    if (!commitResult.success) {
      commitSpinner.stop("Commit failed");
      p.cancel(`Failed to commit: ${commitResult.error}`);
      process.exit(1);
    }
    commitSpinner.stop("Commit created");

    if (action === "commit_push") {
      const pushSpinner = p.spinner();
      pushSpinner.start("Pushing to remote...");
      const pushResult = await git.push(gitOptions);
      if (pushResult.success) {
        pushSpinner.stop("Changes pushed successfully!");
      } else {
        pushSpinner.stop("Failed to push (remote may not be configured)");
      }
    }

    break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
