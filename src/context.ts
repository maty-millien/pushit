import * as path from "path";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE, MAX_LINES_PER_FILE } from "./config";
import * as git from "./git";
import type { GitContext, ProjectInfo } from "./types";
import promptTemplate from "./PROMPT.md" with { type: "text" };

export function extractIssueFromBranch(branch: string): string | undefined {
  const patterns = [
    /\/(\d+)-/,
    /\/([A-Z]+-\d+)/,
    /issue-(\d+)/i,
    /#(\d+)/,
    /-(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

export async function detectProjectType(): Promise<ProjectInfo> {
  const cwd = process.cwd();

  const bunLockPath = path.join(cwd, "bun.lockb");
  if (await fileExists(bunLockPath)) {
    const pkg = await tryReadPackageJson(cwd);
    return { type: "bun", name: pkg?.name, version: pkg?.version };
  }

  const pkg = await tryReadPackageJson(cwd);
  if (pkg) {
    return { type: "node", name: pkg.name, version: pkg.version };
  }
  const cargoPath = path.join(cwd, "Cargo.toml");
  if (await fileExists(cargoPath)) {
    const content = await safeReadFile(cargoPath);
    if (content) {
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
      return {
        type: "rust",
        name: nameMatch?.[1],
        version: versionMatch?.[1],
      };
    }
  }

  const pyprojectPath = path.join(cwd, "pyproject.toml");
  const setupPath = path.join(cwd, "setup.py");
  if ((await fileExists(pyprojectPath)) || (await fileExists(setupPath))) {
    return { type: "python" };
  }

  const goModPath = path.join(cwd, "go.mod");
  if (await fileExists(goModPath)) {
    const content = await safeReadFile(goModPath);
    if (content) {
      const moduleMatch = content.match(/module\s+(\S+)/);
      return { type: "go", name: moduleMatch?.[1] };
    }
  }

  return { type: "unknown" };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await Bun.file(filePath).text();
  } catch {
    return null;
  }
}

async function tryReadPackageJson(
  cwd: string
): Promise<{ name?: string; version?: string } | null> {
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fileExists(pkgPath))) return null;

  try {
    return await Bun.file(pkgPath).json();
  } catch {
    return null;
  }
}

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export async function readFileContents(
  files: string[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  const cwd = process.cwd();

  for (const file of files) {
    if (isBinaryFile(file)) continue;

    try {
      const filePath = path.join(cwd, file);
      const bunFile = Bun.file(filePath);

      const size = bunFile.size;
      if (size > MAX_FILE_SIZE) continue;

      const text = await bunFile.text();
      const lines = text.split("\n");

      if (lines.length > MAX_LINES_PER_FILE) {
        contents.set(
          file,
          `${lines.slice(0, MAX_LINES_PER_FILE).join("\n")}\n... (truncated)`
        );
      } else {
        contents.set(file, text);
      }
    } catch {}
  }

  return contents;
}

export async function buildContext(): Promise<GitContext> {
  const branch = git.getBranchName();
  const changedFiles = git.getChangedFiles();

  const [project, fileContents] = await Promise.all([
    detectProjectType(),
    readFileContents(changedFiles),
  ]);

  return {
    branch,
    linkedIssue: extractIssueFromBranch(branch),
    diff: git.getStagedDiff(),
    status: git.getStatus(),
    changedFiles,
    fileContents,
    commitHistory: git.getCommitHistory(20),
    project,
  };
}

export function buildPrompt(context: GitContext): string {
  const projectInfo = [
    `Type: ${context.project.type}`,
    context.project.name ? `Name: ${context.project.name}` : null,
    context.project.version ? `Version: ${context.project.version}` : null,
    context.linkedIssue ? `Related Issue: #${context.linkedIssue}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const fileContents = Array.from(context.fileContents.entries())
    .map(([file, content]) => `--- ${file} ---\n${content}`)
    .join("\n\n");

  return promptTemplate
    .replace("{{branch}}", context.branch)
    .replace("{{projectInfo}}", projectInfo)
    .replace("{{commitHistory}}", context.commitHistory.join("\n") || "None")
    .replace("{{changedFiles}}", context.changedFiles.join("\n") || "None")
    .replace("{{status}}", context.status || "None")
    .replace("{{diff}}", context.diff || "None")
    .replace(
      "{{fileContents}}",
      fileContents ? `**File contents:**\n${fileContents}` : ""
    );
}
