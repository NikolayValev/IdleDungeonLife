import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { TALENTS, TALENT_REGISTRY } from "../../content/talents";
import { computeStats } from "../../core/modifiers";

const P = LAYOUT.padding;

export class TalentsScene extends BaseScene {
  constructor() {
    super({ key: "TalentsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, LAYOUT.hudHeight + 8, "TALENTS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const run = this.saveFile.currentRun;

    if (!run) {
      this.add.text(P, LAYOUT.hudHeight + 48, "No active run.", {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textMuted,
      });
      return;
    }

    const stats = computeStats(run);
    let y = LAYOUT.hudHeight + 38;

    this.add.text(P, y, `Essence: ${Math.floor(run.resources.essence * 10) / 10}`, {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.accentHoly,
    });
    y += 22;

    for (const node of TALENTS) {
      const isUnlocked = run.talents.unlockedNodeIds.includes(node.id);
      const prereqsMet = node.prerequisites.every((p) =>
        run.talents.unlockedNodeIds.includes(p)
      );
      const cost = Math.ceil(node.costEssence * stats.talentCostMultiplier);
      const canAfford = run.resources.essence >= cost;
      const canUnlock = prereqsMet && !isUnlocked && canAfford && run.alive;

      const cardBg = isUnlocked
        ? 0x1a2a1a
        : prereqsMet
        ? 0x1a1a2e
        : 0x111111;
      this.add.rectangle(LAYOUT.width / 2, y + 32, LAYOUT.cardWidth, 64, cardBg, 0.95);

      const nameColor = isUnlocked
        ? COLORS.vitalityHigh
        : prereqsMet
        ? COLORS.textPrimary
        : COLORS.locked;

      // Branch indicator
      const branch = node.id.startsWith("holy")
        ? " [Sanctified]"
        : node.id.startsWith("abyss")
        ? " [Abyssal]"
        : " [Core]";
      const branchColor = node.id.startsWith("holy")
        ? COLORS.accentHoly
        : node.id.startsWith("abyss")
        ? COLORS.accentUnholy
        : COLORS.textSecondary;

      this.add.text(P + 8, y + 8, node.name, {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: nameColor,
      });

      this.add.text(P + 8 + 180, y + 8, branch, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: branchColor,
      });

      this.add.text(P + 8, y + 28, node.description, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 90 },
      });

      const costLabel = isUnlocked ? "✓" : `${cost}e`;
      const costColor = isUnlocked
        ? COLORS.vitalityHigh
        : canAfford && prereqsMet
        ? COLORS.accentHoly
        : COLORS.locked;
      this.add.text(LAYOUT.width - P - 8, y + 8, costLabel, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: costColor,
      }).setOrigin(1, 0);

      if (canUnlock) {
        const btn = this.add
          .text(LAYOUT.width - P - 8, y + 30, "[ Unlock ]", {
            fontFamily: FONTS.body,
            fontSize: "12px",
            color: COLORS.accent,
          })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true });

        btn.on("pointerup", () => {
          this.dispatch({ type: "UNLOCK_TALENT", nodeId: node.id });
          this.refresh();
        });
      } else if (!isUnlocked && !prereqsMet) {
        const prereqNames = node.prerequisites
          .map((p) => TALENT_REGISTRY.get(p)?.name ?? p)
          .join(", ");
        this.add.text(LAYOUT.width - P - 8, y + 30, `Needs: ${prereqNames}`, {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.locked,
          wordWrap: { width: 140 },
        }).setOrigin(1, 0);
      }

      y += 74;
      if (y > LAYOUT.height - LAYOUT.tabBarHeight - 74) break;
    }
  }
}
