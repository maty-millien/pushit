import type {
  FileDiffStats,
  FileStatus,
  FileStatusType,
  GitCommandResult,
  GitErrorKind,
  GitOptions,
  GitResult,
  IndexSnapshot,
  RepositoryState,
} from "../types";
import { existsSync } from "fs";

export async function git(args: string[]): Promise<GitCommandResult> {
  try {
    const proc = Bun.spawn(["git", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return {
      args,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      success: exitCode === 0,
    };
  } catch (error) {
    return {
      args,
      stdout: "",
      stderr: "",
      exitCode: null,
      success: false,
      error: error instanceof Error ? error.message : "Failed to run git",
    };
  }
}

function resultMessage(result: GitCommandResult): string {
  return result.stderr || result.error || result.stdout || "Git command failed";
}

function failedResult(
  result: GitCommandResult,
  kind: GitErrorKind,
  fallback: string,
  suggestions: string[] = [],
): GitResult {
  return {
    success: false,
    exitCode: result.exitCode,
    kind,
    message: resultMessage(result) || fallback,
    error: resultMessage(result) || fallback,
    suggestions,
  };
}

export async function isGitRepo(): Promise<boolean> {
  const result = await git(["rev-parse", "--is-inside-work-tree"]);
  return result.success && result.stdout === "true";
}

async function gitPath(name: string): Promise<string | undefined> {
  const result = await git(["rev-parse", "--git-path", name]);
  return result.success && result.stdout ? result.stdout : undefined;
}

async function detectInProgressOperation(): Promise<
  RepositoryState["inProgressOperation"]
> {
  const mergeHead = await gitPath("MERGE_HEAD");
  if (mergeHead && existsSync(mergeHead)) return "merge";

  const rebaseMerge = await gitPath("rebase-merge");
  const rebaseApply = await gitPath("rebase-apply");
  if (
    (rebaseMerge && existsSync(rebaseMerge)) ||
    (rebaseApply && existsSync(rebaseApply))
  ) {
    return "rebase";
  }

  const cherryPickHead = await gitPath("CHERRY_PICK_HEAD");
  if (cherryPickHead && existsSync(cherryPickHead)) return "cherry-pick";

  const revertHead = await gitPath("REVERT_HEAD");
  if (revertHead && existsSync(revertHead)) return "revert";

  return undefined;
}

function parseConflictPaths(statusOutput: string): string[] {
  const unmerged = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
  return statusOutput
    .split("\n")
    .filter(Boolean)
    .filter((line) => unmerged.has(line.slice(0, 2)))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function operationSuggestions(
  operation: RepositoryState["inProgressOperation"],
): string[] {
  if (operation === "rebase") {
    return ["git status", "git rebase --continue", "git rebase --abort"];
  }
  if (operation === "merge") {
    return ["git status", "git merge --abort"];
  }
  if (operation === "cherry-pick") {
    return [
      "git status",
      "git cherry-pick --continue",
      "git cherry-pick --abort",
    ];
  }
  if (operation === "revert") {
    return ["git status", "git revert --continue", "git revert --abort"];
  }
  return ["git status"];
}

export async function getRepositoryState(): Promise<RepositoryState> {
  const inside = await git(["rev-parse", "--is-inside-work-tree"]);
  if (!inside.success) {
    const kind = inside.exitCode === null ? "git_not_found" : "not_repo";
    return {
      ok: false,
      branch: "",
      isDetached: false,
      hasRemote: false,
      conflictPaths: [],
      kind,
      message:
        kind === "git_not_found"
          ? "Git is not available. Install Git and try again."
          : "Not a git repository.",
      suggestions: kind === "not_repo" ? ["cd <repo>"] : undefined,
    };
  }

  const [branchResult, shortHeadResult, remoteResult, statusResult, operation] =
    await Promise.all([
      git(["symbolic-ref", "--quiet", "--short", "HEAD"]),
      git(["rev-parse", "--short", "HEAD"]),
      git(["remote"]),
      git(["status", "--porcelain=v1"]),
      detectInProgressOperation(),
    ]);
  const isDetached = !branchResult.success;
  const branch = isDetached
    ? `HEAD detached at ${shortHeadResult.stdout || "unknown"}`
    : branchResult.stdout;
  const conflictPaths = parseConflictPaths(statusResult.stdout);

  if (operation || conflictPaths.length > 0) {
    const label = operation ? `${operation} in progress` : "unmerged paths";
    return {
      ok: false,
      branch,
      isDetached,
      hasRemote: remoteResult.stdout.length > 0,
      inProgressOperation: operation,
      conflictPaths,
      kind: "conflict_state",
      message: `Cannot run while ${label} exists. Resolve or abort it first.`,
      suggestions: operationSuggestions(operation),
    };
  }

  return {
    ok: true,
    branch,
    isDetached,
    hasRemote: remoteResult.stdout.length > 0,
    conflictPaths,
  };
}

export async function snapshotIndex(
  options: GitOptions = {},
): Promise<GitResult & { snapshot?: IndexSnapshot }> {
  if (options.dryRun) return { success: true, snapshot: { tree: "" } };
  const result = await git(["write-tree"]);
  if (!result.success) {
    return failedResult(result, "unknown", "Failed to snapshot the index.", [
      "git status",
    ]);
  }
  return { success: true, snapshot: { tree: result.stdout } };
}

export async function restoreIndex(
  snapshot: IndexSnapshot | undefined,
  options: GitOptions = {},
): Promise<GitResult> {
  if (options.dryRun || !snapshot) return { success: true };
  const result = await git(["read-tree", snapshot.tree]);
  if (!result.success) {
    return failedResult(result, "unknown", "Failed to restore the index.", [
      "git reset",
      "git status",
    ]);
  }
  return { success: true };
}

export async function stageAll(options: GitOptions = {}): Promise<GitResult> {
  if (options.dryRun) return { success: true };
  const result = await git(["add", "-A"]);
  if (!result.success) {
    return failedResult(result, "stage_failed", "Failed to stage changes.", [
      "git status",
    ]);
  }
  return { success: true };
}

export async function getStagedDiff(options: GitOptions = {}): Promise<string> {
  if (options.dryRun) {
    const [staged, unstaged] = await Promise.all([
      git(["diff", "--cached"]),
      git(["diff"]),
    ]);
    return [staged.stdout, unstaged.stdout].filter(Boolean).join("\n");
  }
  const result = await git(["diff", "--cached"]);
  return result.stdout;
}

export async function getStatusWithBranch(): Promise<{
  branch: string;
  status: string;
}> {
  const result = await git(["status", "--short", "--branch"]);
  const lines = result.stdout.split("\n");
  const branchLine = lines[0] || "";
  const branch = branchLine.replace(/^## /, "").split("...")[0] || "main";
  const status = lines.slice(1).filter(Boolean).join("\n");
  return { branch, status };
}

export async function getCommitHistory(count: number = 20): Promise<string[]> {
  const result = await git([
    "log",
    `-${count}`,
    "--pretty=format:%s",
    "--no-merges",
  ]);
  if (!result.stdout) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export async function hasRemote(): Promise<boolean> {
  const result = await git(["remote"]);
  return result.stdout.length > 0;
}

export async function hasOriginRemote(): Promise<boolean> {
  const result = await git(["remote", "get-url", "origin"]);
  return result.success;
}

export async function commit(
  message: string,
  options: GitOptions = {},
): Promise<GitResult> {
  if (options.dryRun) {
    return { success: true };
  }
  const result = await git(["commit", "-m", message]);
  if (result.success) return { success: true, exitCode: result.exitCode };
  return failedResult(result, "commit_failed", "Failed to create commit.", [
    "git status",
  ]);
}

function classifyPushFailure(output: string): {
  kind: GitErrorKind;
  suggestions: string[];
  summary: string;
} {
  const text = output.toLowerCase();
  if (
    text.includes("non-fast-forward") ||
    text.includes("fetch first") ||
    text.includes("rejected") ||
    text.includes("failed to push some refs")
  ) {
    return {
      kind: "push_rejected",
      summary: "Push was rejected by the remote.",
      suggestions: ["git pull --rebase", "git push"],
    };
  }
  if (
    text.includes("permission denied") ||
    text.includes("authentication failed") ||
    text.includes("could not read username") ||
    text.includes("repository not found") ||
    text.includes("access denied")
  ) {
    return {
      kind: "auth_failed",
      summary: "Push failed because authentication or permissions failed.",
      suggestions: ["git remote -v", "git push"],
    };
  }
  if (
    text.includes("could not resolve host") ||
    text.includes("network is unreachable") ||
    text.includes("connection timed out") ||
    text.includes("unable to access")
  ) {
    return {
      kind: "network_failed",
      summary: "Push failed because the remote could not be reached.",
      suggestions: ["git remote -v", "git push"],
    };
  }
  if (
    text.includes("no upstream branch") ||
    text.includes("set the remote as upstream") ||
    text.includes("has no upstream") ||
    text.includes("no configured push destination")
  ) {
    return {
      kind: "upstream_missing",
      summary: "Push failed because this branch has no upstream.",
      suggestions: ["git push --set-upstream origin <branch>"],
    };
  }
  return {
    kind: "unknown",
    summary: "Push failed.",
    suggestions: ["git status", "git push"],
  };
}

export async function push(options: GitOptions = {}): Promise<GitResult> {
  if (options.dryRun) {
    return { success: true };
  }
  const state = await getRepositoryState();
  if (state.isDetached) {
    return {
      success: false,
      kind: "detached_head",
      message: "Cannot push from a detached HEAD.",
      error: "Cannot push from a detached HEAD.",
      suggestions: ["git switch <branch>"],
    };
  }
  const result = await git(["push"]);
  if (result.success) {
    return { success: true, exitCode: result.exitCode };
  }

  const failureText = resultMessage(result);
  const classified = classifyPushFailure(failureText);
  if (classified.kind === "upstream_missing" && (await hasOriginRemote())) {
    const upstreamResult = await git([
      "push",
      "--set-upstream",
      "origin",
      state.branch,
    ]);
    if (upstreamResult.success) {
      return { success: true, exitCode: upstreamResult.exitCode };
    }
    const upstreamFailure = classifyPushFailure(resultMessage(upstreamResult));
    return failedResult(
      upstreamResult,
      upstreamFailure.kind,
      upstreamFailure.summary,
      upstreamFailure.suggestions,
    );
  }

  return failedResult(
    result,
    classified.kind,
    classified.summary,
    classified.suggestions,
  );
}

export async function unstage(options: GitOptions = {}): Promise<void> {
  if (options.dryRun) return;
  await git(["reset"]);
}

const STATUS_MAP: Record<string, FileStatusType> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
};

export function parseStatus(statusOutput: string): FileStatus[] {
  if (!statusOutput.trim()) return [];

  return statusOutput
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      // Path starts after the 2 status chars; trim any whitespace
      const pathPart = line.slice(2).trimStart();

      // Use index status if staged, otherwise worktree status
      const statusChar =
        indexStatus !== " " && indexStatus !== "?"
          ? indexStatus
          : worktreeStatus;

      // Handle untracked files (shown as added when staged)
      if (indexStatus === "?") {
        return { path: pathPart, status: "added" as FileStatusType };
      }

      // Handle renames: "R  old.ts -> new.ts"
      if (statusChar === "R" || statusChar === "C") {
        const arrowIndex = pathPart.indexOf(" -> ");
        if (arrowIndex !== -1) {
          return {
            path: pathPart.slice(arrowIndex + 4),
            oldPath: pathPart.slice(0, arrowIndex),
            status: STATUS_MAP[statusChar],
          };
        }
      }

      return {
        path: pathPart,
        status: STATUS_MAP[statusChar] || "modified",
      };
    });
}

export async function getDiffStats(
  options: GitOptions = {},
): Promise<FileDiffStats[]> {
  if (options.dryRun) {
    const [staged, unstaged] = await Promise.all([
      git(["diff", "--cached", "--numstat"]),
      git(["diff", "--numstat"]),
    ]);
    const combined = [staged.stdout, unstaged.stdout]
      .filter(Boolean)
      .join("\n");
    return parseNumstat(combined);
  }

  const result = await git(["diff", "--cached", "--numstat"]);
  return parseNumstat(result.stdout);
}

function parseNumstat(output: string): FileDiffStats[] {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [insertions, deletions, ...pathParts] = line.split("\t");
      return {
        path: pathParts.join("\t"),
        insertions: insertions === "-" ? 0 : parseInt(insertions, 10),
        deletions: deletions === "-" ? 0 : parseInt(deletions, 10),
      };
    });
}
