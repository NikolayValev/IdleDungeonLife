import { expect, test } from "@playwright/test";
import { captureBrowserErrors, expectNoBrowserErrors, getState, resetApp } from "./helpers";

type LogItemGeom = { text: string; top: number; bottom: number };

test.describe("Recent Events rendering", () => {
  test("multi-line log entries never overlap each other or the resource chips", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await resetApp(page);

    // Drive several dungeon completions to fill the run log with flavor lines,
    // most of which wrap to two rendered lines.
    await page.evaluate(() => {
      const test = (window as any).__test;
      for (let i = 0; i < 4; i++) {
        (window as any).__debug.addGold(200);
        test.dispatch({
          type: "START_DUNGEON",
          dungeonId: "abandoned_chapel",
          nowUnixSec: Math.floor(Date.now() / 1000),
        });
        test.advanceTime(61_000);
      }
      test.startScene("MainScene");
    });

    const state = await getState(page);
    expect(state.run?.alive, "run should survive the test dungeon runs").toBe(true);

    const geom = await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene("MainScene");
      const save = (window as any).__test.getSave();
      const logMessages: string[] = (save.currentRun.runLog ?? []).map(
        (e: { message: string }) => e.message
      );
      const logSet = new Set(logMessages);

      const bounds = (child: any) => {
        const b = child.getBounds();
        return { top: b.y, bottom: b.y + b.height };
      };

      const items: Array<{ text: string; top: number; bottom: number }> = scene.children.list
        .filter((c: any) => typeof c.text === "string" && typeof c.getBounds === "function")
        .map((c: any) => ({ text: c.text as string, ...bounds(c) }));

      const logItems = items
        .filter((i) => logSet.has(i.text))
        .sort((a, b) => a.top - b.top);

      const chipTops = ["Gold", "Essence", "Legacy Ash"]
        .map((label) => items.find((i) => i.text === label)?.top)
        .filter((v): v is number => typeof v === "number");

      return {
        totalLogEntries: logMessages.length,
        logItems,
        chipTop: chipTops.length ? Math.min(...chipTops) : null,
      };
    });

    expect(geom.totalLogEntries, "run log should have entries").toBeGreaterThan(0);
    expect(geom.logItems.length, "Recent Events should render entries").toBeGreaterThan(1);

    // No two consecutive entries may overlap vertically.
    const logItems = geom.logItems as LogItemGeom[];
    for (let i = 0; i < logItems.length - 1; i++) {
      expect(
        logItems[i].bottom,
        `entry "${logItems[i].text}" overlaps "${logItems[i + 1].text}"`
      ).toBeLessThanOrEqual(logItems[i + 1].top + 0.5);
    }

    // The log must sit entirely above the resource chips.
    if (geom.chipTop !== null) {
      const lowest = logItems[logItems.length - 1];
      expect(
        lowest.bottom,
        "Recent Events spills into the resource chips"
      ).toBeLessThanOrEqual(geom.chipTop);
    }

    expectNoBrowserErrors(errors);
  });
});
