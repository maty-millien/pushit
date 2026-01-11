import { join, extname } from "path";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE, MAX_LINES_PER_FILE } from "../config";
import * as git from "./commands";
import type { GitContext, ProjectInfo, GitOptions } from "../types";
import promptTemplate from "../prompt.md" with { type: "text" };

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

  const bunLockPath = join(cwd, "bun.lockb");
  if (await fileExists(bunLockPath)) {
    const pkg = await tryReadPackageJson(cwd);
    return { type: "bun", name: pkg?.name, version: pkg?.version };
  }

  const pkg = await tryReadPackageJson(cwd);
  if (pkg) {
    return { type: "node", name: pkg.name, version: pkg.version };
  }
  const cargoPath = join(cwd, "Cargo.toml");
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

  const pyprojectPath = join(cwd, "pyproject.toml");
  const setupPath = join(cwd, "setup.py");
  if ((await fileExists(pyprojectPath)) || (await fileExists(setupPath))) {
    return { type: "python" };
  }

  const goModPath = join(cwd, "go.mod");
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
    // Treat any error as "does not exist"
    return false;
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await Bun.file(filePath).text();
  } catch {
    // Return null if file can't be read
    return null;
  }
}

async function tryReadPackageJson(
  cwd: string
): Promise<{ name?: string; version?: string } | null> {
  const pkgPath = join(cwd, "package.json");
  if (!(await fileExists(pkgPath))) return null;

  try {
    return await Bun.file(pkgPath).json();
  } catch {
    // Return null if JSON parsing fails
    return null;
  }
}

function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
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
      const filePath = join(cwd, file);
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
    } catch {
      // Skip files that can't be read
    }
  }

  return contents;
}

export async function buildContext(options: GitOptions = {}): Promise<GitContext> {
  const [branch, changedFiles, status, diff, commitHistory, project] = await Promise.all([
    git.getBranchName(),
    git.getChangedFiles(options),
    git.getStatus(),
    git.getStagedDiff(options),
    git.getCommitHistory(20),
    detectProjectType(),
  ]);

  const fileContents = await readFileContents(changedFiles);

  return {
    branch,
    linkedIssue: extractIssueFromBranch(branch),
    diff,
    status,
    changedFiles,
    fileContents,
    commitHistory,
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
