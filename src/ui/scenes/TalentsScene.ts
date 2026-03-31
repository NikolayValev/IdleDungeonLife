import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { TALENTS, TALENT_REGISTRY } from "../../content/talents";
import { computeStats } from "../../core/modifiers";

const P = LAYOUT.padding;
const TALENTS_PER_PAGE = 5;
let currentTalentPage = 0;
type TalentBranchFilter = "all" | "core" | "holy" | "abyss";
let talentBranchFilter: TalentBranchFilter = "all";

function matchesBranch(nodeId: string): TalentBranchFilter {
  if (nodeId.startsWith("holy")) return "holy";
  if (nodeId.startsWith("abyss")) return "abyss";
  return "core";
}

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

    const filters: Array<{ id: TalentBranchFilter; label: string }> = [
      { id: "all", label: "[ All ]" },
      { id: "core", label: "[ Core ]" },
      { id: "holy", label: "[ Holy ]" },
      { id: "abyss", label: "[ Abyss ]" },
    ];

    filters.forEach((filter, index) => {
      const button = this.add.text(P + index * 84, y, filter.label, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: talentBranchFilter === filter.id ? COLORS.accent : COLORS.textSecondary,
      }).setInteractive({ useHandCursor: true });

      button.on("pointerup", () => {
        if (talentBranchFilter === filter.id) return;
        talentBranchFilter = filter.id;
        currentTalentPage = 0;
        this.refresh();
      });
    });
    y += 22;

    const filteredTalents = TALENTS.filter((node) =>
      talentBranchFilter === "all" ? true : matchesBranch(node.id) === talentBranchFilter
    );

    const totalPages = Math.max(1, Math.ceil(filteredTalents.length / TALENTS_PER_PAGE));
    currentTalentPage = Math.min(currentTalentPage, totalPages - 1);
    const visibleTalents = filteredTalents.slice(
      currentTalentPage * TALENTS_PER_PAGE,
      (currentTalentPage + 1) * TALENTS_PER_PAGE
    );

    for (const node of visibleTalents) {
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
    }

    if (totalPages > 1) {
      const pagerY = LAYOUT.height - LAYOUT.tabBarHeight - 20;
      if (currentTalentPage > 0) {
        const prev = this.add.text(P, pagerY, "[ Prev ]", {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.accent,
        }).setInteractive({ useHandCursor: true });
        prev.on("pointerup", () => {
          currentTalentPage -= 1;
          this.refresh();
        });
      }

      this.add.text(LAYOUT.width / 2, pagerY, `Page ${currentTalentPage + 1}/${totalPages}`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      }).setOrigin(0.5, 0);

      if (currentTalentPage < totalPages - 1) {
        const next = this.add.text(LAYOUT.width - P, pagerY, "[ Next ]", {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.accent,
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        next.on("pointerup", () => {
          currentTalentPage += 1;
          this.refresh();
        });
      }
    }
  }
}
