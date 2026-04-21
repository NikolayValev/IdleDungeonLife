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
const HOME_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 14;

function colorNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

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
    let y = CONTENT_TOP + 14;
    const avatarPanelWidth = 142;
    const avatarPanelHeight = 166;
    const avatarPanelX = LAYOUT.width - p - avatarPanelWidth / 2;
    const avatarPanelY = y + avatarPanelHeight / 2 - 2;
    const contentWidth = LAYOUT.width - p * 3 - avatarPanelWidth;

    this.drawAvatarPanel(run, avatarPanelX, avatarPanelY, avatarPanelWidth, avatarPanelHeight);

    this.add.text(p, y, "IDLE DUNGEON LIFE", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });
    y += 30;

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
      wordWrap: { width: contentWidth },
    });
    y += 22;

    this.add.text(p, y, `Age: ${this.formatAge(run.lifespan.ageSeconds)}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.textSecondary,
      wordWrap: { width: contentWidth },
    });
    y += 18;

    this.drawVitalityBar(run, p, y, contentWidth);
    y = Math.max(y + 30, CONTENT_TOP + 14 + avatarPanelHeight + 12);

    this.drawSectionRule(y - 8);
    this.add.text(p, y, "Traits", {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textSecondary,
    });
    y += 20;

    for (const tid of run.visibleTraitIds) {
      const def = TRAIT_REGISTRY.get(tid);
      if (!def) continue;

      this.add.text(p + 10, y, `- ${def.name}`, {
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

    for (const _tid of run.hiddenTraitIds) {
      this.add.text(p + 10, y, "- ???", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
      });
      y += 16;
    }
    y += 10;

    this.drawSectionRule(y - 4);
    y = this.drawActivitySection(run, y + 8);

    this.drawResourceChips(run, Math.min(y + 8, HOME_BOTTOM - 30));
  }

  private drawVitalityBar(run: RunState, x: number, y: number, width: number): void {
    const vitalColor =
      run.lifespan.vitality > 60
        ? COLORS.vitalityHigh
        : run.lifespan.vitality > 25
        ? COLORS.vitalityMid
        : COLORS.vitalityLow;
    const height = 18;
    const fillWidth = Math.floor((run.lifespan.vitality / 100) * width);

    this.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x171720, 1)
      .setStrokeStyle(1, 0x2f3040, 1);

    if (fillWidth > 0) {
      this.add.rectangle(
        x + fillWidth / 2,
        y + height / 2,
        fillWidth,
        height - 4,
        colorNumber(vitalColor),
        1
      );
    }

    this.add.text(
      x + 6,
      y + 2,
      `${Math.floor(run.lifespan.vitality)}% ${run.lifespan.stage}`,
      {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: "#101010",
      }
    );
  }

  private drawActivitySection(run: RunState, y: number): number {
    const p = LAYOUT.padding;
    const job = run.currentJobId ? JOB_REGISTRY.get(run.currentJobId) : null;

    this.add.text(p, y, "Current Plan", {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textSecondary,
    });
    y += 20;

    this.add.text(p + 10, y, `Job: ${job ? job.name : "None"}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: job ? COLORS.textPrimary : COLORS.textMuted,
    });
    y += 20;

    if (run.currentDungeon) {
      const dDef = DUNGEON_REGISTRY.get(run.currentDungeon.dungeonId);
      const remaining = Math.max(
        0,
        run.currentDungeon.completesAtUnixSec - this.nowUnixSec
      );
      this.add.text(p + 10, y, `In dungeon: ${dDef?.name ?? "?"}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.accent,
      });
      y += 18;
      this.add.text(p + 10, y, `Completes in: ${remaining}s`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      });
      y += 24;

      if (remaining === 0) {
        const collectBtn = this.add
          .text(p + 10, y, "[ Collect Results ]", {
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
      return y;
    }

    const chapel = DUNGEON_REGISTRY.get("abandoned_chapel");
    if (!job && this.saveFile.meta.unlockedJobIds.includes("porter")) {
      this.add.text(p + 10, y, "Next: work as Porter to earn dungeon gold.", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      });
      this.drawTextButton(LAYOUT.width - p - 8, y + 34, "[ Assign Porter ]", () => {
        this.dispatch({ type: "ASSIGN_JOB", jobId: "porter" });
        this.refresh();
      });
      return y + 58;
    }

    if (
      chapel &&
      this.saveFile.meta.unlockedDungeonIds.includes(chapel.id) &&
      run.resources.gold >= chapel.goldCost
    ) {
      this.add.text(p + 10, y, "Ready: the chapel can be entered now.", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      });
      this.drawTextButton(LAYOUT.width - p - 8, y + 34, "[ Enter Chapel ]", () => {
        this.dispatch({
          type: "START_DUNGEON",
          dungeonId: chapel.id,
          nowUnixSec: this.nowUnixSec,
        });
        this.refresh();
      });
      return y + 58;
    }

    const neededGold = chapel ? Math.max(0, chapel.goldCost - run.resources.gold) : 0;
    this.add.text(
      p + 10,
      y,
      neededGold > 0 ? `Next: earn ${Math.ceil(neededGold)}g for the chapel.` : "Next: choose a delve.",
      {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      }
    );

    return y + 30;
  }

  private drawResourceChips(run: RunState, y: number): void {
    const p = LAYOUT.padding;
    this.drawMetricChip(p, y, 104, "Gold", `${Math.floor(run.resources.gold)}`, COLORS.accent);
    this.drawMetricChip(
      p + 116,
      y,
      110,
      "Essence",
      `${Math.floor(run.resources.essence * 10) / 10}`,
      COLORS.accentHoly
    );
    this.drawMetricChip(
      p + 238,
      y,
      120,
      "Legacy Ash",
      `${this.saveFile.meta.legacyAsh}`,
      COLORS.textSecondary
    );
  }

  private drawMetricChip(
    leftX: number,
    topY: number,
    width: number,
    label: string,
    value: string,
    valueColor: string
  ): void {
    this.add
      .rectangle(leftX + width / 2, topY + 15, width, 30, 0x15151f, 1)
      .setStrokeStyle(1, 0x2d2d3d, 1);
    this.add.text(leftX + 8, topY + 5, label, {
      fontFamily: FONTS.body,
      fontSize: "10px",
      color: COLORS.textMuted,
    });
    this.add
      .text(leftX + width - 8, topY + 5, value, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: valueColor,
      })
      .setOrigin(1, 0);
  }

  private drawAvatarPanel(
    run: RunState,
    panelCenterX: number,
    panelCenterY: number,
    panelWidth: number,
    panelHeight: number
  ): void {
    const alignment = run.alignment.holyUnholy;
    const accentColor =
      alignment > 20
        ? colorNumber(COLORS.accentHoly)
        : alignment < -20
        ? colorNumber(COLORS.accentUnholy)
        : colorNumber(COLORS.accent);

    this.add.rectangle(
      panelCenterX + 3,
      panelCenterY + 4,
      panelWidth,
      panelHeight,
      0x050506,
      0.65
    );
    this.add
      .rectangle(panelCenterX, panelCenterY, panelWidth, panelHeight, 0x171723, 1)
      .setStrokeStyle(1, accentColor, 0.35);
    this.add.rectangle(
      panelCenterX,
      panelCenterY + 12,
      panelWidth - 22,
      panelHeight - 44,
      0x23233a,
      1
    );
    this.add.circle(panelCenterX, panelCenterY + 24, 38, accentColor, 0.08);

    const input = buildCharacterVisualInputFromRun(run);
    const state = deriveCharacterVisualState(input);
    const svg = buildCharacterSvg(state);
    const textureKey = ["avatar", run.seed, fnv1a32(svg).toString(16)].join("_");
    const requestId = ++this.avatarRequestId;

    this.add
      .text(panelCenterX, panelCenterY - panelHeight / 2 + 12, "Vessel", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(panelCenterX, panelCenterY + panelHeight / 2 - 22, run.lifespan.stage.toUpperCase(), {
        fontFamily: FONTS.body,
        fontSize: "10px",
        color: COLORS.textMuted,
      })
      .setOrigin(0.5, 0);

    void createAvatarTextureKey(this, textureKey, input)
      .then((resolvedKey) => {
        if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
          return;
        }

        this.add.image(panelCenterX, panelCenterY + 10, resolvedKey).setDisplaySize(120, 120);
      })
      .catch((error: unknown) => {
        if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
          return;
        }

        console.warn("avatar texture generation failed", error);
        this.add
          .text(panelCenterX, panelCenterY + 12, "No image", {
            fontFamily: FONTS.body,
            fontSize: "11px",
            color: COLORS.textMuted,
          })
          .setOrigin(0.5);
      });
  }

  private drawTextButton(rightX: number, centerY: number, label: string, onClick: () => void): void {
    const text = this.add.text(0, 0, label, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.accent,
    });
    const width = text.width + 14;
    const bg = this.add
      .rectangle(rightX - width / 2, centerY, width, 22, 0x201b12, 1)
      .setStrokeStyle(1, colorNumber(COLORS.accent), 0.65)
      .setInteractive({ useHandCursor: true });

    text.setPosition(rightX - 7, centerY).setOrigin(1, 0.5).setInteractive({
      useHandCursor: true,
    });
    text.setDepth(bg.depth + 1);

    const hoverIn = () => {
      bg.setFillStyle(0x2d2517, 1);
      text.setColor(COLORS.vitalityHigh);
    };
    const hoverOut = () => {
      bg.setFillStyle(0x201b12, 1);
      text.setColor(COLORS.accent);
    };

    bg.on("pointerup", onClick);
    text.on("pointerup", onClick);
    bg.on("pointerover", hoverIn);
    text.on("pointerover", hoverIn);
    bg.on("pointerout", hoverOut);
    text.on("pointerout", hoverOut);
  }

  private drawSectionRule(y: number): void {
    this.add.rectangle(LAYOUT.width / 2, y, LAYOUT.cardWidth, 1, 0x242432, 1);
  }

  private formatAge(ageSeconds: number): string {
    const minutes = Math.floor(ageSeconds / 60);
    const seconds = Math.floor(ageSeconds % 60);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }
}
