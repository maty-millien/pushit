import * as p from "@clack/prompts";
import pc from "picocolors";
import { generateCommitMessage } from "./api";
import { VERSION, loadConfig } from "./config";
import * as git from "./git/commands";
import { buildContext } from "./git/context";
import type {
  FileDiffStats,
  FileStatus,
  GitOptions,
  GitResult,
  IndexSnapshot,
  RepositoryState,
} from "./types";
import { checkForUpdates } from "./updater";

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

const STATUS_DISPLAY: Record<
  string,
  { label: string; color: (s: string) => string }
> = {
  added: { label: "A", color: pc.green },
  modified: { label: "M", color: pc.yellow },
  deleted: { label: "D", color: pc.red },
  renamed: { label: "R", color: pc.cyan },
  copied: { label: "C", color: pc.cyan },
};

function formatPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return filePath;
  }
  const dir = filePath.slice(0, lastSlash + 1);
  const filename = filePath.slice(lastSlash + 1);
  return pc.dim(dir) + filename;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDiffStats(stats: FileDiffStats | undefined): string {
  if (!stats) return "";

  const parts: string[] = [];
  if (stats.insertions > 0) {
    parts.push(pc.green(`+${formatNumber(stats.insertions)}`));
  }
  if (stats.deletions > 0) {
    parts.push(pc.red(`-${formatNumber(stats.deletions)}`));
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function displayFileStatuses(
  statuses: FileStatus[],
  diffStats: Map<string, FileDiffStats>,
): void {
  if (statuses.length === 0) return;

  console.log(`${pc.gray("│")}`);
  console.log(`${pc.gray("│")}  ${pc.bold("Changes")}`);

  for (const file of statuses) {
    const { label, color } = STATUS_DISPLAY[file.status] || {
      label: "?",
      color: pc.gray,
    };
    const statusBadge = color(label);
    const stats = diffStats.get(file.path);
    const statsDisplay = formatDiffStats(stats);

    if (file.oldPath) {
      console.log(
        `${pc.gray("│")}    ${statusBadge}  ${pc.dim(file.oldPath)} ${pc.dim("→")} ${formatPath(file.path)}${statsDisplay}`,
      );
    } else {
      console.log(
        `${pc.gray("│")}    ${statusBadge}  ${formatPath(file.path)}${statsDisplay}`,
      );
    }
  }
}

function displaySuggestions(suggestions: string[] | undefined): void {
  if (!suggestions?.length) return;
  console.log(`${pc.gray("│")}`);
  for (const suggestion of suggestions) {
    console.log(`${pc.gray("│")}  ${pc.dim("$")} ${suggestion}`);
  }
}

function cancelWithGitResult(result: GitResult | RepositoryState): never {
  const error = "error" in result ? result.error : undefined;
  p.cancel(result.message || error || "Git operation failed");
  displaySuggestions(result.suggestions);
  process.exit(1);
}

async function restoreAndExit(
  snapshot: IndexSnapshot | undefined,
  options: GitOptions,
  code: number,
  message?: string,
): Promise<never> {
  const restoreResult = await git.restoreIndex(snapshot, options);
  if (!restoreResult.success) {
    p.cancel(restoreResult.message || restoreResult.error || "Restore failed");
    displaySuggestions(restoreResult.suggestions);
    process.exit(1);
  }
  if (message) p.cancel(message);
  process.exit(code);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`pushit v${VERSION}`);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");

  const gitOptions: GitOptions = { dryRun };

  await checkForUpdates();

  const repoState = await git.getRepositoryState();
  if (!repoState.ok) {
    cancelWithGitResult(repoState);
  }

  const spinner = p.spinner();
  spinner.start("Analyzing changes...");
  const snapshotResult = await git.snapshotIndex(gitOptions);
  if (!snapshotResult.success) {
    spinner.stop("Analysis failed");
    cancelWithGitResult(snapshotResult);
  }
  const indexSnapshot = snapshotResult.snapshot;

  const stageResult = await git.stageAll(gitOptions);
  if (!stageResult.success) {
    spinner.stop("Staging failed");
    await restoreAndExit(indexSnapshot, gitOptions, 1, stageResult.message);
  }

  const [context, remoteExists, diffStatsArray] = await Promise.all([
    buildContext(gitOptions),
    Promise.resolve(repoState.hasRemote && !repoState.isDetached),
    git.getDiffStats(gitOptions),
  ]);
  context.branch = repoState.branch;
  spinner.stop("Analysis complete");

  if (!context.diff && !context.status) {
    const restoreResult = await git.restoreIndex(indexSnapshot, gitOptions);
    if (!restoreResult.success) cancelWithGitResult(restoreResult);
    p.outro("No changes to commit");
    process.exit(0);
  }

  const fileStatuses = git.parseStatus(context.status);
  const diffStats = new Map(diffStatsArray.map((s) => [s.path, s]));
  displayFileStatuses(fileStatuses, diffStats);

  const config = await loadConfig();

  while (true) {
    const generateSpinner = p.spinner();
    generateSpinner.start("Generating commit message...");

    const startTime = performance.now();
    let message: string;
    try {
      message = await generateCommitMessage(context, config);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      generateSpinner.stop(`Message generated ${pc.dim(`${elapsed}s`)}`);
    } catch (error) {
      generateSpinner.stop("Failed to generate message");
      p.cancel(error instanceof Error ? error.message : "Unknown error");
      await restoreAndExit(indexSnapshot, gitOptions, 1);
      throw error;
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
      await restoreAndExit(indexSnapshot, gitOptions, 0, "Commit cancelled");
    }

    if (action === "regenerate") {
      continue;
    }

    const commitSpinner = p.spinner();
    commitSpinner.start("Creating commit...");
    const commitResult = await git.commit(message, gitOptions);
    if (!commitResult.success) {
      commitSpinner.stop("Commit failed");
      await restoreAndExit(
        indexSnapshot,
        gitOptions,
        1,
        commitResult.message || `Failed to commit: ${commitResult.error}`,
      );
    }
    commitSpinner.stop("Commit created");

    if (action === "commit_push") {
      const pushSpinner = p.spinner();
      pushSpinner.start("Pushing to remote...");
      const pushResult = await git.push(gitOptions);
      if (pushResult.success) {
        pushSpinner.stop("Changes pushed successfully!");
      } else {
        pushSpinner.stop("Push failed");
        p.cancel(pushResult.message || pushResult.error || "Failed to push");
        displaySuggestions(pushResult.suggestions);
        process.exit(1);
      }
    }

    break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
