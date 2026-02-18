import * as p from "@clack/prompts";
import { homedir } from "os";
import { join } from "path";
import pkg from "../package.json";
import type { Config } from "./types";

export const VERSION = pkg.version;

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
// const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";
const OPENROUTER_MODEL = "mistralai/ministral-3b-2512";
const CONFIG_PATH = join(homedir(), ".config", "pushit", ".env");

export const MAX_DIFF_CHARS = 24_000;
export const MAX_PROMPT_CHARS = 32_000;

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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

export async function loadConfig(): Promise<Config> {
  const fileEnv = await loadEnvFile();
  const apiKey = fileEnv.OPENROUTER_API_KEY;

  if (!apiKey) {
    p.cancel(
      `OPENROUTER_API_KEY not set. Add it to ${CONFIG_PATH} or export it.`,
    );
    process.exit(1);
  }

  return {
    apiKey,
    model: OPENROUTER_MODEL,
    apiUrl: API_URL,
  };
}
