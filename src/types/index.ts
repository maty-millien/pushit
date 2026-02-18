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

export interface GitResult {
  success: boolean;
  error?: string;
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
