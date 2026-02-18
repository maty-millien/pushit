import type {
  FileDiffStats,
  FileStatus,
  FileStatusType,
  GitOptions,
  GitResult,
} from "../types";

async function git(args: string[]): Promise<{
  stdout: string;
  success: boolean;
  stderr: string;
}> {
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
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    success: exitCode === 0,
  };
}

export async function isGitRepo(): Promise<boolean> {
  const result = await git(["rev-parse", "--is-inside-work-tree"]);
  return result.success && result.stdout === "true";
}

export async function hasChanges(): Promise<boolean> {
  const [staged, unstaged, untracked] = await Promise.all([
    git(["diff", "--cached", "--quiet"]),
    git(["diff", "--quiet"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ]);

  return !staged.success || !unstaged.success || untracked.stdout.length > 0;
}

export async function stageAll(options: GitOptions = {}): Promise<void> {
  if (options.dryRun) return;
  await git(["add", "-A"]);
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

export async function getChangedFiles(
  options: GitOptions = {},
): Promise<string[]> {
  if (options.dryRun) {
    const [staged, unstaged, untracked] = await Promise.all([
      git(["diff", "--cached", "--name-only"]),
      git(["diff", "--name-only"]),
      git(["ls-files", "--others", "--exclude-standard"]),
    ]);
    const allFiles = [staged.stdout, unstaged.stdout, untracked.stdout]
      .filter(Boolean)
      .join("\n");
    return [...new Set(allFiles.split("\n").filter(Boolean))];
  }
  const result = await git(["diff", "--cached", "--name-only"]);
  if (!result.stdout) return [];
  return result.stdout.split("\n").filter(Boolean);
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

export async function commit(
  message: string,
  options: GitOptions = {},
): Promise<GitResult> {
  if (options.dryRun) {
    return { success: true };
  }
  const result = await git(["commit", "-m", message]);
  return {
    success: result.success,
    error: result.success ? undefined : result.stderr,
  };
}

export async function push(options: GitOptions = {}): Promise<GitResult> {
  if (options.dryRun) {
    return { success: true };
  }
  const result = await git(["push"]);
  if (result.success) {
    return { success: true };
  }

  const { branch } = await getStatusWithBranch();
  const upstreamResult = await git([
    "push",
    "--set-upstream",
    "origin",
    branch,
  ]);
  return {
    success: upstreamResult.success,
    error: upstreamResult.success ? undefined : upstreamResult.stderr,
  };
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
