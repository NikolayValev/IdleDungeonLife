import { test, expect } from "vitest";
import { DemoRunner, type DemoHost } from "../../src/app/demo/DemoRunner";
import type { DemoBeat } from "../../src/app/demo/scenario";

function fakeHost() {
  const calls: Array<[string, unknown]> = [];
  const host: DemoHost & { calls: typeof calls; cancelled: boolean } = {
    calls,
    cancelled: false,
    dispatch: (e) => calls.push(["dispatch", e.type]),
    advanceTime: (ms) => calls.push(["advanceTime", ms]),
    switchScene: (k) => calls.push(["switchScene", k]),
    setCaption: (c) => calls.push(["caption", c]),
    now: () => 1000,
    isCancelled() { return host.cancelled; },
  };
  return host;
}

test("runBeat dispatches the right host call and sets caption", () => {
  const host = fakeHost();
  const beats: DemoBeat[] = [{ kind: "switchScene", sceneKey: "MainScene", caption: "hi" }];
  const runner = new DemoRunner(beats, host);
  expect(runner.runBeat(0)).toBe(true);
  expect(host.calls).toEqual([["caption", "hi"], ["switchScene", "MainScene"]]);
});

test("runBeat stops past the end and when cancelled", () => {
  const host = fakeHost();
  const beats: DemoBeat[] = [{ kind: "advanceTime", ms: 5, caption: "x" }];
  const runner = new DemoRunner(beats, host);
  expect(runner.runBeat(1)).toBe(false);
  host.cancelled = true;
  expect(runner.runBeat(0)).toBe(false);
});
