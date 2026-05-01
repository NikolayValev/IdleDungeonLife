#!/usr/bin/env node

/**
 * CLI script to run balance tests
 * Compiles TypeScript and runs balance analysis
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const buildDir = path.join(projectRoot, ".test-build");
const reportsDir = path.join(projectRoot, "public", "balance-dashboard", "reports");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  profile: "baseline",
  runs: 10,
  compare: false,
  output: null,
  seedStart: 1000,
  carryMeta: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--profile" && i + 1 < args.length) {
    options.profile = args[++i];
  } else if (arg === "--runs" && i + 1 < args.length) {
    options.runs = parseInt(args[++i], 10);
  } else if (arg === "--compare") {
    options.compare = true;
  } else if (arg === "--output" && i + 1 < args.length) {
    options.output = args[++i];
  } else if (arg === "--seed" && i + 1 < args.length) {
    options.seedStart = parseInt(args[++i], 10);
  } else if (arg === "--carry-meta") {
    options.carryMeta = true;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Idle Dungeon Life - Balance Test Runner

Usage: node run-balance-test.mjs [options]

Options:
  --profile NAME      Profile to run (baseline, conservative, aggressive, long_run, speedrun)
                      Default: baseline
  --runs N            Number of runs per profile (default: 10)
  --compare           Compare all profiles instead of running a single profile
  --seed N            Starting seed for RNG (default: 1000)
  --carry-meta        Carry legacy/meta progression across runs in a profile
  --output FILE       Output HTML file path (default: public/balance-dashboard/reports)
  --help, -h          Show this help message
`);
    process.exit(0);
  }
}

// Validate numeric inputs early
if (isNaN(options.runs) || !Number.isInteger(options.runs) || options.runs <= 0) {
  console.error(`❌ Error: --runs must be a positive integer (got: "${options.runs}")`);
  process.exit(1);
}

if (isNaN(options.seedStart) || !Number.isInteger(options.seedStart)) {
  console.error(`❌ Error: --seed must be an integer (got: "${options.seedStart}")`);
  process.exit(1);
}

console.log("🎮 Idle Dungeon Life - Balance Test Runner\n");
console.log("🔨 Preparing build...\n");

try {
  // Clean and compile
  rmSync(buildDir, { recursive: true, force: true });

  const tscResult = spawnSync(process.execPath, [
    path.join(projectRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    "tsconfig.test.json",
  ], {
    cwd: projectRoot,
    stdio: "pipe",
  });

  if (tscResult.status !== 0) {
    console.error("❌ TypeScript compilation failed");
    console.error(tscResult.stderr.toString());
    process.exit(1);
  }

  mkdirSync(buildDir, { recursive: true });
  writeFileSync(
    path.join(buildDir, "package.json"),
    JSON.stringify({ type: "commonjs" }, null, 2)
  );

  // Load compiled modules
  const balanceRunnerPath = path.join(buildDir, "src/sim/balance-runner.js");
  const balanceProfilesPath = path.join(buildDir, "src/sim/balance-profiles.js");
  const balanceReportPath = path.join(buildDir, "src/sim/balance-report.js");

  const { runBalanceTest, runBalanceComparison } = await import(
    `file://${balanceRunnerPath}`
  );
  const { BALANCE_PROFILES } = await import(
    `file://${balanceProfilesPath}`
  );
  const { generateBalanceReport } = await import(
    `file://${balanceReportPath}`
  );

  // Validate profile name (after modules are loaded)
  if (!options.compare) {
    if (!BALANCE_PROFILES[options.profile]) {
      console.error(`❌ Error: Unknown profile "${options.profile}"`);
      console.error(
        `Available profiles: ${Object.keys(BALANCE_PROFILES).join(", ")}`
      );
      process.exit(1);
    }
  }

  // Determine output file
  const timestamp = new Date().toISOString().split("T")[0];
  mkdirSync(reportsDir, { recursive: true });
  const outputFile = options.output
    ? path.resolve(projectRoot, options.output)
    : path.join(reportsDir, `balance-report-${timestamp}-${Date.now() % 100000}.html`);
  const displayOutputPath = path.relative(projectRoot, outputFile) || outputFile;

  console.log("Options:");
  console.log(`  Runs per profile: ${options.runs}`);
  console.log(`  Compare mode: ${options.compare ? "Yes" : "No"}`);
  console.log(`  Starting seed: ${options.seedStart}`);
  console.log(`  Carry meta: ${options.carryMeta ? "Yes" : "No"}`);
  console.log(`  Output: ${displayOutputPath}\n`);

  let results;

  if (options.compare) {
    console.log("🔄 Running comparison across all profiles...\n");
    const profiles = Object.values(BALANCE_PROFILES);
    results = runBalanceComparison(profiles, options.seedStart, options.runs, {
      carryOverMeta: options.carryMeta,
    });
  } else {
    console.log(`▶️  Running profile: ${options.profile}`);
    const profile = BALANCE_PROFILES[options.profile];

    console.log(`   Duration: ${profile.durationSec / 3600} hours`);
    console.log(`   Milestones: ${profile.milestones?.length ?? 0}\n`);

    const startTime = Date.now();
    const stats = runBalanceTest(profile, options.seedStart, options.runs, {
      carryOverMeta: options.carryMeta,
    });
    const elapsed = (Date.now() - startTime) / 1000;

    results = [stats];

    console.log(`✓ Completed ${stats.completedRuns}/${stats.totalRuns} runs in ${elapsed.toFixed(1)}s\n`);
    console.log("Summary:");
    console.log(
      `  Avg Depth: ${stats.averages.depth.toFixed(1)} (${stats.minMax.minDepth}-${stats.minMax.maxDepth})`
    );
    console.log(
      `  Avg Survival: ${(stats.averages.survivalTime / 60).toFixed(1)} min`
    );
    console.log(`  Avg Discoveries: ${stats.averages.discoveries.toFixed(1)}`);
    console.log(`  Avg Ash: ${Math.round(stats.averages.ash)}`);
  }

  // Generate report
  const report = generateBalanceReport(results);
  writeFileSync(outputFile, report);

  console.log(`\n✓ Report generated: ${displayOutputPath}`);
} catch (error) {
  console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
