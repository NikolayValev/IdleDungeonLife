import Phaser from "phaser";
import { GameController } from "./game";
import { HudScene } from "../ui/scenes/HudScene";
import { MainScene } from "../ui/scenes/MainScene";
import { JobsScene } from "../ui/scenes/JobsScene";
import { DungeonsScene } from "../ui/scenes/DungeonsScene";
import { InventoryScene } from "../ui/scenes/InventoryScene";
import { TalentsScene } from "../ui/scenes/TalentsScene";
import { DeathScene } from "../ui/scenes/DeathScene";
import { LAYOUT } from "../ui/theme";
import { createDebugActions, registerDebugKeys } from "./debug";
import { saveToDisk } from "../core/save";

const IS_DEV = import.meta.env.DEV;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LAYOUT.width,
  height: LAYOUT.height,
  backgroundColor: "#0d0d0d",
  parent: "game-container",
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
    DeathScene,
    HudScene,
  ],
};

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
      () => {
        // Restart active scene
        const activeScenes = game.scene.scenes.filter(
          (s) => s.scene.isActive() && s.scene.key !== "HudScene"
        );
        activeScenes.forEach((s) => s.scene.restart());
      }
    );
    registerDebugKeys(debugActions);

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
