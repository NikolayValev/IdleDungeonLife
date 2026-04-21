import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "http://127.0.0.1:5174";
const RUNTIME_DIR = join(process.cwd(), ".runtime");
const OWNER_FILE = join(RUNTIME_DIR, "playwright-server-owner.txt");

function runNpmScript(script: string): void {
  execSync(`npm run ${script}`, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function isServerReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(RUNTIME_DIR, { recursive: true });

  if (await isServerReady(BASE_URL)) {
    writeFileSync(OWNER_FILE, "reused\n", "utf8");
    return;
  }

  runNpmScript("dev:start");

  await waitForServer(BASE_URL, 15_000);
  writeFileSync(OWNER_FILE, "started\n", "utf8");
}
