import type { GitResult } from "./types";

let dryRun = false;

export function setDryRun(value: boolean): void {
  dryRun = value;
}

export function isDryRun(): boolean {
  return dryRun;
}

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
  if (dryRun) return;
  git(["add", "-A"]);
}

export function getStagedDiff(): string {
  if (dryRun) {
    // In dry run, show all changes (staged + unstaged)
    const staged = git(["diff", "--cached"]);
    const unstaged = git(["diff"]);
    return [staged.stdout, unstaged.stdout].filter(Boolean).join("\n");
  }
  const result = git(["diff", "--cached"]);
  return result.stdout;
}

export function getChangedFiles(): string[] {
  if (dryRun) {
    // In dry run, show all changed files (staged + unstaged + untracked)
    const staged = git(["diff", "--cached", "--name-only"]);
    const unstaged = git(["diff", "--name-only"]);
    const untracked = git(["ls-files", "--others", "--exclude-standard"]);
    const allFiles = [staged.stdout, unstaged.stdout, untracked.stdout]
      .filter(Boolean)
      .join("\n");
    return [...new Set(allFiles.split("\n").filter(Boolean))];
  }
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
  if (dryRun) {
    return { success: true };
  }
  const result = git(["commit", "-m", message]);
  return {
    success: result.success,
    error: result.success ? undefined : result.stderr,
  };
}

export function push(): GitResult {
  if (dryRun) {
    return { success: true };
  }
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
  if (dryRun) return;
  git(["reset"]);
}
