import { expect, test } from "@playwright/test";
import { ITEM_REGISTRY } from "../../src/content/items";
import { TRAIT_REGISTRY } from "../../src/content/traits";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  getSceneTexts,
  getState,
  resetApp,
} from "./helpers";

test.describe("codex scene", () => {
  test("shows known discoveries during the run and supports paged item browsing", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);

    await resetApp(page);

    const initialState = await getState(page);
    const visibleTraitId = initialState.run?.visibleTraits[0];
    expect(visibleTraitId).toBeTruthy();

    await page.evaluate(() => {
      (window as any).__test.startScene("CodexScene");
    });
    await page.waitForTimeout(300);

    const visibleTraitName = TRAIT_REGISTRY.get(visibleTraitId!)?.name;
    expect(visibleTraitName).toBeTruthy();
    expect(await getSceneTexts(page, "CodexScene")).toContain(visibleTraitName!);

    const grantedItemIds = ["rusted_blade", "archivist_wrap", "iron_talisman", "pauper_beads"];
    await page.evaluate((itemIds) => {
      for (const itemId of itemIds) {
        (window as any).__debug.grantItem(itemId);
      }
      (window as any).__test.startScene("CodexScene");
    }, grantedItemIds);
    await page.waitForTimeout(300);

    await emitSceneButtonByText(page, "CodexScene", "[ Items ]");
    await page.waitForTimeout(300);

    const sortedItemNames = grantedItemIds
      .map((itemId) => ITEM_REGISTRY.get(itemId)?.name)
      .filter((name): name is string => !!name)
      .sort((left, right) => left.localeCompare(right));

    const pageOneTexts = await getSceneTexts(page, "CodexScene");
    expect(pageOneTexts).toContain("Page 1/2");
    expect(pageOneTexts).toEqual(expect.arrayContaining(sortedItemNames.slice(0, 3)));
    expect(pageOneTexts).not.toContain(sortedItemNames[3]);

    await emitSceneButtonByText(page, "CodexScene", "[ Next ]");
    await page.waitForTimeout(300);

    const pageTwoTexts = await getSceneTexts(page, "CodexScene");
    expect(pageTwoTexts).toContain("Page 2/2");
    expect(pageTwoTexts).toContain(sortedItemNames[3]);

    expectNoBrowserErrors(errors);
  });

  test("shows undiscovered placeholders and reveal hints", async ({ page }) => {
    const errors = captureBrowserErrors(page);

    await resetApp(page);

    const initialState = await getState(page);
    const hiddenTraitId = initialState.run?.hiddenTraits[0];
    expect(hiddenTraitId).toBeTruthy();

    await page.evaluate(() => {
      (window as any).__test.startScene("CodexScene");
    });
    await page.waitForTimeout(300);

    await emitSceneButtonByText(page, "CodexScene", "[ Unknown ]");
    await page.waitForTimeout(300);

    const unknownTraitTexts = await getSceneTexts(page, "CodexScene");
    expect(unknownTraitTexts).toContain("Unknown Trait");
    expect(
      unknownTraitTexts.some(
        (entry) =>
          entry.startsWith("Reveal omen:") ||
          entry === "Survive a run to archive what remains obscured."
      )
    ).toBeTruthy();

    const hiddenTraitName = TRAIT_REGISTRY.get(hiddenTraitId!)?.name;
    expect(hiddenTraitName).toBeTruthy();
    expect(unknownTraitTexts).not.toContain(hiddenTraitName!);

    await emitSceneButtonByText(page, "CodexScene", "[ Items ]");
    await page.waitForTimeout(300);
    await emitSceneButtonByText(page, "CodexScene", "[Legendary]");
    await page.waitForTimeout(300);

    const unknownItemTexts = await getSceneTexts(page, "CodexScene");
    expect(unknownItemTexts.some((entry) => entry.startsWith("Unknown "))).toBeTruthy();
    expect(
      unknownItemTexts.some((entry) => entry.includes("Legendary items favor difficult delves"))
    ).toBeTruthy();

    expectNoBrowserErrors(errors);
  });
});
