import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";

const P = LAYOUT.padding;
const CONTENT_TOP = LAYOUT.hudHeight + 8;
const CONTENT_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 8;

export class SubCharactersScene extends BaseScene {
  constructor() {
    super({ key: "SubCharactersScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, CONTENT_TOP, "SUB-CHARACTERS", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const subs = this.saveFile.subCharacters;
    let y = CONTENT_TOP + 40;

    // Display each sub-character slot
    for (let i = 0; i < 5; i++) {
      const sub = subs[i];

      if (!sub) {
        // Show "Create Sub" only for the first empty slot
        if (i === subs.length) {
          const btn = this.add
            .text(LAYOUT.width / 2, y, "[ Create Sub ]", {
              fontFamily: FONTS.body,
              fontSize: "13px",
              color: COLORS.accent,
            })
            .setOrigin(0.5, 0)
            .setInteractive({ useHandCursor: true });

          btn.on("pointerup", () => {
            // Dispatch create with a default name
            const name = `Character ${i + 1}`;
            this.dispatch({
              type: "CREATE_SUBCHARACTER",
              name,
              nowUnixSec: this.nowUnixSec,
            });
            this.refresh();
          });
        }
      } else {
        // Occupied slot
        const pathStr = sub.path ? sub.path.charAt(0).toUpperCase() + sub.path.slice(1) : "—";
        const runsStr = `${sub.stats.totalRunsCompleted} runs`;
        const ashStr = `${Math.floor(sub.meta.legacyAsh)} ash`;

        this.add.rectangle(LAYOUT.width / 2, y + 26, LAYOUT.cardWidth, 52, 0x1a1a2e, 0.95);

        this.add.text(P + 8, y, `${sub.name}`, {
          fontFamily: FONTS.body,
          fontSize: "14px",
          color: COLORS.textPrimary,
        });

        this.add.text(P + 8, y + 18, `Path: ${pathStr}  |  ${runsStr}  |  ${ashStr}`, {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.textSecondary,
        });

        // Automation toggle
        const autoColor = sub.automationConfig.enabled ? COLORS.vitalityHigh : COLORS.textMuted;
        const autoBtn = this.add
          .text(LAYOUT.width - P - 8, y, `[AUTO ${sub.automationConfig.enabled ? "ON" : "OFF"}]`, {
            fontFamily: FONTS.body,
            fontSize: "11px",
            color: autoColor,
          })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true });

        autoBtn.on("pointerup", () => {
          this.dispatch({
            type: "TOGGLE_SUBCHARACTER_AUTOMATION",
            subCharId: sub.id,
            enabled: !sub.automationConfig.enabled,
            nowUnixSec: this.nowUnixSec,
          });
          this.refresh();
        });
      }

      y += 70;
      if (y > CONTENT_BOTTOM - 60) break; // Don't overflow
    }

    // Page info at bottom
    this.add.text(LAYOUT.width / 2, CONTENT_BOTTOM - 10, `${subs.length} / 5 sub-characters`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textMuted,
    }).setOrigin(0.5, 1);
  }
}
