import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const OWNER_FILE = join(process.cwd(), ".runtime", "playwright-server-owner.txt");

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
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
      execFileSync(npmCommand(), ["run", "dev:stop"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
    }
  } finally {
    rmSync(OWNER_FILE, { force: true });
  }
}
