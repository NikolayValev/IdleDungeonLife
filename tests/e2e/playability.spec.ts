import { expect, test, type Page } from "@playwright/test";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  getSceneTexts,
  getState,
  resetApp,
} from "./helpers";

const TAB_SCENES = [
  "MainScene",
  "JobsScene",
  "DungeonsScene",
  "InventoryScene",
  "TalentsScene",
  "CodexScene",
  "SubCharactersScene",
  "AchievementsScene",
];

async function startScene(page: Page, key: string): Promise<void> {
  await page.evaluate((sceneKey) => (window as any).__test.startScene(sceneKey), key);
  await page.waitForTimeout(150);
}

async function getSave(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__test.getSave());
}

test.describe("playability", () => {
  test("every tab activates and renders content without browser errors", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await resetApp(page);

    for (const sceneKey of TAB_SCENES) {
      await startScene(page, sceneKey);

      const state = await getState(page);
      expect(state.activeScenes, `${sceneKey} should be active`).toContain(sceneKey);
      expect(state.activeScenes, "HUD overlay should persist").toContain("HudScene");

      const texts = await getSceneTexts(page, sceneKey);
      expect(texts.length, `${sceneKey} should render at least one text element`).toBeGreaterThan(
        0
      );
    }

    expectNoBrowserErrors(errors);
  });

  test("sub-characters stay locked until the gate, then become playable", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await resetApp(page);

    // Locked by default on a fresh save.
    expect((await getSave(page)).subCharactersUnlocked).toBe(false);

    await startScene(page, "SubCharactersScene");
    let texts = await getSceneTexts(page, "SubCharactersScene");
    expect(
      texts.some((t) => t.includes("Locked")),
      "should show a locked notice"
    ).toBe(true);
    expect(
      texts.some((t) => t.includes("Create Sub")),
      "create button must be hidden while locked"
    ).toBe(false);

    // Unlock via the debug toggle (the player-facing path is clearing the final dungeon).
    await page.evaluate(() => (window as any).__debug.toggleSubCharacters());
    expect((await getSave(page)).subCharactersUnlocked).toBe(true);

    await startScene(page, "SubCharactersScene");
    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(
      texts.some((t) => t.includes("Create Sub")),
      "create button should appear"
    ).toBe(true);

    // Recruit a sub-character and confirm it persists.
    await emitSceneButtonByText(page, "SubCharactersScene", "[ Create Sub ]");
    await page.waitForTimeout(200);
    const save = await getSave(page);
    expect(save.subCharacters.length).toBe(1);
    expect(save.subCharacters[0].name).toBe("Character 1");

    // Toggle that sub's automation on.
    await startScene(page, "SubCharactersScene");
    await emitSceneButtonByText(page, "SubCharactersScene", "[AUTO OFF]");
    await page.waitForTimeout(200);
    expect((await getSave(page)).subCharacters[0].automationConfig.enabled).toBe(true);

    expectNoBrowserErrors(errors);
  });

  test("debug toggle flips the sub-character gate both ways", async ({ page }) => {
    await resetApp(page);

    await page.evaluate(() => (window as any).__debug.toggleSubCharacters());
    expect((await getSave(page)).subCharactersUnlocked).toBe(true);

    await page.evaluate(() => (window as any).__debug.toggleSubCharacters());
    expect((await getSave(page)).subCharactersUnlocked).toBe(false);
  });

  test("a freshly unlocked sub can be created and start its own run", async ({ page }) => {
    await resetApp(page);

    const result = await page.evaluate(() => {
      const t = (window as any).__test;
      t.dispatch({ type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
      t.dispatch({ type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: 1000 });
      const subId = t.getSave().subCharacters[0].id;
      t.dispatch({ type: "START_SUBCHARACTER_RUN", subCharId: subId, nowUnixSec: 1000 });
      const startedRun = !!t.getSave().subCharacters[0].currentRun;
      return { subId, startedRun };
    });

    expect(result.startedRun, "sub-character run should start").toBe(true);
    const save = await getSave(page);
    expect(save.subCharacters[0].id).toBe(result.subId);
  });
});
