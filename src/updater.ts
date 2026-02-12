import * as p from "@clack/prompts";
import pc from "picocolors";
import { homedir } from "os";
import { join } from "path";
import { VERSION } from "./config";

const CACHE_FILE = join(homedir(), ".config", "pushit", ".update-check");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REMOTE_PACKAGE_URL =
  "https://raw.githubusercontent.com/maty-millien/pushit/main/package.json";
const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/maty-millien/pushit/main/install.sh";

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

function readUpdateCache(): UpdateCache | null {
  try {
    const file = Bun.file(CACHE_FILE);
    if (!file.size) return null;
    const data = JSON.parse(
      new TextDecoder().decode(file.bytes() as unknown as ArrayBuffer),
    );
    if (typeof data.lastCheck === "number" && typeof data.latestVersion === "string") {
      return data as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeUpdateCache(latestVersion: string): Promise<void> {
  try {
    const cache: UpdateCache = { lastCheck: Date.now(), latestVersion };
    await Bun.write(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // Non-fatal
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(REMOTE_PACKAGE_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function isNewer(current: string, latest: string): boolean {
  const cur = current.split(".").map(Number);
  const lat = latest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const c = cur[i] ?? 0;
    const l = lat[i] ?? 0;
    if (isNaN(c) || isNaN(l)) return false;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function runInstallScript(): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ["bash", "-c", `curl -fsSL ${INSTALL_SCRIPT_URL} | bash -s -- --upgrade`],
      { stdout: "ignore", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

function reExec(): never {
  const binary = join(homedir(), ".local", "bin", "pushit");
  const args = process.argv.slice(2);
  const result = Bun.spawnSync([binary, ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  process.exit(result.exitCode);
}

export async function checkForUpdates(): Promise<void> {
  let latestVersion: string | null;

  const cache = readUpdateCache();
  if (cache && Date.now() - cache.lastCheck < CACHE_TTL_MS) {
    latestVersion = cache.latestVersion;
  } else {
    latestVersion = await fetchLatestVersion();
    if (latestVersion) {
      await writeUpdateCache(latestVersion);
    }
  }

  if (!latestVersion || !isNewer(VERSION, latestVersion)) return;

  const spinner = p.spinner();
  spinner.start(
    `Updating pushit ${pc.dim(`v${VERSION}`)} → ${pc.dim(`v${latestVersion}`)}`,
  );

  const success = await runInstallScript();

  if (success) {
    spinner.stop(`Updated pushit to ${pc.dim(`v${latestVersion}`)}`);
    reExec();
  } else {
    spinner.stop(
      pc.yellow(`Update failed — continuing with v${VERSION}`),
    );
  }
}
