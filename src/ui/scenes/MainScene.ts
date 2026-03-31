import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEON_REGISTRY } from "../../content/dungeons";
import { JOB_REGISTRY } from "../../content/jobs";
import { TRAIT_REGISTRY } from "../../content/traits";
import type { RunState } from "../../core/types";
import { buildCharacterSvg } from "../avatar/buildCharacterSvg";
import {
  buildCharacterVisualInputFromRun,
  createAvatarTextureKey,
} from "../avatar/atlas";
import { deriveCharacterVisualState } from "../avatar/deriveVisualState";
import { fnv1a32 } from "../avatar/hashing";

const CONTENT_TOP = LAYOUT.hudHeight + 8;

export class MainScene extends BaseScene {
  private avatarRequestId = 0;

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

  private drawRunSummary(run: RunState): void {
    const p = LAYOUT.padding;
    let y = CONTENT_TOP + p;
    const avatarPanelWidth = 132;
    const avatarPanelHeight = 156;
    const avatarPanelX = LAYOUT.width - p - avatarPanelWidth / 2;
    const avatarPanelY = y + avatarPanelHeight / 2 - 4;
    const contentWidth = LAYOUT.width - p * 3 - avatarPanelWidth;

    this.drawAvatarPanel(run, avatarPanelX, avatarPanelY, avatarPanelWidth, avatarPanelHeight);

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

    this.add.text(
      p,
      y,
      `Alignment: ${alignLabel} (${Math.round(alignment)})`,
      {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: alignColor,
        wordWrap: { width: contentWidth },
      }
    );
    y += 20;

    // Vitality bar
    const vitalColor =
      run.lifespan.vitality > 60
        ? COLORS.vitalityHigh
        : run.lifespan.vitality > 25
        ? COLORS.vitalityMid
        : COLORS.vitalityLow;

    this.add.text(
      p,
      y,
      `Stage: ${run.lifespan.stage.toUpperCase()}`,
      {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: vitalColor,
        wordWrap: { width: contentWidth },
      }
    );
    y += 20;

    const barWidth = contentWidth;
    this.add.rectangle(p + barWidth / 2, y + 6, barWidth, 12, 0x222233);
    const fillWidth = Math.floor((run.lifespan.vitality / 100) * barWidth);
    if (fillWidth > 0) {
      this.add.rectangle(p + fillWidth / 2, y + 6, fillWidth, 12, Phaser.Display.Color.HexStringToColor(vitalColor).color);
    }
    y = Math.max(y + 22, CONTENT_TOP + p + avatarPanelHeight + 10);

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

  private drawAvatarPanel(
    run: RunState,
    panelCenterX: number,
    panelCenterY: number,
    panelWidth: number,
    panelHeight: number
  ): void {
    this.add
      .rectangle(panelCenterX, panelCenterY, panelWidth, panelHeight, 0x1a1a2e, 1)
      .setStrokeStyle(1, 0x343452, 1);

    this.add.rectangle(panelCenterX, panelCenterY + 8, panelWidth - 20, panelHeight - 36, 0x23233a, 1);

    const input = buildCharacterVisualInputFromRun(run);
    const state = deriveCharacterVisualState(input);
    const svg = buildCharacterSvg(state);
    const textureKey = [
      "avatar",
      run.seed,
      fnv1a32(svg).toString(16),
    ].join("_");
    const requestId = ++this.avatarRequestId;

    this.add.text(panelCenterX, panelCenterY - panelHeight / 2 + 12, "Vessel", {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textSecondary,
    }).setOrigin(0.5, 0);

    void createAvatarTextureKey(this, textureKey, input).then((resolvedKey) => {
      if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
        return;
      }

      this.add.image(panelCenterX, panelCenterY + 12, resolvedKey).setDisplaySize(112, 112);
    }).catch((error: unknown) => {
      if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
        return;
      }

      console.warn("avatar texture generation failed", error);
      this.add.text(panelCenterX, panelCenterY + 12, "No image", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      }).setOrigin(0.5);
    });
  }
}
