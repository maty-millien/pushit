import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  commit,
  getRepositoryState,
  git,
  push,
  restoreIndex,
  snapshotIndex,
  stageAll,
} from "./commands";

let originalCwd = process.cwd();
let repoDir = "";
let extraDirs: string[] = [];

async function run(args: string[], cwd = repoDir): Promise<void> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

async function write(path: string, content: string): Promise<void> {
  await writeFile(join(repoDir, path), content);
}

async function initRepo(): Promise<void> {
  await run(["init", "-b", "main"]);
  await run(["config", "user.email", "test@example.com"]);
  await run(["config", "user.name", "Test User"]);
  await write("tracked.txt", "base\n");
  await run(["add", "tracked.txt"]);
  await run(["commit", "-m", "chore: initial"]);
}

describe("git commands", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    repoDir = await mkdtemp(join(tmpdir(), "pushit-"));
    process.chdir(repoDir);
    await initRepo();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(repoDir, { recursive: true, force: true });
    await Promise.all(
      extraDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
    extraDirs = [];
  });

  test("restores the original staged state after auto-staging", async () => {
    await write("tracked.txt", "staged\n");
    await run(["add", "tracked.txt"]);
    await write("other.txt", "unstaged\n");

    const snapshotResult = await snapshotIndex();
    expect(snapshotResult.success).toBe(true);

    const stageResult = await stageAll();
    expect(stageResult.success).toBe(true);

    const restoreResult = await restoreIndex(snapshotResult.snapshot);
    expect(restoreResult.success).toBe(true);

    const status = await git(["status", "--short"]);
    const lines = status.stdout.split("\n").filter(Boolean);
    expect(lines).toContain("M  tracked.txt");
    expect(lines).toContain("?? other.txt");
  });

  test("blocks merge conflicts before staging", async () => {
    await run(["checkout", "-b", "feature"]);
    await write("tracked.txt", "feature\n");
    await run(["commit", "-am", "feat: feature"]);
    await run(["checkout", "main"]);
    await write("tracked.txt", "main\n");
    await run(["commit", "-am", "feat: main"]);

    const merge = Bun.spawn(["git", "merge", "feature"], {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await merge.exited;

    const state = await getRepositoryState();
    expect(state.ok).toBe(false);
    expect(state.kind).toBe("conflict_state");
    expect(state.inProgressOperation).toBe("merge");
    expect(state.conflictPaths).toContain("tracked.txt");
    expect(state.suggestions).toContain("git merge --abort");
  });

  test("detects detached HEAD and prevents push", async () => {
    const head = await git(["rev-parse", "HEAD"]);
    await run(["checkout", "--detach", head.stdout]);

    const state = await getRepositoryState();
    expect(state.ok).toBe(true);
    expect(state.isDetached).toBe(true);

    const pushResult = await push();
    expect(pushResult.success).toBe(false);
    expect(pushResult.kind).toBe("detached_head");
  });

  test("classifies commit failures", async () => {
    const result = await commit("chore: empty");
    expect(result.success).toBe(false);
    expect(result.kind).toBe("commit_failed");
    expect(result.message).toBeTruthy();
  });

  test("commits staged changes successfully", async () => {
    await write("tracked.txt", "changed\n");
    await stageAll();

    const result = await commit("fix: update tracked file");
    expect(result.success).toBe(true);

    const log = await git(["log", "-1", "--pretty=%s"]);
    expect(log.stdout).toBe("fix: update tracked file");
  });

  test("classifies non-fast-forward push rejection", async () => {
    const remoteDir = await mkdtemp(join(tmpdir(), "pushit-remote-"));
    const cloneDir = await mkdtemp(join(tmpdir(), "pushit-clone-"));
    extraDirs.push(remoteDir, cloneDir);

    await run(["init", "--bare", remoteDir]);
    await run(["remote", "add", "origin", remoteDir]);
    await run(["push", "-u", "origin", "main"]);

    await run(["clone", remoteDir, cloneDir], originalCwd);
    await run(["config", "user.email", "other@example.com"], cloneDir);
    await run(["config", "user.name", "Other User"], cloneDir);
    await writeFile(join(cloneDir, "remote.txt"), "remote\n");
    await run(["add", "remote.txt"], cloneDir);
    await run(["commit", "-m", "feat: remote change"], cloneDir);
    await run(["push"], cloneDir);

    await write("local.txt", "local\n");
    await stageAll();
    const commitResult = await commit("feat: local change");
    expect(commitResult.success).toBe(true);

    const pushResult = await push();
    expect(pushResult.success).toBe(false);
    expect(pushResult.kind).toBe("push_rejected");
    expect(pushResult.suggestions).toContain("git pull --rebase");
  });
});
