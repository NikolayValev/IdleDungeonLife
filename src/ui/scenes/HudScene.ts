import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";

const TABS = [
  { key: "MainScene", label: "Home" },
  { key: "JobsScene", label: "Jobs" },
  { key: "DungeonsScene", label: "Dungeons" },
  { key: "InventoryScene", label: "Inventory" },
  { key: "TalentsScene", label: "Talents" },
];

/**
 * Persistent HUD overlay that shows tab bar and global resource readout.
 * Runs on top of other scenes.
 */
export class HudScene extends BaseScene {

  constructor() {
    super({ key: "HudScene" });
  }

  create(): void {
    this.drawTabBar();
    this.updateHud();

    // Auto-refresh HUD every second
    this.time.addEvent({
      delay: 1000,
      callback: this.onTick,
      callbackScope: this,
      loop: true,
    });
  }

  private onTick(): void {
    const now = this.nowUnixSec;
    this.dispatch({ type: "TICK", nowUnixSec: now });

    // Check for death
    const run = this.saveFile.currentRun;
    if (run && !run.alive && !run.currentDungeon) {
      this.dispatchDeathIfNeeded();
    }

    // Auto-complete dungeon
    if (run?.currentDungeon && now >= run.currentDungeon.completesAtUnixSec) {
      this.dispatch({ type: "COMPLETE_DUNGEON", nowUnixSec: now });
    }

    this.updateHud();
  }

  private dispatchDeathIfNeeded(): void {
    const run = this.saveFile.currentRun;
    if (run && !run.alive) {
      this.scene.start("DeathScene");
    }
  }

  private updateHud(): void {
    // Clear old HUD text (simple approach: destroy and redraw)
    this.children.list
      .filter((c) => (c as any).__hudElement)
      .forEach((c) => c.destroy());

    const run = this.saveFile.currentRun;
    if (!run) return;

    const { gold, essence } = run.resources;
    const { vitality, stage } = run.lifespan;

    const textStyle = {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.textSecondary,
    };

    const goldText = this.add.text(8, 4, `Gold: ${Math.floor(gold)}`, textStyle);
    (goldText as any).__hudElement = true;

    const essText = this.add.text(110, 4, `Essence: ${Math.floor(essence * 10) / 10}`, textStyle);
    (essText as any).__hudElement = true;

    const vitalColor =
      vitality > 60
        ? COLORS.vitalityHigh
        : vitality > 25
        ? COLORS.vitalityMid
        : COLORS.vitalityLow;

    const vitalText = this.add.text(
      240,
      4,
      `Vitality: ${Math.floor(vitality)} (${stage})`,
      { ...textStyle, color: vitalColor }
    );
    (vitalText as any).__hudElement = true;
  }

  private drawTabBar(): void {
    const barY = LAYOUT.height - LAYOUT.tabBarHeight;

    this.add.rectangle(
      LAYOUT.width / 2,
      barY + LAYOUT.tabBarHeight / 2,
      LAYOUT.width,
      LAYOUT.tabBarHeight,
      0x111111
    );

    const tabWidth = LAYOUT.width / TABS.length;
    TABS.forEach((tab, i) => {
      const x = i * tabWidth + tabWidth / 2;
      const y = barY + LAYOUT.tabBarHeight / 2;

      const btn = this.add
        .text(x, y, tab.label, {
          fontFamily: FONTS.body,
          fontSize: "13px",
          color: COLORS.textPrimary,
        })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerup", () => {
        this.scene.start(tab.key);
      });

      btn.on("pointerover", () => btn.setColor(COLORS.accent));
      btn.on("pointerout", () => btn.setColor(COLORS.textPrimary));
    });
  }
}
