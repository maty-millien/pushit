export interface Config {
  apiKey: string;
  model: string;
  apiUrl: string;
}

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

export interface GitResult {
  success: boolean;
  error?: string;
}
