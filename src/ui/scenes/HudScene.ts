import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";

const TABS = [
  { key: "MainScene", label: "Home" },
  { key: "JobsScene", label: "Jobs" },
  { key: "DungeonsScene", label: "Dungeons" },
  { key: "InventoryScene", label: "Inventory" },
  { key: "TalentsScene", label: "Talents" },
  { key: "CodexScene", label: "Codex" },
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

    let run = this.saveFile.currentRun;
    // Auto-complete dungeon
    if (run?.currentDungeon && now >= run.currentDungeon.completesAtUnixSec) {
      this.dispatch({ type: "COMPLETE_DUNGEON", nowUnixSec: now });
      run = this.saveFile.currentRun;
    }

    // Check for death after all state transitions for this tick.
    if (run && !run.alive && !run.currentDungeon) {
      this.dispatchDeathIfNeeded();
    }

    this.updateHud();
    this.refreshActiveContentScenes();
  }

  private dispatchDeathIfNeeded(): void {
    if (!this.scene.isActive("DeathScene")) {
      this.showTab("DeathScene");
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

  private refreshActiveContentScenes(): void {
    const run = this.saveFile.currentRun;
    if (!run?.alive) return;

    this.scene.manager.scenes
      .filter((scene) => {
        const key = scene.scene.key;
        return scene.scene.isActive() && key !== "HudScene" && key !== "DeathScene";
      })
      .forEach((scene) => scene.scene.restart());
  }

  private drawTabBar(): void {
    const barY = LAYOUT.height - LAYOUT.tabBarHeight;
    const columns = 3;
    const rows = Math.ceil(TABS.length / columns);
    const gutter = 8;
    const horizontalPadding = 10;
    const verticalPadding = 10;
    const tabWidth =
      (LAYOUT.width - horizontalPadding * 2 - gutter * (columns - 1)) / columns;
    const tabHeight =
      (LAYOUT.tabBarHeight - verticalPadding * 2 - gutter * (rows - 1)) / rows;

    this.add.rectangle(
      LAYOUT.width / 2,
      barY + LAYOUT.tabBarHeight / 2,
      LAYOUT.width,
      LAYOUT.tabBarHeight,
      0x111111
    );

    TABS.forEach((tab, i) => {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const x =
        horizontalPadding + column * (tabWidth + gutter) + tabWidth / 2;
      const y =
        barY + verticalPadding + row * (tabHeight + gutter) + tabHeight / 2;
      const bg = this.add
        .rectangle(x, y, tabWidth, tabHeight, 0x171722, 0.95)
        .setStrokeStyle(1, 0x2b2b3f, 1)
        .setInteractive({ useHandCursor: true });

      const btn = this.add
        .text(x, y, tab.label, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.textPrimary,
          align: "center",
        })
        .setOrigin(0.5, 0.5);

      const activate = () => {
        this.showTab(tab.key);
      };

      const hoverIn = () => {
        bg.setFillStyle(0x212136, 1);
        btn.setColor(COLORS.accent);
      };
      const hoverOut = () => {
        bg.setFillStyle(0x171722, 0.95);
        btn.setColor(COLORS.textPrimary);
      };

      bg.on("pointerup", activate);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", activate);
      bg.on("pointerover", hoverIn);
      btn.on("pointerover", hoverIn);
      bg.on("pointerout", hoverOut);
      btn.on("pointerout", hoverOut);
    });
  }
}
