import { expect, test } from "@playwright/test";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  extractSeconds,
  getSceneTexts,
  getState,
  resetApp,
} from "./helpers";

test.describe("active run flow", () => {
  test("updates timers and supports dungeon, inventory, and talent actions", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);

    await resetApp(page);

    let state = await getState(page);
    expect(state.activeScenes).toContain("MainScene");
    expect(state.activeScenes).toContain("HudScene");
    expect(state.run?.alive).toBe(true);

    await page.evaluate(() => {
      (window as any).__test.startScene("JobsScene");
      (window as any).__test.dispatch({ type: "ASSIGN_JOB", jobId: "porter" });
    });

    state = await getState(page);
    expect(state.run?.jobId).toBe("porter");
    expect(state.activeScenes).toContain("JobsScene");

    await page.evaluate(() => {
      (window as any).__test.startScene("MainScene");
      (window as any).__test.advanceTime(60_000);
    });

    state = await getState(page);
    expect(state.run?.resources.gold ?? 0).toBeGreaterThanOrEqual(30);

    await page.evaluate(() => {
      (window as any).__test.dispatch({
        type: "START_DUNGEON",
        dungeonId: "abandoned_chapel",
        nowUnixSec: Math.floor(Date.now() / 1000),
      });
      (window as any).__test.startScene("DungeonsScene");
    });

    state = await getState(page);
    expect(state.run?.dungeon?.dungeonId).toBe("abandoned_chapel");

    const dungeonTimerBefore = extractSeconds(
      await getSceneTexts(page, "DungeonsScene"),
      "\u23f1"
    );
    await page.waitForTimeout(2_200);
    const dungeonTimerAfter = extractSeconds(
      await getSceneTexts(page, "DungeonsScene"),
      "\u23f1"
    );
    expect(dungeonTimerAfter).toBeLessThan(dungeonTimerBefore);

    await page.evaluate(() => {
      (window as any).__test.advanceTime(61_000);
      (window as any).__test.startScene("MainScene");
    });

    state = await getState(page);
    expect(state.run?.dungeon).toBeNull();
    expect(state.run?.totalDungeonsCompleted).toBe(1);
    expect(state.run?.alignment ?? 0).toBeGreaterThan(0);
    expect(state.run?.inventory.length ?? 0).toBeGreaterThan(0);

    await page.evaluate(() => {
      (window as any).__test.dispatch({
        type: "START_DUNGEON",
        dungeonId: "abandoned_chapel",
        nowUnixSec: Math.floor(Date.now() / 1000),
      });
      (window as any).__test.startScene("MainScene");
    });
    await page.waitForTimeout(300);

    const mainTimerBefore = extractSeconds(
      await getSceneTexts(page, "MainScene"),
      "Completes in:"
    );
    await page.waitForTimeout(2_200);
    const mainTimerAfter = extractSeconds(
      await getSceneTexts(page, "MainScene"),
      "Completes in:"
    );
    expect(mainTimerAfter).toBeLessThan(mainTimerBefore);

    await page.evaluate(() => {
      (window as any).__test.advanceTime(61_000);
      (window as any).__debug.addEssence(50);
      (window as any).__debug.grantItem("rusted_blade");

      const save = (window as any).__test.getSave();
      const newestItem = save.currentRun.inventory.items[save.currentRun.inventory.items.length - 1];
      if (newestItem) {
        (window as any).__test.dispatch({
          type: "EQUIP_ITEM",
          itemInstanceId: newestItem.instanceId,
        });
      }

      (window as any).__test.dispatch({
        type: "UNLOCK_TALENT",
        nodeId: "spine_0_initiate",
      });
      (window as any).__test.startScene("InventoryScene");
    });

    state = await getState(page);
    expect(state.run?.inventory).toContain("rusted_blade");
    expect(state.run?.equipment.weapon).toBeTruthy();
    expect(state.run?.talents).toContain("spine_0_initiate");
    const essenceBeforeBreak = state.run?.resources.essence ?? 0;
    const rustedBladeCountBeforeBreak =
      state.run?.inventory.filter((itemId) => itemId === "rusted_blade").length ?? 0;

    const inventoryTexts = await getSceneTexts(page, "InventoryScene");
    expect(inventoryTexts).toContain("Equipped");
    expect(inventoryTexts).toContain("weapon: Rusted Blade");
    expect(inventoryTexts).toContain("+1e");

    await emitSceneButtonByText(page, "InventoryScene", "Break");
    await page.waitForTimeout(300);

    state = await getState(page);
    const rustedBladeCountAfterBreak =
      state.run?.inventory.filter((itemId) => itemId === "rusted_blade").length ?? 0;
    expect(rustedBladeCountAfterBreak).toBe(rustedBladeCountBeforeBreak - 1);
    expect(state.run?.equipment.weapon).toBeFalsy();
    expect(state.run?.resources.essence ?? 0).toBeGreaterThanOrEqual(essenceBeforeBreak + 1);

    const postBreakTexts = await getSceneTexts(page, "InventoryScene");
    expect(postBreakTexts).toContain("weapon: [empty weapon]");

    await page.evaluate(() => {
      (window as any).__test.startScene("TalentsScene");
    });

    const talentTexts = await getSceneTexts(page, "TalentsScene");
    expect(talentTexts).toContain("Initiate's Resolve");
    expect(talentTexts).toContain("\u2713");

    expectNoBrowserErrors(errors);
  });
});
