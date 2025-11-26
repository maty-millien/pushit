import * as path from "path";
import * as git from "./git";
import type { GitContext, ProjectInfo } from "./types";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE, MAX_LINES_PER_FILE } from "./config";

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

  // Check for Bun project
  const bunLockPath = path.join(cwd, "bun.lockb");
  if (await fileExists(bunLockPath)) {
    const pkg = await tryReadPackageJson(cwd);
    return { type: "bun", name: pkg?.name, version: pkg?.version };
  }

  // Check for Node project
  const pkg = await tryReadPackageJson(cwd);
  if (pkg) {
    return { type: "node", name: pkg.name, version: pkg.version };
  }

  // Check for Rust project
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

  // Check for Python project
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  const setupPath = path.join(cwd, "setup.py");
  if ((await fileExists(pyprojectPath)) || (await fileExists(setupPath))) {
    return { type: "python" };
  }

  // Check for Go project
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
    } catch {
      // Skip files that can't be read (permissions, etc.)
    }
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
  const fileContentSection = Array.from(context.fileContents.entries())
    .map(([file, content]) => `--- ${file} ---\n${content}`)
    .join("\n\n");

  const projectInfo = [
    `- Type: ${context.project.type}`,
    context.project.name ? `- Name: ${context.project.name}` : null,
    context.project.version ? `- Version: ${context.project.version}` : null,
    `- Branch: ${context.branch}`,
    context.linkedIssue ? `- Related Issue: #${context.linkedIssue}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an expert Git commit message generator. Your sole task is to produce a single, concise, and conventionally formatted commit message subject line.

**Output Rules:**

1.  **Conventional Commits:** The output must strictly adhere to the Conventional Commits specification.
2.  **Format:** The entire output must be a single line in the format: \`<type>(<optional-scope>): <description>\`
3.  **Type:** The \`<type>\` must be one of the following:
    * \`feat\`: A new feature for the user.
    * \`fix\`: A bug fix for the user.
    * \`docs\`: Documentation-only changes.
    * \`style\`: Changes that do not affect the meaning of the code (white-space, formatting, etc.).
    * \`refactor\`: A code change that neither fixes a bug nor adds a feature.
    * \`perf\`: A code change that improves performance.
    * \`test\`: Adding missing tests or correcting existing tests.
    * \`build\`: Changes that affect the build system or external dependencies.
    * \`ci\`: Changes to CI configuration files and scripts.
    * \`chore\`: Other changes that don't modify \`src\` or \`test\` files.
4.  **Scope:** The \`<optional-scope>\` should be a noun describing a section of the codebase (e.g., \`api\`, \`ui\`, \`auth\`).
5.  **Description:** The \`<description>\` must:
    * Be a short summary of the code changes.
    * Be written in the imperative mood (e.g., "add feature" not "added feature").
    * Not be capitalized.
    * Not end with a period.
6.  **Conciseness:** The entire message must be 50 characters or less.
7.  **Purity:** The output must ONLY be the generated commit message string. Do not include any explanations, introductory text, or markdown formatting.

**Example of a valid output:**
\`feat(auth): add user login endpoint\`

**Project Information:**
${projectInfo}

**Recent commits (for style reference):**
${context.commitHistory.join("\n") || "No previous commits"}

**Changed files:**
${context.changedFiles.join("\n") || "No files changed"}

**Git status:**
${context.status || "No status"}

**Git diff (staged changes):**
${context.diff || "No diff"}

${
  fileContentSection
    ? `**File contents (for understanding context):**\n${fileContentSection}`
    : ""
}`;
}
