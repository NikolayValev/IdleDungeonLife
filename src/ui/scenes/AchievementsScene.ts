import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { ACHIEVEMENT_REGISTRY } from "../../content/achievements";

const P = LAYOUT.padding;
const CONTENT_TOP = LAYOUT.hudHeight + 8;
const CONTENT_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 8;

export class AchievementsScene extends BaseScene {
  constructor() {
    super({ key: "AchievementsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, CONTENT_TOP, "ACHIEVEMENTS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const achievements = this.saveFile.achievements;
    const milestones = achievements.milestoneProgress;
    let y = CONTENT_TOP + 40;

    // Show global milestone progress
    this.add.text(P, y, "Milestones:", {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.accent,
    });
    y += 24;

    const milestoneStats = [
      { label: "Bosses Defeated", value: milestones.totalBossesFelled },
      { label: "Max Depth Reached", value: milestones.maxDepthEverReached },
      { label: "Total Survival Time", value: `${milestones.totalSurvivalSeconds}s` },
      { label: "Paths Completed", value: milestones.distinctPathsCompleted.length },
    ];

    for (const stat of milestoneStats) {
      this.add.text(P + 8, y, `${stat.label}: ${stat.value}`, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      });
      y += 18;
    }

    y += 8;

    // Show achievements
    this.add.text(P, y, "Unlocked:", {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.vitalityHigh,
    });
    y += 18;

    const unlockedCount = achievements.unlockedIds.length;
    const unlockedPerks: string[] = [];

    for (const achId of achievements.unlockedIds) {
      const achDef = ACHIEVEMENT_REGISTRY.get(achId);
      if (!achDef) continue;

      const rewardStr = achDef.reward
        ? Object.entries(achDef.reward)
            .filter(([_, v]) => v)
            .map(([k, v]) => `+${(v * 100).toFixed(0)}% ${k.replace("Boost", "")}`)
            .join(", ")
        : "no reward";

      this.add.text(P + 8, y, `✓ ${achDef.title}`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.vitalityHigh,
      });
      y += 14;

      if (rewardStr !== "no reward") {
        this.add.text(P + 12, y, rewardStr, {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.textMuted,
        });
        y += 12;
        unlockedPerks.push(rewardStr);
      }
    }

    if (unlockedCount === 0) {
      this.add.text(P + 8, y, "No achievements unlocked yet", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });
      y += 18;
    }

    y += 12;

    // Show locked achievements
    this.add.text(P, y, "Locked:", {
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: COLORS.textMuted,
    });
    y += 18;

    let lockedCount = 0;
    for (const achDef of ACHIEVEMENT_REGISTRY.values()) {
      if (achievements.unlockedIds.includes(achDef.id)) continue;
      if (lockedCount >= 3) {
        // Show just a count summary
        this.add.text(P + 8, y, `... and ${ACHIEVEMENT_REGISTRY.size - achievements.unlockedIds.length - lockedCount} more`, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.textMuted,
        });
        break;
      }

      this.add.text(P + 8, y, `○ ${achDef.title}`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });
      y += 14;
      lockedCount++;
    }

    // Summary at bottom
    this.add.text(LAYOUT.width / 2, CONTENT_BOTTOM - 10, `${unlockedCount} / ${ACHIEVEMENT_REGISTRY.size} achievements`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textMuted,
    }).setOrigin(0.5, 1);
  }
}
