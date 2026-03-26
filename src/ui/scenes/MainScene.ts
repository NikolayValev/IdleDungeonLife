import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEON_REGISTRY } from "../../content/dungeons";
import { JOB_REGISTRY } from "../../content/jobs";
import { TRAIT_REGISTRY } from "../../content/traits";

const CONTENT_TOP = LAYOUT.hudHeight + 8;

export class MainScene extends BaseScene {
  constructor() {
    super({ key: "MainScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    const run = this.saveFile.currentRun;

    if (!run) {
      this.drawNoRun();
      return;
    }

    this.drawRunSummary(run);
  }

  private drawNoRun(): void {
    this.add
      .text(LAYOUT.width / 2, LAYOUT.height / 2 - 60, "No active run.", {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color: COLORS.textSecondary,
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(LAYOUT.width / 2, LAYOUT.height / 2 + 20, "[ Begin Run ]", {
        fontFamily: FONTS.body,
        fontSize: "20px",
        color: COLORS.accent,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerup", () => {
      this.dispatch({ type: "START_NEW_RUN", nowUnixSec: this.nowUnixSec });
      this.refresh();
    });
  }

  private drawRunSummary(run: import("../../core/types").RunState): void {
    const p = LAYOUT.padding;
    let y = CONTENT_TOP + p;

    // Title
    this.add.text(p, y, "IDLE DUNGEON LIFE", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });
    y += 28;

    // Alignment
    const alignment = run.alignment.holyUnholy;
    const alignLabel =
      alignment > 20 ? "Holy" : alignment < -20 ? "Unholy" : "Neutral";
    const alignColor =
      alignment > 20
        ? COLORS.accentHoly
        : alignment < -20
        ? COLORS.accentUnholy
        : COLORS.textSecondary;

    this.add.text(p, y, `Alignment: ${alignLabel} (${Math.round(alignment)})`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: alignColor,
    });
    y += 20;

    // Vitality bar
    const vitalColor =
      run.lifespan.vitality > 60
        ? COLORS.vitalityHigh
        : run.lifespan.vitality > 25
        ? COLORS.vitalityMid
        : COLORS.vitalityLow;

    this.add.text(p, y, `Stage: ${run.lifespan.stage.toUpperCase()}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: vitalColor,
    });
    y += 20;

    const barWidth = LAYOUT.cardWidth - 2;
    this.add.rectangle(p + barWidth / 2, y + 6, barWidth, 12, 0x222233);
    const fillWidth = Math.floor((run.lifespan.vitality / 100) * barWidth);
    if (fillWidth > 0) {
      this.add.rectangle(p + fillWidth / 2, y + 6, fillWidth, 12, Phaser.Display.Color.HexStringToColor(vitalColor).color);
    }
    y += 22;

    // Traits
    this.add.text(p, y, "Traits:", {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.textSecondary,
    });
    y += 18;

    for (const tid of run.visibleTraitIds) {
      const def = TRAIT_REGISTRY.get(tid);
      if (def) {
        this.add.text(p + 10, y, `• ${def.name}`, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.textPrimary,
          wordWrap: { width: LAYOUT.cardWidth - 20 },
        });
        y += 16;
        this.add.text(p + 18, y, def.description, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.textMuted,
          wordWrap: { width: LAYOUT.cardWidth - 28 },
        });
        y += 28;
      }
    }

    for (const _tid of run.hiddenTraitIds) {
      this.add.text(p + 10, y, `• ???`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
      });
      y += 16;
    }
    y += 8;

    // Job
    const job = run.currentJobId ? JOB_REGISTRY.get(run.currentJobId) : null;
    this.add.text(p, y, `Job: ${job ? job.name : "None"}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.textSecondary,
    });
    y += 22;

    // Dungeon status
    if (run.currentDungeon) {
      const dDef = DUNGEON_REGISTRY.get(run.currentDungeon.dungeonId);
      const remaining = Math.max(
        0,
        run.currentDungeon.completesAtUnixSec - this.nowUnixSec
      );
      this.add.text(p, y, `In dungeon: ${dDef?.name ?? "?"}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.accent,
      });
      y += 18;
      this.add.text(p, y, `Completes in: ${remaining}s`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      });
      y += 24;

      if (remaining === 0) {
        const collectBtn = this.add
          .text(p, y, "[ Collect Results ]", {
            fontFamily: FONTS.body,
            fontSize: "15px",
            color: COLORS.accent,
          })
          .setInteractive({ useHandCursor: true });
        collectBtn.on("pointerup", () => {
          this.dispatch({
            type: "COMPLETE_DUNGEON",
            nowUnixSec: this.nowUnixSec,
          });
          this.refresh();
        });
        y += 28;
      }
    }

    // Resources
    y += 4;
    this.add.text(p, y, `Gold: ${Math.floor(run.resources.gold)}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.accent,
    });
    y += 18;
    this.add.text(
      p,
      y,
      `Essence: ${Math.floor(run.resources.essence * 10) / 10}`,
      {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.accentHoly,
      }
    );
    y += 18;
    this.add.text(
      p,
      y,
      `Legacy Ash: ${this.saveFile.meta.legacyAsh} (meta)`,
      {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textSecondary,
      }
    );
  }
}
