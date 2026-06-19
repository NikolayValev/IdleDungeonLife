import { test, expect } from "vitest";
import { buildDemoScenario, DEMO_HOLD_MS } from "../../src/app/demo/scenario";

test("scenario beats are well-formed", () => {
  const beats = buildDemoScenario();
  expect(beats.length).toBeGreaterThanOrEqual(8);
  expect(DEMO_HOLD_MS).toBeGreaterThanOrEqual(1000);
  for (const beat of beats) {
    expect(typeof beat.caption).toBe("string");
    expect(beat.caption.length).toBeGreaterThan(0);
    expect(["dispatch", "advanceTime", "switchScene"]).toContain(beat.kind);
    if (beat.kind === "dispatch") {
      expect(typeof beat.event(1000).type).toBe("string");
    }
    if (beat.kind === "advanceTime") expect(beat.ms).toBeGreaterThan(0);
    if (beat.kind === "switchScene") expect(typeof beat.sceneKey).toBe("string");
  }
});

test("scenario starts a run and ends on the death screen", () => {
  const beats = buildDemoScenario();
  const first = beats[0];
  expect(first.kind).toBe("dispatch");
  if (first.kind === "dispatch") expect(first.event(1000).type).toBe("START_NEW_RUN");
  const last = beats[beats.length - 1];
  expect(last.kind).toBe("switchScene");
  if (last.kind === "switchScene") expect(last.sceneKey).toBe("DeathScene");
});
