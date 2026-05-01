import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { JOBS } from "../../content/jobs";
import { computeStats } from "../../core/modifiers";

const P = LAYOUT.padding;

export class JobsScene extends BaseScene {
  constructor() {
    super({ key: "JobsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, LAYOUT.hudHeight + 8, "JOBS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const run = this.saveFile.currentRun;
    let y = LAYOUT.hudHeight + 40;

    for (const job of JOBS) {
      const isUnlocked = this.saveFile.meta.unlockedJobIds.includes(job.id);
      const isActive = run?.currentJobId === job.id;

      const cardBg = isActive ? 0x1a2a1a : isUnlocked ? 0x1a1a2e : 0x111111;
      this.add.rectangle(LAYOUT.width / 2, y + 42, LAYOUT.cardWidth, 84, cardBg, 0.95);

      const nameColor = isUnlocked ? COLORS.textPrimary : COLORS.locked;
      this.add.text(P + 8, y + 8, isUnlocked ? job.name : "???", {
        fontFamily: FONTS.body,
        fontSize: "15px",
        color: nameColor,
      });

      if (isUnlocked) {
        const stats = run ? computeStats(run) : null;
        const goldMultiplier =
          (stats?.jobOutputMultiplier ?? 1) * (stats?.goldRate ?? 1);
        const essenceMultiplier =
          (stats?.jobOutputMultiplier ?? 1) * (stats?.essenceRate ?? 1);
        const goldRate = (job.baseGoldPerSec * goldMultiplier).toFixed(2);
        const essRate = ((job.baseEssencePerSec ?? 0) * essenceMultiplier).toFixed(2);

        this.add.text(P + 8, y + 28, job.description, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.textMuted,
          wordWrap: { width: LAYOUT.cardWidth - 90 },
        });

        this.add.text(LAYOUT.width - P - 8, y + 8, `${goldRate}g/s`, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.accent,
        }).setOrigin(1, 0);

        if (Number(essRate) > 0) {
          this.add.text(LAYOUT.width - P - 8, y + 24, `${essRate}e/s`, {
            fontFamily: FONTS.body,
            fontSize: "12px",
            color: COLORS.accentHoly,
          }).setOrigin(1, 0);
        }

        if (!isActive && run?.alive) {
          const btn = this.add
            .text(LAYOUT.width - P - 8, y + 52, "[ Assign ]", {
              fontFamily: FONTS.body,
              fontSize: "13px",
              color: COLORS.accent,
            })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true });
          btn.on("pointerup", () => {
            this.dispatch({ type: "ASSIGN_JOB", jobId: job.id });
            this.refresh();
          });
        } else if (isActive) {
          this.add.text(LAYOUT.width - P - 8, y + 52, "[ Active ]", {
            fontFamily: FONTS.body,
            fontSize: "13px",
            color: COLORS.vitalityHigh,
          }).setOrigin(1, 0);
        }
      } else {
        const req = job.unlockRequirement;
        const reqText = req?.legacyAsh
          ? `Requires ${req.legacyAsh} Legacy Ash`
          : "Locked";
        this.add.text(P + 8, y + 28, reqText, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: COLORS.locked,
        });

        // Auto-unlock if affordable
        if (req?.legacyAsh && this.saveFile.meta.legacyAsh >= req.legacyAsh) {
          if (!this.saveFile.meta.unlockedJobIds.includes(job.id)) {
            // Unlock handled in reducer; show unlock button
            const unlockBtn = this.add
              .text(LAYOUT.width - P - 8, y + 52, "[ Unlock ]", {
                fontFamily: FONTS.body,
                fontSize: "13px",
                color: COLORS.accent,
              })
              .setOrigin(1, 0)
              .setInteractive({ useHandCursor: true });

            unlockBtn.on("pointerup", () => {
              // Direct meta mutation for unlock UI (driven by legacy ash)
              const meta = this.saveFile.meta;
              if (!meta.unlockedJobIds.includes(job.id)) {
                (this.game as any).unlockJob(job.id);
                this.refresh();
              }
            });
          }
        }
      }

      y += 94;
    }
  }
}
