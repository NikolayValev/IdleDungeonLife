import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { computeLegacyAshReward } from "../../core/scoring";
import { TRAIT_REGISTRY } from "../../content/traits";
import { DUNGEONS } from "../../content/dungeons";

const P = LAYOUT.padding;

export class DeathScene extends BaseScene {
  constructor() {
    super({ key: "DeathScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    const run = this.saveFile.currentRun;
    const meta = this.saveFile.meta;

    let y = LAYOUT.hudHeight + 16;

    this.add.text(LAYOUT.width / 2, y, "— END OF RUN —", {
      fontFamily: FONTS.heading,
      fontSize: "22px",
      color: COLORS.vitalityLow,
    }).setOrigin(0.5, 0);
    y += 36;

    if (!run) {
      this.add.text(LAYOUT.width / 2, y, "No run data.", {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: COLORS.textMuted,
      }).setOrigin(0.5, 0);
    } else {
      const ash = computeLegacyAshReward(run);
      const ageMin = Math.floor(run.lifespan.ageSeconds / 60);
      const ageSec = Math.floor(run.lifespan.ageSeconds % 60);
      const depth = run.deepestDungeonIndex;
      const bosses = run.bossesCleared.length;

      this.add.text(P, y, `Survived: ${ageMin}m ${ageSec}s`, {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: COLORS.textPrimary,
      });
      y += 22;

      this.add.text(P, y, `Deepest dungeon: ${depth >= 0 ? (DUNGEONS.find(d => d.depthIndex === depth)?.name ?? `Depth ${depth}`) : "None"}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textSecondary,
      });
      y += 20;

      this.add.text(P, y, `Dungeons completed: ${run.totalDungeonsCompleted}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textSecondary,
      });
      y += 20;

      this.add.text(P, y, `Bosses defeated: ${bosses}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: bosses > 0 ? COLORS.legendary : COLORS.textSecondary,
      });
      y += 28;

      // Traits discovered
      const newTraits = [
        ...run.visibleTraitIds,
        ...run.hiddenTraitIds,
      ].filter((tid) => !meta.discoveredTraitIds.includes(tid));

      if (newTraits.length > 0) {
        this.add.text(P, y, "New discoveries:", {
          fontFamily: FONTS.body,
          fontSize: "14px",
          color: COLORS.accent,
        });
        y += 20;
        for (const tid of newTraits) {
          const def = TRAIT_REGISTRY.get(tid);
          this.add.text(P + 10, y, `• ${def?.name ?? tid}`, {
            fontFamily: FONTS.body,
            fontSize: "12px",
            color: COLORS.textPrimary,
          });
          y += 16;
        }
        y += 8;
      }

      // Legacy ash
      this.add.text(P, y, `Legacy Ash earned: +${ash}`, {
        fontFamily: FONTS.body,
        fontSize: "16px",
        color: COLORS.accent,
      });
      y += 28;

      this.add.text(P, y, `Total Legacy Ash: ${meta.legacyAsh + ash}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textSecondary,
      });
      y += 36;
    }

    // Begin new run button
    const newRunBtn = this.add
      .text(LAYOUT.width / 2, y, "[ Begin New Run ]", {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    newRunBtn.on("pointerover", () =>
      newRunBtn.setColor(COLORS.vitalityHigh)
    );
    newRunBtn.on("pointerout", () => newRunBtn.setColor(COLORS.accent));
    newRunBtn.on("pointerup", () => {
      this.dispatch({ type: "CLAIM_DEATH", nowUnixSec: this.nowUnixSec });
      this.dispatch({
        type: "START_NEW_RUN",
        nowUnixSec: this.nowUnixSec,
      });
      this.scene.start("MainScene");
    });
  }
}
