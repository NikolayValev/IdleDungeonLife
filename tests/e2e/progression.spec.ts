import { expect, test } from "@playwright/test";
import { TRAIT_REGISTRY } from "../../src/content/traits";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  getSceneTexts,
  getState,
  resetApp,
} from "./helpers";

test.describe("meta progression flow", () => {
  test("claims legacy ash, persists discoveries, and unlocks gated content", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);

    await resetApp(page);

    const startingState = await getState(page);
    const discoveredThisRun = [
      ...(startingState.run?.visibleTraits ?? []),
      ...(startingState.run?.hiddenTraits ?? []),
    ];

    await page.evaluate(() => {
      (window as any).__debug.addGold(100);
    });

    for (let index = 0; index < 3; index += 1) {
      await page.evaluate(() => {
        (window as any).__test.dispatch({
          type: "START_DUNGEON",
          dungeonId: "abandoned_chapel",
          nowUnixSec: Math.floor(Date.now() / 1000),
        });
      });
      await page.evaluate(() => {
        (window as any).__test.advanceTime(61_000);
      });
    }

    let state = await getState(page);
    expect(state.run?.totalDungeonsCompleted).toBe(3);

    await page.evaluate(() => {
      (window as any).__test.dispatch({ type: "ASSIGN_JOB", jobId: "porter" });
      (window as any).__debug.killRun();
    });
    await page.waitForTimeout(1_300);

    state = await getState(page);
    expect(state.activeScenes).toContain("DeathScene");
    expect(state.run?.alive).toBe(false);
    expect(state.run?.jobId).toBeNull();

    const deathTexts = await getSceneTexts(page, "DeathScene");
    expect(deathTexts).toContain("Legacy Ash earned: +9");
    expect(deathTexts).toContain("Depth bonus: +0");
    expect(deathTexts).toContain("Age bonus: +3");
    expect(deathTexts).toContain("Boss bonus: +0");
    expect(deathTexts).toContain("Dungeon clears: +6");
    expect(deathTexts).toContain("Total Legacy Ash after claim: 9");
    expect(deathTexts).toContain("Affordable After Claim");
    expect(deathTexts).toContain("Job: Scavenger (3 Ash)");
    expect(deathTexts).toContain("Dungeon: Grave Hollow (5 Ash)");

    await emitSceneButtonByText(page, "DeathScene", "[ Begin New Run ]");
    await page.waitForTimeout(500);

    state = await getState(page);
    expect(state.activeScenes).toContain("MainScene");
    expect(state.activeScenes).toContain("HudScene");
    expect(state.run?.alive).toBe(true);
    expect(state.run?.jobId).toBeNull();
    expect(state.meta.totalRuns).toBe(2);
    expect(state.meta.legacyAsh).toBeGreaterThanOrEqual(8);
    expect(state.meta.codexEntries.length).toBeGreaterThan(0);
    expect(state.meta.discoveredTraits).toEqual(
      expect.arrayContaining(discoveredThisRun)
    );

    await page.evaluate(() => {
      (window as any).__test.startScene("CodexScene");
    });
    await page.waitForTimeout(300);

    const codexTexts = await getSceneTexts(page, "CodexScene");
    for (const traitId of discoveredThisRun) {
      const traitName = TRAIT_REGISTRY.get(traitId)?.name;
      expect(traitName).toBeTruthy();
      expect(codexTexts).toContain(traitName!);
    }

    await page.evaluate(() => {
      (window as any).__test.startScene("JobsScene");
    });
    await page.waitForTimeout(300);

    await emitSceneButtonByText(page, "JobsScene", "[ Unlock ]", 0);
    await page.waitForTimeout(300);

    state = await getState(page);
    expect(state.meta.unlockedJobs).toContain("scavenger");
    expect(state.meta.legacyAsh).toBeGreaterThanOrEqual(5);
    expect(await getSceneTexts(page, "JobsScene")).toContain("Scavenger");
    expect(await getSceneTexts(page, "JobsScene")).toContain("[ Assign ]");

    await page.evaluate(() => {
      (window as any).__test.startScene("DungeonsScene");
    });
    await page.waitForTimeout(300);

    await emitSceneButtonByText(page, "DungeonsScene", "[ Unlock ]", 0);
    await page.waitForTimeout(300);

    state = await getState(page);
    expect(state.meta.unlockedDungeons).toContain("grave_hollow");
    expect(state.meta.legacyAsh).toBeGreaterThanOrEqual(0);
    expect(await getSceneTexts(page, "DungeonsScene")).toContain("Grave Hollow");

    expectNoBrowserErrors(errors);
  });
});
