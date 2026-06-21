import { expect, test } from "@playwright/test";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  getSceneTexts,
  resetApp,
} from "./helpers";

test.describe("sub-character runs", () => {
  test("start a sub run, watch it fall, then claim ash", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await resetApp(page);

    // Unlock subs and create one.
    await page.evaluate(() => {
      const t = (window as any).__test;
      t.dispatch({ type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
      t.dispatch({ type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: Math.floor(Date.now() / 1000) });
      t.startScene("SubCharactersScene");
    });

    let texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.includes("Idle - not running"))).toBe(true);

    // Start the run.
    await emitSceneButtonByText(page, "SubCharactersScene", "[ Start Run ]");
    await page.waitForTimeout(150);
    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.startsWith("Status: Running"))).toBe(true);

    // Age the sub until it falls. Pure aging kills by 1800s (100 vitality over
    // 30 min); even worst-case stacked decay-reduction traits die by ~3400s, so a
    // 50 × 2-min = 6000s budget keeps comfortable headroom against trait variance.
    const fell = await page.evaluate(() => {
      const t = (window as any).__test;
      for (let i = 0; i < 50; i++) {
        t.advanceTime(120_000); // +2 min
        const sub = t.getSave().subCharacters[0];
        if (sub.currentRun && !sub.currentRun.alive) return true;
      }
      return false;
    });
    expect(fell).toBe(true);

    await page.evaluate(() => (window as any).__test.startScene("SubCharactersScene"));
    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.startsWith("Status: Fallen"))).toBe(true);

    const ashBefore = await page.evaluate(
      () => (window as any).__test.getSave().subCharacters[0].meta.legacyAsh
    );

    // Claim the fallen run.
    const claimLabel = texts.find((s) => s.startsWith("[ Claim "))!;
    await emitSceneButtonByText(page, "SubCharactersScene", claimLabel);
    await page.waitForTimeout(150);

    const sub = await page.evaluate(() => (window as any).__test.getSave().subCharacters[0]);
    expect(sub.meta.legacyAsh).toBeGreaterThan(ashBefore);
    expect(sub.stats.totalRunsCompleted).toBeGreaterThanOrEqual(1);
    expect(sub.currentRun).toBeNull(); // back to Idle

    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.includes("Idle - not running"))).toBe(true);

    expectNoBrowserErrors(errors);
  });
});
