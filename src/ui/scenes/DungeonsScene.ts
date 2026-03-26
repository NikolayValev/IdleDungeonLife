import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEONS } from "../../content/dungeons";
import { computeDungeonScore, resolveDungeonOutcome } from "../../core/stats";

const P = LAYOUT.padding;

export class DungeonsScene extends BaseScene {
  constructor() {
    super({ key: "DungeonsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, LAYOUT.hudHeight + 8, "DUNGEONS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const run = this.saveFile.currentRun;
    const meta = this.saveFile.meta;
    let y = LAYOUT.hudHeight + 40;

    for (const dungeon of DUNGEONS) {
      const isUnlocked = meta.unlockedDungeonIds.includes(dungeon.id);
      const isActive = run?.currentDungeon?.dungeonId === dungeon.id;
      const canAfford = run ? run.resources.gold >= dungeon.goldCost : false;
      const inDungeon = !!run?.currentDungeon;

      const isBoss = dungeon.tags.includes("boss");
      const cardBg = isActive ? 0x2a1a1a : isUnlocked ? 0x1a1a2e : 0x111111;
      this.add.rectangle(LAYOUT.width / 2, y + 48, LAYOUT.cardWidth, 96, cardBg, 0.95);

      const nameColor = isBoss
        ? COLORS.legendary
        : isUnlocked
        ? COLORS.textPrimary
        : COLORS.locked;

      this.add.text(P + 8, y + 8, isUnlocked ? dungeon.name : "???", {
        fontFamily: FONTS.body,
        fontSize: "15px",
        color: nameColor,
      });

      if (isBoss && isUnlocked) {
        this.add.text(P + 8, y + 8 + 18, "[BOSS]", {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.legendary,
        });
      }

      if (isUnlocked) {
        this.add.text(P + 8, y + 30, dungeon.flavorText ?? "", {
          fontFamily: FONTS.flavor,
          fontSize: "11px",
          color: COLORS.textMuted,
          fontStyle: "italic",
          wordWrap: { width: LAYOUT.cardWidth - 90 },
        });

        this.add.text(P + 8, y + 66, `Cost: ${dungeon.goldCost}g  Duration: ${dungeon.durationSec}s  Wear: ${dungeon.vitalityWear}`, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.textSecondary,
        });

        // Success chance indicator
        if (run) {
          const score = computeDungeonScore(run, dungeon.tags);
          const outcome = resolveDungeonOutcome(score, dungeon.difficulty);
          const outcomeColor =
            outcome === "success"
              ? COLORS.vitalityHigh
              : outcome === "partial"
              ? COLORS.vitalityMid
              : COLORS.vitalityLow;
          this.add.text(LAYOUT.width - P - 8, y + 50, outcome.toUpperCase(), {
            fontFamily: FONTS.body,
            fontSize: "11px",
            color: outcomeColor,
          }).setOrigin(1, 0.5);
        }

        if (isActive) {
          const remaining = Math.max(
            0,
            run!.currentDungeon!.completesAtUnixSec - this.nowUnixSec
          );
          this.add.text(LAYOUT.width - P - 8, y + 8, `⏱ ${remaining}s`, {
            fontFamily: FONTS.body,
            fontSize: "13px",
            color: COLORS.accent,
          }).setOrigin(1, 0);
        } else if (run?.alive && !inDungeon) {
          const btnColor = canAfford ? COLORS.accent : COLORS.btnDisabledText;
          const btn = this.add
            .text(LAYOUT.width - P - 8, y + 8, "[ Enter ]", {
              fontFamily: FONTS.body,
              fontSize: "13px",
              color: btnColor,
            })
            .setOrigin(1, 0);

          if (canAfford) {
            btn.setInteractive({ useHandCursor: true });
            btn.on("pointerup", () => {
              this.dispatch({
                type: "START_DUNGEON",
                dungeonId: dungeon.id,
                nowUnixSec: this.nowUnixSec,
              });
              this.refresh();
            });
          }
        }
      } else {
        const req = dungeon.unlockRequirement;
        const reqText = req?.legacyAsh ? `Requires ${req.legacyAsh} Ash` : "Locked";
        this.add.text(P + 8, y + 30, reqText, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.locked,
        });

        // Unlock button if affordable
        if (req?.legacyAsh && meta.legacyAsh >= req.legacyAsh) {
          const unlockBtn = this.add
            .text(LAYOUT.width - P - 8, y + 8, "[ Unlock ]", {
              fontFamily: FONTS.body,
              fontSize: "13px",
              color: COLORS.accent,
            })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true });

          unlockBtn.on("pointerup", () => {
            (this.game as any).unlockDungeon(dungeon.id);
            this.refresh();
          });
        }
      }

      y += 106;
      if (y > CONTENT_BOTTOM - 106) break; // basic overflow guard
    }
  }
}

const CONTENT_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 8;
