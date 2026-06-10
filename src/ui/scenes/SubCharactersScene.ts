import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEON_REGISTRY, FINAL_DUNGEON } from "../../content/dungeons";
import { computeLegacyAshBreakdown } from "../../core/scoring";
import type { SubCharacter } from "../../core/types";

function formatAge(ageSeconds: number): string {
  const m = Math.floor(ageSeconds / 60);
  const s = Math.floor(ageSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const P = LAYOUT.padding;
const CONTENT_TOP = LAYOUT.hudHeight + 8;
const CONTENT_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 8;

export class SubCharactersScene extends BaseScene {
  constructor() {
    super({ key: "SubCharactersScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, CONTENT_TOP, "SUB-CHARACTERS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    if (!this.saveFile.subCharactersUnlocked) {
      this.drawLocked();
      return;
    }

    const subs = this.saveFile.subCharacters;
    let y = CONTENT_TOP + 40;

    // Display each sub-character slot
    for (let i = 0; i < 5; i++) {
      const sub = subs[i];

      if (!sub) {
        // Show "Create Sub" only for the first empty slot
        if (i === subs.length) {
          const btn = this.add
            .text(LAYOUT.width / 2, y, "[ Create Sub ]", {
              fontFamily: FONTS.body,
              fontSize: "13px",
              color: COLORS.accent,
            })
            .setOrigin(0.5, 0)
            .setInteractive({ useHandCursor: true });

          btn.on("pointerup", () => {
            // Dispatch create with a default name
            const name = `Character ${i + 1}`;
            this.dispatch({
              type: "CREATE_SUBCHARACTER",
              name,
              nowUnixSec: this.nowUnixSec,
            });
            this.refresh();
          });
        }
      } else {
        this.drawSubCard(sub, y);
      }

      y += 88;
      if (y > CONTENT_BOTTOM - 70) break; // Don't overflow
    }

    // Page info at bottom
    this.add
      .text(LAYOUT.width / 2, CONTENT_BOTTOM - 10, `${subs.length} / 5 sub-characters`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
      })
      .setOrigin(0.5, 1);
  }

  /** One occupied sub-character card: identity, run status, and a context action. */
  private drawSubCard(sub: SubCharacter, y: number): void {
    const run = sub.currentRun;
    const pathStr = sub.path ? sub.path.charAt(0).toUpperCase() + sub.path.slice(1) : "—";

    this.add.rectangle(LAYOUT.width / 2, y + 34, LAYOUT.cardWidth, 72, 0x1a1a2e, 0.95);

    this.add.text(P + 8, y, sub.name, {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textPrimary,
    });

    this.add.text(
      P + 8,
      y + 18,
      `Path: ${pathStr}  |  ${sub.stats.totalRunsCompleted} runs  |  ${Math.floor(sub.meta.legacyAsh)} ash`,
      { fontFamily: FONTS.body, fontSize: "11px", color: COLORS.textSecondary }
    );

    // AUTO toggle — governs auto-restart on death / auto-start when idle.
    const autoOn = sub.automationConfig.enabled;
    const autoBtn = this.add
      .text(LAYOUT.width - P - 8, y, `[AUTO ${autoOn ? "ON" : "OFF"}]`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: autoOn ? COLORS.vitalityHigh : COLORS.textMuted,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    autoBtn.on("pointerup", () => {
      this.dispatch({
        type: "TOGGLE_SUBCHARACTER_AUTOMATION",
        subCharId: sub.id,
        enabled: !autoOn,
        nowUnixSec: this.nowUnixSec,
      });
      this.refresh();
    });

    // Status line + context action.
    if (!run) {
      this.add.text(P + 8, y + 38, "Status: Idle — not running", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });
      this.drawCardButton(y + 52, "[ Start Run ]", () => {
        this.dispatch({ type: "START_SUBCHARACTER_RUN", subCharId: sub.id, nowUnixSec: this.nowUnixSec });
        this.refresh();
      });
    } else if (run.alive) {
      const dungeon = run.currentDungeon
        ? DUNGEON_REGISTRY.get(run.currentDungeon.dungeonId)?.name
        : null;
      const where = dungeon ? ` · delving ${dungeon}` : "";
      this.add.text(
        P + 8,
        y + 38,
        `Status: Running · age ${formatAge(run.lifespan.ageSeconds)} · ${run.lifespan.stage}${where}`,
        { fontFamily: FONTS.body, fontSize: "11px", color: COLORS.vitalityHigh }
      );
      this.drawVitalityBar(P + 8, y + 54, run.lifespan.vitality);
    } else {
      // deepestDungeonIndex is a depthIndex shared by multiple dungeons, so show
      // the depth number rather than guessing a (possibly wrong) dungeon name.
      this.add.text(P + 8, y + 38, `Status: Fallen · reached depth ${run.deepestDungeonIndex}`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.vitalityLow,
      });
      const ash = computeLegacyAshBreakdown(run).total;
      this.drawCardButton(y + 52, `[ Claim ${Math.floor(ash)} ash ]`, () => {
        this.dispatch({ type: "CLAIM_SUBCHARACTER_DEATH", subCharId: sub.id, nowUnixSec: this.nowUnixSec });
        this.refresh();
      });
    }
  }

  /** Right-aligned text button inside a card row. */
  private drawCardButton(centerY: number, label: string, onClick: () => void): void {
    const btn = this.add
      .text(LAYOUT.width - P - 8, centerY, label, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.accent,
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", onClick);
  }

  /** Compact vitality bar for a running sub. */
  private drawVitalityBar(x: number, y: number, vitality: number): void {
    const width = 180;
    const height = 8;
    const v01 = Math.max(0, Math.min(1, vitality / 100));
    const color =
      vitality > 60 ? COLORS.vitalityHigh : vitality > 25 ? COLORS.vitalityMid : COLORS.vitalityLow;
    this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x15151f, 1).setStrokeStyle(1, 0x2d2d3d, 1);
    if (v01 > 0) {
      this.add.rectangle(
        x + (width * v01) / 2,
        y + height / 2,
        width * v01,
        height - 2,
        Phaser.Display.Color.HexStringToColor(color).color,
        1
      );
    }
    this.add
      .text(x + width + 8, y - 1, `${Math.floor(vitality)}%`, {
        fontFamily: FONTS.body,
        fontSize: "10px",
        color,
      });
  }

  /** Locked state — explains how to unlock sub-characters and shows progress. */
  private drawLocked(): void {
    const cx = LAYOUT.width / 2;
    let y = CONTENT_TOP + 60;

    this.add
      .text(cx, y, "🔒 Locked", {
        fontFamily: FONTS.heading,
        fontSize: "22px",
        color: COLORS.locked,
      })
      .setOrigin(0.5, 0);
    y += 50;

    this.add
      .text(
        cx,
        y,
        `Defeat the final dungeon —\n${FINAL_DUNGEON.name} —\nwith your first character to recruit\nsub-characters.`,
        {
          fontFamily: FONTS.body,
          fontSize: "14px",
          color: COLORS.textSecondary,
          align: "center",
          lineSpacing: 8,
        }
      )
      .setOrigin(0.5, 0);
    y += 130;

    // Progress toward the final dungeon (best depth ever reached).
    const best = this.saveFile.achievements.milestoneProgress.maxDepthEverReached;
    const goal = FINAL_DUNGEON.depthIndex;
    this.add
      .text(cx, y, `Deepest reached: ${best} / ${goal}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textMuted,
        align: "center",
      })
      .setOrigin(0.5, 0);
    y += 28;

    this.add
      .text(
        cx,
        y,
        "Sub-characters run extra lives in parallel,\neach with their own legacy and automation.",
        {
          fontFamily: FONTS.flavor,
          fontSize: "12px",
          color: COLORS.textMuted,
          align: "center",
          lineSpacing: 6,
        }
      )
      .setOrigin(0.5, 0);
  }
}
