import { extname, join } from "path";
import {
  BINARY_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_LINES_PER_FILE,
} from "../config";
import promptTemplate from "../prompt.md" with { type: "text" };
import type { GitContext, GitOptions } from "../types";
import * as git from "./commands";

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

function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export async function readFileContents(
  files: string[],
): Promise<Map<string, string>> {
  const cwd = process.cwd();

  // Filter binary files first (synchronous, fast)
  const textFiles = files.filter((file) => !isBinaryFile(file));

  // Read all files in parallel for faster I/O
  const results = await Promise.all(
    textFiles.map(async (file) => {
      try {
        const bunFile = Bun.file(join(cwd, file));
        if (bunFile.size > MAX_FILE_SIZE) return null;

        const text = await bunFile.text();
        const lines = text.split("\n");

        if (lines.length > MAX_LINES_PER_FILE) {
          return [
            file,
            `${lines.slice(0, MAX_LINES_PER_FILE).join("\n")}\n... (truncated)`,
          ] as const;
        }
        return [file, text] as const;
      } catch {
        return null;
      }
    }),
  );

  return new Map(results.filter((r): r is [string, string] => r !== null));
}

export async function buildContext(
  options: GitOptions = {},
): Promise<GitContext> {
  const [branch, changedFiles, status, diff, commitHistory] = await Promise.all(
    [
      git.getBranchName(),
      git.getChangedFiles(options),
      git.getStatus(),
      git.getStagedDiff(options),
      git.getCommitHistory(20),
    ],
  );

  const fileContents = await readFileContents(changedFiles);

  return {
    branch,
    linkedIssue: extractIssueFromBranch(branch),
    diff,
    status,
    changedFiles,
    fileContents,
    commitHistory,
  };
}

export function buildPrompt(context: GitContext): string {
  const fileContents = Array.from(context.fileContents.entries())
    .map(([file, content]) => `--- ${file} ---\n${content}`)
    .join("\n\n");

  return promptTemplate
    .replace("{{branch}}", context.branch)
    .replace("{{commitHistory}}", context.commitHistory.join("\n") || "None")
    .replace("{{changedFiles}}", context.changedFiles.join("\n") || "None")
    .replace("{{status}}", context.status || "None")
    .replace("{{diff}}", context.diff || "None")
    .replace(
      "{{fileContents}}",
      fileContents ? `**File contents:**\n${fileContents}` : "",
    );
}
