import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

let exitCode = 0;

try {
  rmSync(".test-build", { recursive: true, force: true });
  run(process.execPath, [path.join("node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.test.json"]);
  mkdirSync(".test-build", { recursive: true });
  writeFileSync(".test-build/package.json", JSON.stringify({ type: "commonjs" }, null, 2));
  const unitTests = readdirSync("tests/unit")
    .filter((file) => file.endsWith(".test.cjs"))
    .map((file) => path.join("tests/unit", file));
  run(process.execPath, ["--test", "--test-concurrency=1", "--test-isolation=none", ...unitTests]);
} catch (error) {
  exitCode = 1;
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
} finally {
  rmSync(".test-build", { recursive: true, force: true });
}

process.exit(exitCode);
