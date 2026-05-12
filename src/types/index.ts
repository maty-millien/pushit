export interface Config {
  apiKey: string;
  model: string;
  apiUrl: string;
}

export interface GitContext {
  branch: string;
  diff: string;
  status: string;
  commitHistory: string[];
}

export type GitErrorKind =
  | "git_not_found"
  | "not_repo"
  | "conflict_state"
  | "stage_failed"
  | "commit_failed"
  | "push_rejected"
  | "auth_failed"
  | "network_failed"
  | "upstream_missing"
  | "detached_head"
  | "unknown";

export interface GitResult {
  success: boolean;
  exitCode?: number | null;
  kind?: GitErrorKind;
  message?: string;
  error?: string;
  suggestions?: string[];
}

export interface GitCommandResult {
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

export interface RepositoryState {
  ok: boolean;
  branch: string;
  isDetached: boolean;
  hasRemote: boolean;
  inProgressOperation?: "merge" | "rebase" | "cherry-pick" | "revert";
  conflictPaths: string[];
  kind?: GitErrorKind;
  message?: string;
  suggestions?: string[];
}

export interface IndexSnapshot {
  tree: string;
}

export type FileStatusType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied";

export interface FileStatus {
  path: string;
  status: FileStatusType;
  oldPath?: string;
}

export interface FileDiffStats {
  path: string;
  insertions: number;
  deletions: number;
}

export interface GitOptions {
  dryRun?: boolean;
}
