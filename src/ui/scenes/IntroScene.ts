// src/ui/scenes/IntroScene.ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";

const P = LAYOUT.padding;

export class IntroScene extends BaseScene {
  constructor() {
    super({ key: "IntroScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    let y = LAYOUT.height * 0.22;

    this.add
      .text(LAYOUT.width / 2, y, "Idle Dungeon Life", {
        fontFamily: FONTS.heading,
        fontSize: "28px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0);
    y += 44;

    this.add
      .text(LAYOUT.width / 2, y, "Every character lives once.", {
        fontFamily: FONTS.flavor,
        fontSize: "16px",
        color: COLORS.accentHoly,
        fontStyle: "italic",
      })
      .setOrigin(0.5, 0);
    y += 48;

    this.add
      .text(
        LAYOUT.width / 2,
        y,
        "An idle RPG. Send an adventurer into ancient dungeons; they age in real time, gather traits, and push deeper until their lifespan runs out. Death is progress — legacy ash funds the next life.",
        {
          fontFamily: FONTS.body,
          fontSize: "13px",
          color: COLORS.textSecondary,
          align: "center",
          wordWrap: { width: LAYOUT.width - P * 4 },
        }
      )
      .setOrigin(0.5, 0);
    y += 130;

    this.makeButton(y, "[ Play ]", COLORS.accent, () => this.startPlaying());
    y += 44;
    this.makeButton(y, "[ Watch demo ]", COLORS.textSecondary, () => {
      this.scene.start("DemoScene");
    });
  }

  private makeButton(y: number, label: string, color: string, onClick: () => void): void {
    const btn = this.add
      .text(LAYOUT.width / 2, y, label, {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setColor(COLORS.vitalityHigh));
    btn.on("pointerout", () => btn.setColor(color));
    btn.on("pointerup", onClick);
  }

  private startPlaying(): void {
    if (!this.saveFile.currentRun) {
      this.dispatch({ type: "START_NEW_RUN", nowUnixSec: this.nowUnixSec });
    }
    if (!this.scene.isActive("HudScene")) this.scene.run("HudScene");
    this.scene.run("MainScene");
    this.scene.bringToTop("HudScene");
    this.scene.stop("IntroScene");
  }
}
