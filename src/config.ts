import * as p from "@clack/prompts";
import type { Config } from "./types";

export const API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-2.5-flash-preview-09-2025";

export const MAX_FILE_SIZE = 50 * 1024; // 50 KB
export const MAX_LINES_PER_FILE = 500;

export const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".lock",
  ".lockb",
]);

export function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    p.cancel("OPENROUTER_API_KEY environment variable is not set");
    process.exit(1);
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    apiUrl: API_URL,
  };
}
