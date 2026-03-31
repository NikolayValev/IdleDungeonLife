import { expect, type Page } from "@playwright/test";

export type AppState = {
  activeScenes: string[];
  meta: {
    legacyAsh: number;
    unlockedDungeons: string[];
    unlockedJobs: string[];
    discoveredItems: string[];
    discoveredTraits: string[];
    codexEntries: string[];
    totalRuns: number;
  };
  run: null | {
    alive: boolean;
    stage: string;
    ageSeconds: number;
    vitality: number;
    alignment: number;
    visibleTraits: string[];
    hiddenTraits: string[];
    jobId: string | null;
    dungeon: null | {
      dungeonId: string;
      startedAtUnixSec: number;
      completesAtUnixSec: number;
    };
    resources: {
      gold: number;
      essence: number;
    };
    inventory: string[];
    equipment: {
      weapon?: string;
      armor?: string;
      artifact?: string;
    };
    talents: string[];
    deepestDungeonIndex: number;
    totalDungeonsCompleted: number;
    bossesCleared: string[];
  };
};

export type BrowserErrorCapture = {
  consoleErrors: string[];
  pageErrors: string[];
};

export function captureBrowserErrors(page: Page): BrowserErrorCapture {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

export function expectNoBrowserErrors(capture: BrowserErrorCapture): void {
  expect(capture.consoleErrors).toEqual([]);
  expect(capture.pageErrors).toEqual([]);
}

export async function waitForHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const currentWindow = window as typeof window & {
      __test?: unknown;
      __debug?: unknown;
      render_game_to_text?: unknown;
    };

    return (
      typeof currentWindow.render_game_to_text === "function" &&
      !!currentWindow.__test &&
      !!currentWindow.__debug
    );
  });
}

export async function resetApp(page: Page): Promise<void> {
  await page.goto("/");
  await waitForHooks(page);
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await waitForHooks(page);
}

export async function getState(page: Page): Promise<AppState> {
  return page.evaluate(() => JSON.parse((window as any).render_game_to_text()) as AppState);
}

export async function getSceneTexts(page: Page, sceneKey: string): Promise<string[]> {
  return page.evaluate((targetSceneKey) => {
    const scene = (window as any).__game?.scene?.getScene(targetSceneKey);
    if (!scene || !scene.scene.isActive()) return [];

    return scene.children.list
      .filter((child: { text?: unknown }) => typeof child.text === "string")
      .map((child: { text: string }) => child.text);
  }, sceneKey);
}

export function extractSeconds(texts: string[], prefix: string): number {
  const line = texts.find((entry) => entry.startsWith(prefix));
  if (!line) {
    throw new Error(`Could not find timer line with prefix "${prefix}"`);
  }

  const match = line.match(/(\d+)s/);
  if (!match) {
    throw new Error(`Could not parse seconds from "${line}"`);
  }

  return Number(match[1]);
}

export async function emitSceneButtonByText(
  page: Page,
  sceneKey: string,
  label: string,
  occurrence = 0
): Promise<void> {
  await page.evaluate(
    ({ targetSceneKey, targetLabel, targetOccurrence }) => {
      const scene = (window as any).__game?.scene?.getScene(targetSceneKey);
      if (!scene || !scene.scene.isActive()) {
        throw new Error(`Scene ${targetSceneKey} is not active`);
      }

      const matches = scene.children.list.filter(
        (child: { text?: string; emit?: (eventName: string) => void }) =>
          child.text === targetLabel && typeof child.emit === "function"
      );

      const button = matches[targetOccurrence];
      if (!button?.emit) {
        throw new Error(
          `Button "${targetLabel}" occurrence ${targetOccurrence} not found in ${targetSceneKey}`
        );
      }

      button.emit("pointerup");
    },
    {
      targetSceneKey: sceneKey,
      targetLabel: label,
      targetOccurrence: occurrence,
    }
  );
}
