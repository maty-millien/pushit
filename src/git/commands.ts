import type { GitResult, GitOptions } from "../types";

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
  options: GitOptions = {}
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

export async function getStatus(): Promise<string> {
  const result = await git(["status", "--short"]);
  return result.stdout;
}

export async function getBranchName(): Promise<string> {
  const result = await git(["branch", "--show-current"]);
  return result.stdout || "main";
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
  options: GitOptions = {}
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

  const branch = await getBranchName();
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
