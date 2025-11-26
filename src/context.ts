import * as git from "./git";

// Types
export interface ProjectInfo {
  type: "node" | "bun" | "rust" | "python" | "go" | "unknown";
  name?: string;
  version?: string;
}

export interface GitContext {
  branch: string;
  linkedIssue?: string;
  diff: string;
  status: string;
  changedFiles: string[];
  fileContents: Map<string, string>;
  commitHistory: string[];
  project: ProjectInfo;
}

// Constants
const MAX_FILE_SIZE = 50 * 1024; // 50KB
const MAX_LINES_PER_FILE = 500;
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pdf", ".zip", ".tar", ".gz", ".rar",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".exe", ".dll", ".so", ".dylib",
  ".lock", ".lockb",
]);

// Extract issue number from branch name
export function extractIssueFromBranch(branch: string): string | undefined {
  const patterns = [
    /\/(\d+)-/,              // feat/123-add-login
    /\/([A-Z]+-\d+)/,        // feat/PROJ-123-add-login
    /issue-(\d+)/i,          // issue-123
    /#(\d+)/,                // #123
    /-(\d+)$/,               // feature-123
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

// Detect project type from manifest files
export async function detectProjectType(): Promise<ProjectInfo> {
  const cwd = process.cwd();

  // Check for Bun first (more specific than Node)
  try {
    const bunLock = Bun.file(`${cwd}/bun.lockb`);
    if (await bunLock.exists()) {
      const pkg = await tryReadPackageJson(cwd);
      return { type: "bun", name: pkg?.name, version: pkg?.version };
    }
  } catch {}

  // Check for package.json (Node)
  try {
    const pkg = await tryReadPackageJson(cwd);
    if (pkg) {
      return { type: "node", name: pkg.name, version: pkg.version };
    }
  } catch {}

  // Check for Cargo.toml (Rust)
  try {
    const cargoFile = Bun.file(`${cwd}/Cargo.toml`);
    if (await cargoFile.exists()) {
      const content = await cargoFile.text();
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
      return {
        type: "rust",
        name: nameMatch?.[1],
        version: versionMatch?.[1],
      };
    }
  } catch {}

  // Check for pyproject.toml or setup.py (Python)
  try {
    const pyproject = Bun.file(`${cwd}/pyproject.toml`);
    const setup = Bun.file(`${cwd}/setup.py`);
    if ((await pyproject.exists()) || (await setup.exists())) {
      return { type: "python" };
    }
  } catch {}

  // Check for go.mod (Go)
  try {
    const goMod = Bun.file(`${cwd}/go.mod`);
    if (await goMod.exists()) {
      const content = await goMod.text();
      const moduleMatch = content.match(/module\s+(\S+)/);
      return { type: "go", name: moduleMatch?.[1] };
    }
  } catch {}

  return { type: "unknown" };
}

async function tryReadPackageJson(cwd: string): Promise<{ name?: string; version?: string } | null> {
  try {
    const pkgFile = Bun.file(`${cwd}/package.json`);
    if (await pkgFile.exists()) {
      return await pkgFile.json();
    }
  } catch {}
  return null;
}

// Check if file is binary based on extension
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// Read file contents with size and line limits
export async function readFileContents(files: string[]): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  const cwd = process.cwd();

  for (const file of files) {
    // Skip binary files
    if (isBinaryFile(file)) continue;

    try {
      const filePath = `${cwd}/${file}`;
      const bunFile = Bun.file(filePath);

      // Skip large files
      const size = bunFile.size;
      if (size > MAX_FILE_SIZE) continue;

      const text = await bunFile.text();
      const lines = text.split("\n");

      // Truncate to max lines
      if (lines.length > MAX_LINES_PER_FILE) {
        contents.set(file, lines.slice(0, MAX_LINES_PER_FILE).join("\n") + "\n... (truncated)");
      } else {
        contents.set(file, text);
      }
    } catch {
      // File might be deleted or inaccessible, skip it
    }
  }

  return contents;
}

// Build the complete context
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

// Build the AI prompt with all context
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

${fileContentSection ? `**File contents (for understanding context):**\n${fileContentSection}` : ""}`;
}
