/**
 * build-avatar-atlas — curate ULPC sheets into public/assets/lpc/ and enforce
 * the credits gate (avatar-spec §4–§5).
 *
 * The project is non-commercial, so any ULPC license is allowed, but attribution
 * is still required for everything except CC0. This script is the build-time
 * guarantee of that: it FAILS (exit 1) if any non-CC0 curated sheet lacks an
 * author entry, so we can never ship uncredited art.
 *
 * Usage:
 *   npx tsx scripts/build-avatar-atlas.ts                 # validate manifest only
 *   npx tsx scripts/build-avatar-atlas.ts --ulpc <path>   # + vendor PNGs & credits
 *
 * <path> is a checkout of
 *   github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
 * The designer workflow (dress a mannequin in the ULPC web generator → export
 * JSON → map to these sheetIds) decides WHICH sheets; this script wires them in.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AVATAR_SHEETS, type LpcLicense } from "../src/content/avatarManifest.ts";

const ALLOWED_LICENSES: ReadonlySet<LpcLicense> = new Set([
  "CC0",
  "CC-BY",
  "CC-BY-SA",
  "OGA-BY",
  "GPL-3.0",
]);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "assets", "lpc");

interface CreditEntry {
  sheetId: string;
  file: string;
  license: LpcLicense;
  authors: string[];
  sourceUrl: string;
}

function fail(msg: string): never {
  console.error(`[build-avatar-atlas] ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { ulpc?: string } {
  const i = argv.indexOf("--ulpc");
  return i >= 0 && argv[i + 1] ? { ulpc: argv[i + 1] } : {};
}

/** Structural validation that runs with or without a ULPC checkout. */
function validateManifest(): void {
  const seen = new Set<string>();
  for (const s of AVATAR_SHEETS) {
    if (seen.has(s.sheetId)) fail(`duplicate sheetId: ${s.sheetId}`);
    seen.add(s.sheetId);
    if (!ALLOWED_LICENSES.has(s.license)) fail(`disallowed license "${s.license}" for ${s.sheetId}`);
    if (!Number.isFinite(s.zPos)) fail(`non-finite zPos for ${s.sheetId}`);
  }
  console.log(`[build-avatar-atlas] manifest OK: ${AVATAR_SHEETS.length} curated sheets.`);
}

/**
 * Resolve authors per sheet from ULPC's CREDITS.csv. Returns sheetId→authors.
 * CREDITS.csv columns vary; we match by the sheet's source filename appearing in
 * the row and read the "Author(s)" / "Licenses" columns by header.
 */
function loadCredits(ulpcPath: string): Map<string, string[]> {
  const csvPath = path.join(ulpcPath, "CREDITS.csv");
  if (!fs.existsSync(csvPath)) fail(`CREDITS.csv not found at ${csvPath}`);
  const rows = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
  const fileCol = header.findIndex((h) => h.includes("file") || h.includes("filename"));
  const authorCol = header.findIndex((h) => h.includes("author"));
  if (fileCol < 0 || authorCol < 0) fail("CREDITS.csv missing file/author columns");

  const byFile = new Map<string, string[]>();
  for (const row of rows.slice(1)) {
    const cols = row.split(",");
    const file = (cols[fileCol] ?? "").trim();
    const authors = (cols[authorCol] ?? "")
      .split(/[;|]/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (file) byFile.set(file, authors);
  }
  return byFile;
}

function vendor(ulpcPath: string): void {
  const credits = loadCredits(ulpcPath);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: CreditEntry[] = [];
  const uncredited: string[] = [];

  for (const s of AVATAR_SHEETS) {
    const src = path.join(ulpcPath, "spritesheets", `${s.sheetId}.png`);
    if (!fs.existsSync(src)) fail(`source sheet missing in ULPC checkout: ${s.sheetId}.png`);

    const dest = path.join(OUT_DIR, s.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);

    const authors = credits.get(`${s.sheetId}.png`) ?? s.authors;
    // Attribution gate: everything except CC0 must name an author.
    if (s.license !== "CC0" && authors.length === 0) uncredited.push(s.sheetId);

    manifest.push({ sheetId: s.sheetId, file: s.file, license: s.license, authors, sourceUrl: s.sourceUrl });
  }

  if (uncredited.length > 0) {
    fail(`missing credits for non-CC0 sheets:\n  - ${uncredited.join("\n  - ")}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, "credits.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `[build-avatar-atlas] vendored ${manifest.length} sheets → ${OUT_DIR}; credits.json written.`
  );
}

function main(): void {
  validateManifest();
  const { ulpc } = parseArgs(process.argv.slice(2));
  if (!ulpc) {
    console.log(
      "[build-avatar-atlas] no --ulpc checkout given: validation only.\n" +
        "  Provide one to vendor PNGs and generate the credits manifest."
    );
    return;
  }
  if (!fs.existsSync(ulpc)) fail(`ULPC checkout not found: ${ulpc}`);
  vendor(ulpc);
}

main();
