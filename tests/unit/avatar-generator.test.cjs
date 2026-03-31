const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildCharacterVisualInputFromRun,
  deriveCharacterVisualState,
  alignmentFromScore,
} = require("../../.test-build/src/ui/avatar/deriveVisualState.js");
const { buildCharacterSvg } = require("../../.test-build/src/ui/avatar/buildCharacterSvg.js");
const { svgToPngBuffer } = require("../../.test-build/src/ui/avatar/rasterizeSvg.js");
const { exportAvatarAtlas } = require("../../.test-build/src/ui/avatar/atlas.js");
const { startRun, grantItem } = require("./helpers.cjs");

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

test("avatar derivation and svg output are deterministic", () => {
  const input = {
    seed: "run-42",
    alignment: "unholy",
    vitality01: 0.18,
    visibleTraitIds: ["abyss_drawn", "grave_touched"],
    hiddenTraitIds: ["fated"],
    equippedItemTags: ["abyss", "unholy"],
  };

  const left = deriveCharacterVisualState(input);
  const right = deriveCharacterVisualState(input);

  assert.deepStrictEqual(left, right);
  assert.equal(left.horns, 2);
  assert.equal(left.overlays, 1);
  assert.equal(buildCharacterSvg(left), buildCharacterSvg(right));
});

test("holy and worn states visibly diverge in resolved state", () => {
  const holy = deriveCharacterVisualState({
    seed: "run-7",
    alignment: "holy",
    vitality01: 0.92,
    visibleTraitIds: [],
    hiddenTraitIds: [],
    equippedItemTags: ["holy"],
  });
  const worn = deriveCharacterVisualState({
    seed: "run-7",
    alignment: "unholy",
    vitality01: 0.12,
    visibleTraitIds: ["abyss_drawn"],
    hiddenTraitIds: ["grave_touched"],
    equippedItemTags: ["unholy", "abyss"],
  });

  assert.equal(holy.horns, 0);
  assert.equal(holy.overlays, 0);
  assert.equal(worn.headOffsetY, 8);
  assert.equal(worn.armsOffsetY, 4);
  assert.notEqual(holy.paletteId, worn.paletteId);
});

test("svg rasterization is deterministic and transparent-friendly", () => {
  const state = deriveCharacterVisualState({
    seed: 99,
    alignment: "neutral",
    vitality01: 0.5,
    visibleTraitIds: ["obsessive"],
    hiddenTraitIds: [],
    equippedItemTags: ["fate"],
  });
  const svg = buildCharacterSvg(state);
  const first = svgToPngBuffer(svg, 64);
  const second = svgToPngBuffer(svg, 64);

  assert.equal(first.equals(second), true);
  assert.equal(svg.includes("viewBox=\"0 0 512 512\""), true);
  assert.equal(svg.includes("<path"), false);
  assert.equal(svg.includes("var(--c0)"), true);
});

test("atlas export returns deterministic frame placement", async () => {
  const samples = ["a", "b", "c", "d", "e"].map((seed) => {
    const state = deriveCharacterVisualState({
      seed,
      alignment: "neutral",
      vitality01: 0.6,
      visibleTraitIds: [],
      hiddenTraitIds: [],
      equippedItemTags: [],
    });

    return { key: seed, svg: buildCharacterSvg(state) };
  });

  const [page] = await exportAvatarAtlas(samples, { cols: 2, paddingPx: 2, cellSize: 512 });

  assert.deepStrictEqual(page.frames.a, { x: 2, y: 2, w: 512, h: 512 });
  assert.deepStrictEqual(page.frames.c, { x: 2, y: 518, w: 512, h: 512 });
  assert.ok(page.png.length > 0);
});

test("run adapter builds avatar input from current run state", () => {
  let save = startRun(777, 1000);
  save = grantItem(save, "grave_shroud");
  save = grantItem(save, "hollow_bone");
  save = grantItem(save, "grave_dagger");

  const run = save.currentRun;
  assert.ok(run);

  const input = buildCharacterVisualInputFromRun(run);
  assert.equal(input.seed, 777);
  assert.equal(input.alignment, alignmentFromScore(run.alignment.holyUnholy));
  assert.ok(input.equippedItemTags.every((tag) => typeof tag === "string"));
});

test("avatar generator files do not use Math.random", () => {
  const files = walk(path.join(process.cwd(), "src", "ui", "avatar"));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("Math.random"), false, file);
  }
});
