import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const OWNER_FILE = join(process.cwd(), ".runtime", "playwright-server-owner.txt");

function runNpmScript(script: string): void {
  execSync(`npm run ${script}`, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
}

export default async function globalTeardown(): Promise<void> {
  let owner = "";
  try {
    owner = readFileSync(OWNER_FILE, "utf8").trim();
  } catch {
    owner = "";
  }

  try {
    if (owner === "started") {
      runNpmScript("dev:stop");
    }
  } finally {
    rmSync(OWNER_FILE, { force: true });
  }
}
