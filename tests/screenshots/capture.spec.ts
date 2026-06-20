import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { getState, waitForHooks } from "../e2e/helpers";

const DIR = "artifacts/screenshots";

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(600);
  await page.locator("canvas").screenshot({ path: `${DIR}/${name}.png` });
}

test("capture canonical screenshots", async ({ page }) => {
  // 1. Intro overlay (clean fresh visit)
  await page.goto("/");
  await waitForHooks(page);
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await waitForHooks(page);
  await page.evaluate(() => {
    const g = (window as any).__game;
    ["MainScene", "JobsScene", "DungeonsScene", "InventoryScene", "TalentsScene", "CodexScene", "DeathScene", "SubCharactersScene", "AchievementsScene", "HudScene"].forEach((k) => {
      if (g.scene.isActive(k)) g.scene.stop(k);
    });
    if (!g.scene.isActive("IntroScene")) g.scene.start("IntroScene");
    g.scene.bringToTop("IntroScene");
  });
  await shot(page, "01-intro");

  // 2. Early life in MainScene with porter job
  await page.evaluate(() => {
    const w = window as any;
    w.__test.dispatch({ type: "START_NEW_RUN", nowUnixSec: Math.floor(Date.now() / 1000) });
    w.__game.scene.start("HudScene");
    w.__test.startScene("MainScene");
    w.__test.dispatch({ type: "ASSIGN_JOB", jobId: "porter" });
  });
  await shot(page, "02-early-chapel");

  // 3. Mid-game dungeon dive — sunken_archive
  await page.evaluate(() => {
    const w = window as any;
    w.__debug.unlockDungeon("sunken_archive");
    w.__test.dispatch({ type: "START_DUNGEON", dungeonId: "sunken_archive", nowUnixSec: Math.floor(Date.now() / 1000) });
    w.__test.startScene("DungeonsScene");
  });
  await shot(page, "03-mid-dungeon");

  // 4. Deep / late dungeon — bone_cathedral (depthIndex 10)
  await page.evaluate(() => {
    const w = window as any;
    w.__debug.unlockDungeon("bone_cathedral");
    w.__test.dispatch({ type: "START_DUNGEON", dungeonId: "bone_cathedral", nowUnixSec: Math.floor(Date.now() / 1000) });
    w.__test.startScene("DungeonsScene");
  });
  await shot(page, "04-deep-dungeon");

  // 5. Talents scene
  await page.evaluate(() => (window as any).__test.startScene("TalentsScene"));
  await shot(page, "05-talents");

  // 6. Codex scene
  await page.evaluate(() => (window as any).__test.startScene("CodexScene"));
  await shot(page, "06-codex");

  // 7. Sub-characters scene
  await page.evaluate(() => {
    const w = window as any;
    w.__debug.toggleSubCharacters();
    w.__test.startScene("SubCharactersScene");
  });
  await shot(page, "07-subs");

  // 8. Death + legacy screen
  await page.evaluate(() => {
    const w = window as any;
    w.__test.startScene("MainScene");
    w.__test.advanceTime(600_000);
    w.__debug.killRun();
    w.__test.startScene("DeathScene");
  });
  await shot(page, "08-death-legacy");

  await getState(page); // sanity: hooks still present
});
