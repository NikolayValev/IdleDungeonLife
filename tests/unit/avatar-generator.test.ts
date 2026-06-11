import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  buildCharacterVisualInputFromRun,
  deriveCharacterVisualState,
  alignmentFromScore,
} from "../../src/ui/avatar/deriveVisualState";
import type { VisualAlignment } from "../../src/ui/avatar/types";
import { buildCharacterSvg } from "../../src/ui/avatar/buildCharacterSvg";
import { svgToPngBuffer } from "../../src/ui/avatar/rasterizeSvg";
import { exportAvatarAtlas } from "../../src/ui/avatar/atlas";
import { startRun, grantItem } from "./helpers";

function walk(dir: string, results: string[] = []): string[] {
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
    alignment: "unholy" as VisualAlignment,
    vitality01: 0.18,
    visibleTraitIds: ["abyss_drawn", "grave_touched"],
    hiddenTraitIds: ["fated"],
    equippedItemTags: ["abyss", "unholy"],
  };

  const left = deriveCharacterVisualState(input);
  const right = deriveCharacterVisualState(input);

  expect(left).toStrictEqual(right);
  expect(left.horns).toBe(2);
  expect(left.overlays).toBe(1);
  expect(buildCharacterSvg(left)).toBe(buildCharacterSvg(right));
});

test("holy and worn states visibly diverge in resolved state", () => {
  const holy = deriveCharacterVisualState({
    seed: "run-7",
    alignment: "holy" as VisualAlignment,
    vitality01: 0.92,
    visibleTraitIds: [],
    hiddenTraitIds: [],
    equippedItemTags: ["holy"],
  });
  const worn = deriveCharacterVisualState({
    seed: "run-7",
    alignment: "unholy" as VisualAlignment,
    vitality01: 0.12,
    visibleTraitIds: ["abyss_drawn"],
    hiddenTraitIds: ["grave_touched"],
    equippedItemTags: ["unholy", "abyss"],
  });

  expect(holy.horns).toBe(0);
  expect(holy.overlays).toBe(0);
  expect(worn.headOffsetY).toBe(8);
  expect(worn.armsOffsetY).toBe(4);
  expect(holy.paletteId).not.toBe(worn.paletteId);
});

test("svg rasterization is deterministic and transparent-friendly", () => {
  const state = deriveCharacterVisualState({
    seed: 99,
    alignment: "neutral" as VisualAlignment,
    vitality01: 0.5,
    visibleTraitIds: ["obsessive"],
    hiddenTraitIds: [],
    equippedItemTags: ["fate"],
  });
  const svg = buildCharacterSvg(state);
  const first = svgToPngBuffer(svg, 64);
  const second = svgToPngBuffer(svg, 64);

  expect(first.equals(second)).toBe(true);
  expect(svg.includes("viewBox=\"0 0 512 512\"")).toBe(true);
  expect(svg.includes("<path")).toBe(false);
  expect(svg.includes("var(--c0)")).toBe(false);
  expect(svg.includes("<linearGradient")).toBe(true);
  expect(svg.includes("stroke=")).toBe(true);
});

test("atlas export returns deterministic frame placement", async () => {
  const samples = ["a", "b", "c", "d", "e"].map((seed) => {
    const state = deriveCharacterVisualState({
      seed,
      alignment: "neutral" as VisualAlignment,
      vitality01: 0.6,
      visibleTraitIds: [],
      hiddenTraitIds: [],
      equippedItemTags: [],
    });

    return { key: seed, svg: buildCharacterSvg(state) };
  });

  const [page] = await exportAvatarAtlas(samples, { cols: 2, paddingPx: 2, cellSize: 512 });

  expect(page.frames.a).toStrictEqual({ x: 2, y: 2, w: 512, h: 512 });
  expect(page.frames.c).toStrictEqual({ x: 2, y: 518, w: 512, h: 512 });
  expect(page.png.length > 0).toBeTruthy();
});

test("run adapter builds avatar input from current run state", () => {
  let save = startRun(777, 1000);
  save = grantItem(save, "grave_shroud");
  save = grantItem(save, "hollow_bone");
  save = grantItem(save, "grave_dagger");

  const run = save.currentRun;
  expect(run).toBeTruthy();

  const input = buildCharacterVisualInputFromRun(run!);
  expect(input.seed).toBe(777);
  expect(input.alignment).toBe(alignmentFromScore(run!.alignment.holyUnholy));
  expect(input.equippedItemTags.every((tag) => typeof tag === "string")).toBeTruthy();
});

test("avatar generator files do not use Math.random", () => {
  const files = walk(path.join(process.cwd(), "src", "ui", "avatar"));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    expect(source.includes("Math.random"), file).toBe(false);
  }
});
