// src/ui/scenes/DemoScene.ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import type { GameController } from "../../app/game";
import { DemoRunner, type DemoHost } from "../../app/demo/DemoRunner";
import { buildDemoScenario, DEMO_HOLD_MS } from "../../app/demo/scenario";

const CONTENT_SCENES = [
  "MainScene",
  "JobsScene",
  "DungeonsScene",
  "InventoryScene",
  "TalentsScene",
  "CodexScene",
  "DeathScene",
  "SubCharactersScene",
  "AchievementsScene",
];

export class DemoScene extends BaseScene {
  private cancelled = false;
  private captionText!: Phaser.GameObjects.Text;
  private index = 0;
  private runner!: DemoRunner;

  constructor() {
    super({ key: "DemoScene" });
  }

  create(): void {
    this.cancelled = false;
    this.index = 0;
    const game = this.game as GameController;
    game.enterDemo(this.nowUnixSec);

    const host: DemoHost = {
      dispatch: (event) => game.dispatch(event),
      advanceTime: (ms) => game.advanceTime(ms),
      switchScene: (key) => this.showDemoScene(key),
      setCaption: (text) => this.captionText.setText(text),
      now: () => this.nowUnixSec,
      isCancelled: () => this.cancelled,
    };
    this.runner = new DemoRunner(buildDemoScenario(), host);

    this.drawChrome();
    this.step();
  }

  private drawChrome(): void {
    this.add
      .rectangle(0, LAYOUT.height - 92, LAYOUT.width, 92, 0x000000, 0.78)
      .setOrigin(0, 0);
    this.captionText = this.add
      .text(LAYOUT.width / 2, LAYOUT.height - 76, "", {
        fontFamily: FONTS.flavor,
        fontSize: "14px",
        color: COLORS.textPrimary,
        align: "center",
        wordWrap: { width: LAYOUT.width - 48 },
      })
      .setOrigin(0.5, 0);

    const skip = this.add
      .text(LAYOUT.width / 2, LAYOUT.height - 26, "[ Skip demo ]", {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    skip.on("pointerup", () => this.endDemo());
  }

  private step(): void {
    if (!this.runner.runBeat(this.index)) {
      this.endDemo();
      return;
    }
    this.index += 1;
    this.time.delayedCall(DEMO_HOLD_MS, () => this.step());
  }

  /** Bring a content scene up underneath the demo overlay. */
  private showDemoScene(sceneKey: string): void {
    CONTENT_SCENES.filter((key) => key !== sceneKey && this.scene.isActive(key)).forEach(
      (key) => this.scene.stop(key)
    );
    const target = this.scene.get(sceneKey);
    if (target.scene.isActive()) {
      target.scene.restart();
    } else {
      this.scene.run(sceneKey);
    }
    this.scene.bringToTop("DemoScene");
  }

  private endDemo(): void {
    this.cancelled = true;
    const game = this.game as GameController;
    game.exitDemo();
    CONTENT_SCENES.filter((key) => this.scene.isActive(key)).forEach((key) =>
      this.scene.stop(key)
    );
    this.scene.start("IntroScene");
  }
}
