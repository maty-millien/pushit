import * as p from "@clack/prompts";
import { homedir } from "os";
import { join } from "path";
import type { Config } from "./types";

export const API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODEL = "google/gemini-2.5-flash-preview-09-2025";
export const CONFIG_PATH = join(homedir(), ".config", "pushit", ".env");

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

async function loadEnvFile(): Promise<Record<string, string>> {
  const file = Bun.file(CONFIG_PATH);
  if (!file.size) return {};

  try {
    const content = await file.text();
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    // Return empty config if file can't be read
    return {};
  }
}

export async function loadConfig(): Promise<Config> {
  const fileEnv = await loadEnvFile();
  const apiKey = process.env.OPENROUTER_API_KEY || fileEnv.OPENROUTER_API_KEY;

  if (!apiKey) {
    p.cancel(`OPENROUTER_API_KEY not set. Add it to ${CONFIG_PATH} or export it.`);
    process.exit(1);
  }

  return {
    apiKey,
    model: OPENROUTER_MODEL,
    apiUrl: API_URL,
  };
}
