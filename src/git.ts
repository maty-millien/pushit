import type { GitResult } from "./types";

function git(args: string[]): {
  stdout: string;
  success: boolean;
  stderr: string;
} {
  const result = Bun.spawnSync(["git", ...args]);
  return {
    stdout: new TextDecoder().decode(result.stdout).trim(),
    stderr: new TextDecoder().decode(result.stderr).trim(),
    success: result.exitCode === 0,
  };
}

export function isGitRepo(): boolean {
  const result = git(["rev-parse", "--is-inside-work-tree"]);
  return result.success && result.stdout === "true";
}

export function hasChanges(): boolean {
  const staged = git(["diff", "--cached", "--quiet"]);
  const unstaged = git(["diff", "--quiet"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);

  return !staged.success || !unstaged.success || untracked.stdout.length > 0;
}

export function stageAll(): void {
  git(["add", "-A"]);
}

export function getStagedDiff(): string {
  const result = git(["diff", "--cached"]);
  return result.stdout;
}

export function getChangedFiles(): string[] {
  const result = git(["diff", "--cached", "--name-only"]);
  if (!result.stdout) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export function getStatus(): string {
  const result = git(["status", "--short"]);
  return result.stdout;
}

export function getBranchName(): string {
  const result = git(["branch", "--show-current"]);
  return result.stdout || "main";
}

export function getCommitHistory(count: number = 20): string[] {
  const result = git(["log", `-${count}`, "--pretty=format:%s", "--no-merges"]);
  if (!result.stdout) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export function hasRemote(): boolean {
  const result = git(["remote"]);
  return result.stdout.length > 0;
}

export function commit(message: string): GitResult {
  const result = git(["commit", "-m", message]);
  return {
    success: result.success,
    error: result.success ? undefined : result.stderr,
  };
}

export function push(): GitResult {
  const result = git(["push"]);
  if (result.success) {
    return { success: true };
  }

  const branch = getBranchName();
  const upstreamResult = git(["push", "--set-upstream", "origin", branch]);
  return {
    success: upstreamResult.success,
    error: upstreamResult.success ? undefined : upstreamResult.stderr,
  };
}

export function unstage(): void {
  git(["reset"]);
}
