import { MAX_DIFF_CHARS, MAX_PROMPT_CHARS } from "../config";
import promptTemplate from "../prompt.md" with { type: "text" };
import type { GitContext, GitOptions } from "../types";
import * as git from "./commands";

function truncateDiff(diff: string, maxChars: number): string {
  if (!diff || diff.length <= maxChars) return diff;

  const fileSections = diff.split(/(?=^diff --git )/m);
  let result = "";

  for (let i = 0; i < fileSections.length; i++) {
    if (result.length + fileSections[i].length > maxChars) {
      const remaining = fileSections.length - i;
      result += `\n... (${remaining} more file(s) truncated)`;
      break;
    }
    result += fileSections[i];
  }

  return result;
}

export async function buildContext(
  options: GitOptions = {},
): Promise<GitContext> {
  const [{ branch, status }, diff, commitHistory] = await Promise.all([
    git.getStatusWithBranch(),
    git.getStagedDiff(options),
    git.getCommitHistory(5),
  ]);

  return { branch, diff, status, commitHistory };
}

export function buildPrompt(context: GitContext): string {
  const diff = truncateDiff(context.diff, MAX_DIFF_CHARS);

  let prompt = promptTemplate
    .replace("{{branch}}", context.branch)
    .replace("{{commitHistory}}", context.commitHistory.join("\n") || "None")
    .replace("{{status}}", context.status || "None")
    .replace("{{diff}}", diff || "None");

  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = prompt.slice(0, MAX_PROMPT_CHARS) + "\n... (truncated)";
  }

  return prompt;
}
