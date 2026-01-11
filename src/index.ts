import * as p from "@clack/prompts";
import { generateCommitMessage } from "./api";
import { loadConfig } from "./config";
import { buildContext } from "./context";
import * as git from "./git";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    git.setDryRun(true);
    p.intro("Dry run mode - no changes will be made");
  }

  const configSpinner = p.spinner();
  configSpinner.start("Loading configuration...");
  const config = await loadConfig();
  configSpinner.stop("Configuration loaded");

  if (!git.isGitRepo()) {
    p.cancel("Not a git repository");
    process.exit(1);
  }

  if (!git.hasChanges()) {
    p.outro("No changes to commit");
    process.exit(0);
  }

  const stageSpinner = p.spinner();
  stageSpinner.start(dryRun ? "Checking changes..." : "Staging changes...");
  git.stageAll();
  stageSpinner.stop(dryRun ? "Changes detected" : "Changes staged");

  const contextSpinner = p.spinner();
  contextSpinner.start("Analyzing changes...");
  const context = await buildContext();
  contextSpinner.stop("Analysis complete");

  const remoteExists = git.hasRemote();

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

    p.note(message, "Commit message");

    const options = [
      remoteExists
        ? { value: "commit_push" as const, label: "Commit and push" }
        : { value: "commit" as const, label: "Commit" },
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

    const commitSpinner = p.spinner();
    commitSpinner.start(dryRun ? "Simulating commit..." : "Creating commit...");
    const commitResult = git.commit(message);
    if (!commitResult.success) {
      commitSpinner.stop("Commit failed");
      p.cancel(`Failed to commit: ${commitResult.error}`);
      process.exit(1);
    }
    commitSpinner.stop(dryRun ? "Commit simulated" : "Commit created");

    if (action === "commit_push") {
      const pushSpinner = p.spinner();
      pushSpinner.start(dryRun ? "Simulating push..." : "Pushing to remote...");
      const pushResult = git.push();
      if (pushResult.success) {
        pushSpinner.stop(dryRun ? "Push simulated" : "Changes pushed successfully!");
      } else {
        pushSpinner.stop("Failed to push (remote may not be configured)");
      }
    }

    break;
  }

  p.outro(dryRun ? "Dry run complete - no changes were made" : "Done!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
