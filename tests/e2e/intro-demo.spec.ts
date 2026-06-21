import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { captureBrowserErrors, emitSceneButtonByText, expectNoBrowserErrors, getSceneTexts, getState, waitForHooks } from "./helpers";

async function freshVisit(page: Page): Promise<void> {
  await page.goto("/");
  await waitForHooks(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHooks(page);
}

test.describe("intro + demo", () => {
  test("fresh visitor sees the intro overlay", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await freshVisit(page);
    const state = await getState(page);
    expect(state.activeScenes).toContain("IntroScene");
    const texts = await getSceneTexts(page, "IntroScene");
    expect(texts.join(" ")).toContain("Every character lives once.");
    expectNoBrowserErrors(errors);
  });

  test("watch demo runs sandboxed and skip restores without persisting", async ({ page }) => {
    await freshVisit(page);

    const before = await page.evaluate(() => localStorage.getItem("idledungeonlife_save"));

    await emitSceneButtonByText(page, "IntroScene", "[ Watch demo ]");
    await page.waitForTimeout(800);

    let state = await getState(page);
    expect(state.activeScenes).toContain("DemoScene");
    const during = await page.evaluate(() => localStorage.getItem("idledungeonlife_save"));
    expect(during).toBe(before);

    await emitSceneButtonByText(page, "DemoScene", "[ Skip demo ]");
    await page.waitForTimeout(500);

    state = await getState(page);
    expect(state.activeScenes).toContain("IntroScene");
    expect(state.activeScenes).not.toContain("DemoScene");
  });

  test("play button starts a real run", async ({ page }) => {
    await freshVisit(page);
    await emitSceneButtonByText(page, "IntroScene", "[ Play ]");
    await page.waitForTimeout(500);
    const state = await getState(page);
    expect(state.activeScenes).toContain("MainScene");
    expect(state.activeScenes).toContain("HudScene");
    expect(state.run?.alive).toBe(true);
  });
});
