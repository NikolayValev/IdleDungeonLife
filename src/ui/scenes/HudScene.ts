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

const TOAST_KIND_COLOR: Record<string, string> = {
  boss: COLORS.vitalityLow,
  legendary: "#ffaa44",
  trait_evolved: "#ffdd88",
  milestone: "#aaddff",
  death_warning: "#ff4444",
};

function colorNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

/**
 * Persistent HUD overlay that shows tab bar and global resource readout.
 * Runs on top of other scenes.
 */
export class HudScene extends BaseScene {
  private lastSeenLogLength = 0;
  private toastContainer: Phaser.GameObjects.Container | null = null;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private welcomeBackShown = false;

  constructor() {
    super({ key: "HudScene" });
  }

  create(): void {
    this.drawTabBar();
    this.updateHud();

    // Show welcome back toast once at startup if offline period was significant
    if (this.saveFile.showWelcomeBack && !this.welcomeBackShown) {
      this.showToast("Welcome back, wanderer.", COLORS.accentHoly);
      this.welcomeBackShown = true;
    }

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

    // Toast for high-priority run log events
    const newLog = this.saveFile.currentRun?.runLog ?? [];
    const newEntries = newLog.slice(this.lastSeenLogLength);
    this.lastSeenLogLength = newLog.length;
    for (const entry of newEntries) {
      if (entry.kind in TOAST_KIND_COLOR) {
        this.showToast(entry.message, TOAST_KIND_COLOR[entry.kind]);
        break;
      }
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

  // Only these scenes render time-dependent counters and need a per-tick redraw.
  private static readonly TICK_REFRESH_SCENES = new Set(["MainScene", "DungeonsScene"]);

  private refreshActiveContentScenes(): void {
    const run = this.saveFile.currentRun;
    if (!run?.alive) return;

    this.scene.manager.scenes
      .filter((scene) => {
        const key = scene.scene.key;
        return (
          scene.scene.isActive() &&
          HudScene.TICK_REFRESH_SCENES.has(key)
        );
      })
      .forEach((scene) => scene.scene.restart());
  }

  private showToast(message: string, color: string): void {
    if (this.toastContainer) {
      this.toastContainer.destroy();
      this.toastContainer = null;
    }
    if (this.toastTimer) {
      this.toastTimer.remove();
      this.toastTimer = null;
    }

    const toastY = LAYOUT.hudHeight + 2;
    const toastW = LAYOUT.width - 16;
    const toastH = 22;
    const bg = this.add
      .rectangle(LAYOUT.width / 2, toastY + toastH / 2, toastW, toastH, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, colorNumber(color), 0.8);
    const text = this.add
      .text(LAYOUT.width / 2, toastY + toastH / 2, message, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color,
        align: "center",
      })
      .setOrigin(0.5, 0.5);
    this.toastContainer = this.add.container(0, 0, [bg, text]);

    this.toastTimer = this.time.delayedCall(3000, () => {
      this.toastContainer?.destroy();
      this.toastContainer = null;
      this.toastTimer = null;
    });
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
