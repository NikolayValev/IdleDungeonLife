import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEONS, DUNGEON_REGISTRY } from "../../content/dungeons";
import { JOB_REGISTRY } from "../../content/jobs";
import { TRAIT_REGISTRY } from "../../content/traits";
import { ITEM_REGISTRY } from "../../content/items";
import type { RunState, RunLogKind, Tag } from "../../core/types";
import { buildCharacterSvg } from "../avatar/buildCharacterSvg";
import { buildCharacterVisualInputFromRun, createAvatarTextureKey } from "../avatar/atlas";
import { deriveCharacterVisualState } from "../avatar/deriveVisualState";
import { fnv1a32 } from "../avatar/hashing";

const CONTENT_TOP = LAYOUT.hudHeight + 8;
const HOME_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 14;

// High-contrast color per trait tag, used for the Vessel badge readout.
const TAG_COLORS: Partial<Record<Tag, string>> = {
  holy: "#e8d080",
  shrine: "#e8d080",
  unholy: "#9b59b6",
  abyss: "#6c5ce7",
  decay: "#8aa05a",
  knowledge: "#3aa0e8",
  fate: "#e056c8",
  relic: "#f39c12",
  wealth: "#f1c40f",
  vitality: "#2ecc71",
  neutral: "#95a5a6",
  boss: "#ff5555",
};

const RARITY_COLORS = {
  common: COLORS.common,
  rare: COLORS.rare,
  legendary: COLORS.legendary,
} as const;

const EQUIP_SLOTS = ["weapon", "armor", "artifact"] as const;

function colorNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

// Pick black or white text for legibility on a given background color.
function readableTextColor(hex: string): string {
  const { red, green, blue } = Phaser.Display.Color.HexStringToColor(hex);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.6 ? "#0d0d0d" : "#f5f2e8";
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
    const avatarPanelHeight = 220;
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
    const alignLabel = alignment > 20 ? "Holy" : alignment < -20 ? "Unholy" : "Neutral";
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

      const isEvolved = run.evolvedTraitIds.includes(tid);
      const displayName = isEvolved && def.evolutionName ? def.evolutionName : def.name;
      const displayDesc =
        isEvolved && def.evolutionDescription ? def.evolutionDescription : def.description;
      const nameText = isEvolved ? `- ${displayName}  [+]` : `- ${displayName}`;
      const nameColor = isEvolved ? COLORS.accent : COLORS.textPrimary;

      this.add.text(p + 10, y, nameText, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: nameColor,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      });
      y += 16;
      this.add.text(p + 18, y, displayDesc, {
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

    // Discovery momentum
    if (run.discoveryMomentum > 0) {
      const threshold = 5;
      const pct = Math.floor(((run.discoveryMomentum % threshold) / threshold) * 100);
      this.add.text(p + 10, y, `Discovery: ${pct}% to next reveal`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });
      y += 16;
    }

    // Legacy path badge
    if (run.legacyPath) {
      const pathLabel = run.legacyPath.charAt(0).toUpperCase() + run.legacyPath.slice(1);
      this.add.text(p + 10, y, `Path: ${pathLabel}`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textSecondary,
      });
      y += 16;
    }

    y += 10;

    this.drawSectionRule(y - 4);
    y = this.drawActivitySection(run, y + 8);

    if (run.runLog?.length) {
      y += 8;
      this.drawSectionRule(y - 4);
      y = this.drawRunLog(run, y + 8);
    }

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

    this.add.text(x + 6, y + 2, `${Math.floor(run.lifespan.vitality)}% ${run.lifespan.stage}`, {
      fontFamily: FONTS.body,
      fontSize: "11px",
      color: "#101010",
    });
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
      const remaining = Math.max(0, run.currentDungeon.completesAtUnixSec - this.nowUnixSec);
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

    const unlockedDungeons = DUNGEONS.filter((dungeon) =>
      this.saveFile.meta.unlockedDungeonIds.includes(dungeon.id)
    );
    const latestUnlockedDungeon = this.pickLatestDungeon(unlockedDungeons);
    const latestEnterableDungeon = this.pickLatestDungeon(
      unlockedDungeons.filter((dungeon) => run.resources.gold >= dungeon.goldCost)
    );

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

    if (latestEnterableDungeon) {
      this.add.text(p + 10, y, `Ready: ${latestEnterableDungeon.name} is available now.`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      });
      this.drawTextButton(
        LAYOUT.width - p - 8,
        y + 34,
        `[ Enter ${latestEnterableDungeon.name} ]`,
        () => {
          this.dispatch({
            type: "START_DUNGEON",
            dungeonId: latestEnterableDungeon.id,
            nowUnixSec: this.nowUnixSec,
          });
          this.refresh();
        }
      );
      this.drawTextButton(LAYOUT.width - p - 8, y + 60, "[ Open Delves ]", () => {
        this.showTab("DungeonsScene");
      });
      return y + 84;
    }

    const neededGold = latestUnlockedDungeon
      ? Math.max(0, latestUnlockedDungeon.goldCost - run.resources.gold)
      : 0;
    this.add.text(
      p + 10,
      y,
      latestUnlockedDungeon
        ? `Next: earn ${Math.ceil(neededGold)}g for ${latestUnlockedDungeon.name}.`
        : "Next: choose a delve.",
      {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      }
    );

    this.drawTextButton(LAYOUT.width - p - 8, y + 34, "[ Open Delves ]", () => {
      this.showTab("DungeonsScene");
    });

    return y + 58;
  }

  private pickLatestDungeon<T extends { depthIndex: number }>(dungeons: T[]): T | null {
    if (!dungeons.length) return null;
    return dungeons.reduce((latest, dungeon) => {
      return dungeon.depthIndex >= latest.depthIndex ? dungeon : latest;
    });
  }

  private static readonly LOG_KIND_COLOR: Record<RunLogKind, string> = {
    dungeon: "#9999bb",
    trait_reveal: "#88ccaa",
    trait_evolved: "#ffdd88",
    legendary: "#ffaa44",
    boss: "#ff7766",
    milestone: "#aaddff",
    death_warning: "#ff4444",
    alignment: "#cc88ff",
  };

  private drawRunLog(run: RunState, y: number): number {
    const p = LAYOUT.padding;
    const log = run.runLog ?? [];
    if (log.length === 0) return y;

    this.add.text(p, y, "Recent Events", {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textSecondary,
    });
    y += 20;

    const entries = [...log].reverse().slice(0, 7);
    for (const entry of entries) {
      const color = MainScene.LOG_KIND_COLOR[entry.kind] ?? COLORS.textMuted;
      this.add.text(p + 10, y, entry.message, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color,
        wordWrap: { width: LAYOUT.cardWidth - 20 },
      });
      y += 16;
    }
    return y + 4;
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
    const top = panelCenterY - panelHeight / 2;
    const alignment = run.alignment.holyUnholy;
    const accentColor =
      alignment > 20
        ? colorNumber(COLORS.accentHoly)
        : alignment < -20
          ? colorNumber(COLORS.accentUnholy)
          : colorNumber(COLORS.accent);

    const avatarCY = top + 74;
    const traitRowY = top + 152;
    const equipRowY = top + 192;

    // Outer halo + drop shadow + framed panel. The halo and outline read
    // alignment boldly; the frame doubles up for a stronger edge.
    this.add.rectangle(
      panelCenterX,
      panelCenterY,
      panelWidth + 8,
      panelHeight + 8,
      accentColor,
      0.08
    );
    this.add.rectangle(panelCenterX + 3, panelCenterY + 4, panelWidth, panelHeight, 0x050506, 0.7);
    this.add
      .rectangle(panelCenterX, panelCenterY, panelWidth, panelHeight, 0x141420, 1)
      .setStrokeStyle(2.5, accentColor, 0.95);
    this.add
      .rectangle(panelCenterX, panelCenterY, panelWidth - 6, panelHeight - 6, 0x141420, 0)
      .setStrokeStyle(1, accentColor, 0.25);

    // Avatar "screen" with a vitality-driven glow behind the figure.
    this.add.rectangle(panelCenterX, avatarCY, panelWidth - 26, 92, 0x202036, 1);
    const vitality01 = Math.max(0, Math.min(1, run.lifespan.vitality / 100));
    this.add.circle(panelCenterX, avatarCY, 42, accentColor, 0.14 + 0.34 * vitality01);

    this.add
      .text(panelCenterX, top + 7, "VESSEL", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      })
      .setOrigin(0.5, 0);
    this.add.rectangle(panelCenterX, top + 25, 34, 2, accentColor, 0.9);
    this.add
      .text(panelCenterX, panelCenterY + panelHeight / 2 - 14, run.lifespan.stage.toUpperCase(), {
        fontFamily: FONTS.body,
        fontSize: "10px",
        color: COLORS.textMuted,
      })
      .setOrigin(0.5, 0);

    this.drawPanelCaption("TRAITS", panelCenterX, top + 130);
    this.drawTraitBadges(run, panelCenterX, traitRowY);
    this.drawPanelCaption("GEAR", panelCenterX, top + 172);
    this.drawEquipmentBadges(run, panelCenterX, equipRowY);

    const input = buildCharacterVisualInputFromRun(run);
    const state = deriveCharacterVisualState(input);
    const svg = buildCharacterSvg(state);
    const textureKey = ["avatar", run.seed, fnv1a32(svg).toString(16)].join("_");
    const requestId = ++this.avatarRequestId;

    void createAvatarTextureKey(this, textureKey, input)
      .then((resolvedKey) => {
        if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
          return;
        }

        this.add.image(panelCenterX, avatarCY, resolvedKey).setDisplaySize(92, 92);
      })
      .catch((error: unknown) => {
        if (!this.scene.isActive() || requestId !== this.avatarRequestId) {
          return;
        }

        console.warn("avatar texture generation failed", error);
        this.add
          .text(panelCenterX, avatarCY, "No image", {
            fontFamily: FONTS.body,
            fontSize: "11px",
            color: COLORS.textMuted,
          })
          .setOrigin(0.5);
      });
  }

  /** Small muted section label centered above a badge row. */
  private drawPanelCaption(label: string, centerX: number, y: number): void {
    this.add
      .text(centerX, y, label, {
        fontFamily: FONTS.body,
        fontSize: "8px",
        color: COLORS.textMuted,
      })
      .setOrigin(0.5, 0);
  }

  /** Row of colored pips — one per visible trait (by tag), plus dim "?" for hidden. */
  private drawTraitBadges(run: RunState, centerX: number, rowY: number): void {
    const pips: Array<{ color: string; glyph: string; evolved: boolean; dim: boolean }> = [];

    for (const tid of run.visibleTraitIds) {
      const def = TRAIT_REGISTRY.get(tid);
      if (!def) continue;
      pips.push({
        color: TAG_COLORS[def.tags[0]] ?? COLORS.textSecondary,
        glyph: def.name.charAt(0).toUpperCase(),
        evolved: run.evolvedTraitIds.includes(tid),
        dim: false,
      });
    }
    for (let i = 0; i < run.hiddenTraitIds.length; i++) {
      pips.push({ color: COLORS.locked, glyph: "?", evolved: false, dim: true });
    }

    const maxPips = 6;
    const shown = pips.slice(0, maxPips);
    const radius = 9;
    const gap = 4;
    const step = radius * 2 + gap;
    const startX = centerX - ((shown.length - 1) * step) / 2;

    shown.forEach((pip, i) => {
      const x = startX + i * step;
      const fill = colorNumber(pip.color);
      const circle = this.add.circle(x, rowY, radius, fill, pip.dim ? 0.4 : 1);
      if (pip.evolved) circle.setStrokeStyle(2.5, colorNumber(COLORS.accent), 1);
      else circle.setStrokeStyle(1.5, 0x0d0d0d, pip.dim ? 0.4 : 0.55);
      this.add
        .text(x, rowY, pip.glyph, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: pip.dim ? COLORS.textMuted : readableTextColor(pip.color),
        })
        .setOrigin(0.5);
    });
  }

  /** Three fixed slot chips (weapon/armor/artifact) that light up in rarity color. */
  private drawEquipmentBadges(run: RunState, centerX: number, rowY: number): void {
    const size = 20;
    const gap = 12;
    const step = size + gap;
    const startX = centerX - ((EQUIP_SLOTS.length - 1) * step) / 2;

    EQUIP_SLOTS.forEach((slot, i) => {
      const x = startX + i * step;
      const rarity = this.equippedRarity(run, slot);
      const g = this.add.graphics();

      if (rarity) {
        const hex = RARITY_COLORS[rarity];
        const col = colorNumber(hex);
        g.fillStyle(col, 0.22);
        g.fillRoundedRect(x - (size + 8) / 2, rowY - (size + 8) / 2, size + 8, size + 8, 7);
        g.fillStyle(col, 1);
        g.fillRoundedRect(x - size / 2, rowY - size / 2, size, size, 5);
        this.drawGearIcon(slot, x, rowY, colorNumber(readableTextColor(hex)));
      } else {
        g.fillStyle(0x16161f, 1);
        g.fillRoundedRect(x - size / 2, rowY - size / 2, size, size, 5);
        g.lineStyle(1, 0x33334a, 1);
        g.strokeRoundedRect(x - size / 2, rowY - size / 2, size, size, 5);
        this.drawGearIcon(slot, x, rowY, colorNumber(COLORS.textMuted));
      }
    });
  }

  /** Draw a small gear glyph (sword / shield / gem) centered at (x, y). */
  private drawGearIcon(
    slot: "weapon" | "armor" | "artifact",
    x: number,
    y: number,
    color: number
  ): void {
    const g = this.add.graphics({ x, y });
    g.fillStyle(color, 1);
    const poly = (coords: number[][]) =>
      g.fillPoints(
        coords.map(([px, py]) => new Phaser.Geom.Point(px, py)),
        true
      );

    if (slot === "weapon") {
      poly([
        [0, -7],
        [2, -4],
        [2, 2],
        [-2, 2],
        [-2, -4],
      ]); // blade
      g.fillRect(-4.5, 2, 9, 1.8); // crossguard
      g.fillRect(-1.2, 3.8, 2.4, 3.2); // grip
    } else if (slot === "armor") {
      poly([
        [0, -6.5],
        [5.5, -4],
        [5.5, 1],
        [0, 6.5],
        [-5.5, 1],
        [-5.5, -4],
      ]); // shield
    } else {
      poly([
        [0, -6.5],
        [5.5, -1],
        [0, 6.5],
        [-5.5, -1],
      ]); // gem
    }
  }

  private equippedRarity(
    run: RunState,
    slot: "weapon" | "armor" | "artifact"
  ): "common" | "rare" | "legendary" | null {
    const instanceId = run.equipment[slot];
    if (!instanceId) return null;
    const inst = run.inventory.items.find((i) => i.instanceId === instanceId);
    if (!inst) return null;
    return ITEM_REGISTRY.get(inst.itemId)?.rarity ?? null;
  }

  private drawTextButton(
    rightX: number,
    centerY: number,
    label: string,
    onClick: () => void
  ): void {
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

    text
      .setPosition(rightX - 7, centerY)
      .setOrigin(1, 0.5)
      .setInteractive({
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
