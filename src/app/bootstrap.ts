import Phaser from "phaser";
import { GameController } from "./game";
import { HudScene } from "../ui/scenes/HudScene";
import { MainScene } from "../ui/scenes/MainScene";
import { JobsScene } from "../ui/scenes/JobsScene";
import { DungeonsScene } from "../ui/scenes/DungeonsScene";
import { InventoryScene } from "../ui/scenes/InventoryScene";
import { TalentsScene } from "../ui/scenes/TalentsScene";
import { DeathScene } from "../ui/scenes/DeathScene";
import { CodexScene } from "../ui/scenes/CodexScene";
import { LAYOUT } from "../ui/theme";
import { createDebugActions, registerDebugKeys } from "./debug";
import { saveToDisk } from "../core/save";
import type { SaveFile } from "../core/types";

const IS_DEV = import.meta.env.DEV;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LAYOUT.width,
  height: LAYOUT.height,
  autoRound: true,
  backgroundColor: "#0d0d0d",
  parent: "game-container",
  render: {
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    MainScene,
    JobsScene,
    DungeonsScene,
    InventoryScene,
    TalentsScene,
    CodexScene,
    DeathScene,
    HudScene,
  ],
};

function restartActiveScenes(game: GameController): void {
  const activeScenes = game.scene.scenes.filter(
    (scene) => scene.scene.isActive() && scene.scene.key !== "HudScene"
  );
  activeScenes.forEach((scene) => scene.scene.restart());
}

function switchContentScene(game: GameController, sceneKey: string): void {
  const activeSceneKeys = game.scene.scenes
    .filter((scene) => {
      const key = scene.scene.key;
      return scene.scene.isActive() && key !== "HudScene" && key !== sceneKey;
    })
    .map((scene) => scene.scene.key);

  const targetScene = game.scene.getScene(sceneKey);
  if (targetScene.scene.isActive()) {
    targetScene.scene.restart();
  } else {
    game.scene.run(sceneKey);
  }

  activeSceneKeys.forEach((key) => game.scene.stop(key));
  game.scene.bringToTop(sceneKey);
  if (game.scene.isActive("HudScene")) {
    game.scene.bringToTop("HudScene");
  }
}

function buildRenderPayload(game: GameController): Record<string, unknown> {
  const save = game.saveFile;
  const run = save.currentRun;
  const activeSceneKeys = game.scene.scenes
    .filter((scene) => scene.scene.isActive())
    .map((scene) => scene.scene.key);

  return {
    activeScenes: activeSceneKeys,
    meta: {
      legacyAsh: save.meta.legacyAsh,
      unlockedDungeons: save.meta.unlockedDungeonIds,
      unlockedJobs: save.meta.unlockedJobIds,
      discoveredItems: save.meta.discoveredItemIds,
      discoveredTraits: save.meta.discoveredTraitIds,
      codexEntries: save.meta.codexEntries,
      totalRuns: save.meta.totalRuns,
    },
    run: run
      ? {
          alive: run.alive,
          stage: run.lifespan.stage,
          ageSeconds: Math.floor(run.lifespan.ageSeconds),
          vitality: Math.round(run.lifespan.vitality * 100) / 100,
          alignment: Math.round(run.alignment.holyUnholy),
          visibleTraits: run.visibleTraitIds,
          hiddenTraits: run.hiddenTraitIds,
          jobId: run.currentJobId,
          dungeon: run.currentDungeon,
          resources: {
            gold: Math.round(run.resources.gold * 100) / 100,
            essence: Math.round(run.resources.essence * 100) / 100,
          },
          inventory: run.inventory.items.map((item) => item.itemId),
          equipment: run.equipment,
          talents: run.talents.unlockedNodeIds,
          deepestDungeonIndex: run.deepestDungeonIndex,
          totalDungeonsCompleted: run.totalDungeonsCompleted,
          bossesCleared: run.bossesCleared,
        }
      : null,
  };
}

function installDevHooks(
  game: GameController,
  setSave: (save: SaveFile) => void
): void {
  const nowUnixSec = () => Math.floor(Date.now() / 1000);
  const devWindow = window as typeof window & {
    __game?: GameController;
    __test?: {
      getSave: () => SaveFile;
      restartActiveScenes: () => void;
      renderState: () => string;
      startScene: (sceneKey: string) => void;
      dispatch: (event: unknown) => void;
      resetRun: () => void;
      advanceTime: (ms: number) => SaveFile;
    };
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
  };

  devWindow.__game = game;
  devWindow.__test = {
    getSave: () => game.saveFile,
    restartActiveScenes: () => restartActiveScenes(game),
    renderState: () => JSON.stringify(buildRenderPayload(game)),
    startScene: (sceneKey) => switchContentScene(game, sceneKey),
    dispatch: (event) => {
      game.dispatch(event as any);
      restartActiveScenes(game);
    },
    resetRun: () => {
      setSave({ ...game.saveFile, currentRun: null });
      game.dispatch({ type: "START_NEW_RUN", nowUnixSec: nowUnixSec() });
      restartActiveScenes(game);
    },
    advanceTime: (ms) => {
      const seconds = Math.max(1, Math.round(ms / 1000));
      const debug = (window as any).__debug;
      if (debug?.simulateSeconds) {
        debug.simulateSeconds(seconds);
      } else {
        game.dispatch({
          type: "RECONCILE_OFFLINE",
          nowUnixSec: nowUnixSec() + seconds,
        });
        restartActiveScenes(game);
      }
      return game.saveFile;
    },
  };
  devWindow.render_game_to_text = () => devWindow.__test!.renderState();
  devWindow.advanceTime = (ms) =>
    JSON.stringify(devWindow.__test!.advanceTime(ms));
}

export function bootstrap(): GameController {
  // Create GameController (extends Phaser.Game)
  const game = new GameController(config);

  const nowUnixSec = () => Math.floor(Date.now() / 1000);

  // First-launch: start initial run if no current run
  if (!game.saveFile.currentRun) {
    game.dispatch({ type: "START_NEW_RUN", nowUnixSec: nowUnixSec() });
  }

  // Start HUD overlay after main scene is ready
  game.events.on(Phaser.Core.Events.READY, () => {
    game.scene.start("HudScene");
    game.scene.start("MainScene");
    game.scene.bringToTop("HudScene");
  });

  // Debug tools (dev only)
  if (IS_DEV) {
    const debugActions = createDebugActions(
      () => game.saveFile,
      (save) => {
        game.saveFile = save;
        saveToDisk(save);
      },
      () => restartActiveScenes(game)
    );
    registerDebugKeys(debugActions);
    installDevHooks(game, (save) => {
      game.saveFile = save;
      saveToDisk(save);
    });

    // Expose batch sim on window for console access
    (window as any).__batchSim = async (runs = 10) => {
      const { runBatch } = await import("../sim/batch");
      const result = runBatch({ runs, silent: false });
      console.table(result.results.map((r) => ({
        run: r.runIndex,
        score: r.score.total,
        age: Math.round(r.ageSeconds),
        depth: r.deepestDungeonIndex,
        ash: r.legacyAshEarned,
      })));
      console.log("Averages:", {
        avgScore: Math.round(result.avgScore),
        avgAgeSec: Math.round(result.avgAgeSeconds),
        avgDepth: result.avgDepth.toFixed(1),
        avgAsh: result.avgLegacyAsh.toFixed(1),
      });
    };
  }

  return game;
}
