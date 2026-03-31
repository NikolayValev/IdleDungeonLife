import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { computeLegacyAshBreakdown } from "../../core/scoring";
import { TRAIT_REGISTRY } from "../../content/traits";
import { ITEM_REGISTRY } from "../../content/items";
import { DUNGEONS, type DungeonDef } from "../../content/dungeons";
import { JOBS, type JobDef } from "../../content/jobs";
import type { UnlockRequirement } from "../../core/types";

const P = LAYOUT.padding;
const CONTENT_WIDTH = LAYOUT.cardWidth;

type UnlockPreview = {
  kind: "Job" | "Dungeon";
  name: string;
  cost: number;
};

function legacyAshCost(requirement?: UnlockRequirement): number | null {
  return requirement?.legacyAsh ?? null;
}

function buildUnlockPreviews(
  entries: Array<{ name: string; unlockRequirement?: UnlockRequirement }>,
  kind: UnlockPreview["kind"],
  unlockedIds: string[],
  keyFor: (entry: { name: string; unlockRequirement?: UnlockRequirement }) => string
): UnlockPreview[] {
  return entries
    .filter((entry) => !unlockedIds.includes(keyFor(entry)))
    .map((entry) => {
      const cost = legacyAshCost(entry.unlockRequirement);
      return cost == null
        ? null
        : {
            kind,
            name: entry.name,
            cost,
          };
    })
    .filter((entry): entry is UnlockPreview => !!entry)
    .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name));
}

function drawSectionTitle(scene: BaseScene, y: number, title: string, color: string): number {
  scene.add.text(P, y, title, {
    fontFamily: FONTS.body,
    fontSize: "14px",
    color,
  });
  return y + 18;
}

function drawSectionLines(
  scene: BaseScene,
  startY: number,
  lines: Array<{ text: string; color?: string; fontStyle?: string }>
): number {
  let y = startY;
  for (const line of lines) {
    scene.add.text(P + 8, y, line.text, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: line.color ?? COLORS.textPrimary,
      fontStyle: line.fontStyle,
      wordWrap: { width: CONTENT_WIDTH - 16 },
    });
    y += 16;
  }
  return y + 6;
}

function dungeonNameForDepth(depth: number): string {
  return DUNGEONS.find((dungeon) => dungeon.depthIndex === depth)?.name ?? `Depth ${depth}`;
}

function takePreview<T>(items: T[], limit = 4): T[] {
  return items.slice(0, limit);
}

export class DeathScene extends BaseScene {
  constructor() {
    super({ key: "DeathScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    const run = this.saveFile.currentRun;
    const meta = this.saveFile.meta;

    let y = LAYOUT.hudHeight + 16;

    this.add.text(LAYOUT.width / 2, y, "END OF RUN", {
      fontFamily: FONTS.heading,
      fontSize: "22px",
      color: COLORS.vitalityLow,
    }).setOrigin(0.5, 0);
    y += 34;

    if (!run) {
      this.add.text(LAYOUT.width / 2, y, "No run data.", {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: COLORS.textMuted,
      }).setOrigin(0.5, 0);
      y += 32;
    } else {
      const ash = computeLegacyAshBreakdown(run);
      const totalAshAfterClaim = meta.legacyAsh + ash.total;
      const ageMin = Math.floor(run.lifespan.ageSeconds / 60);
      const ageSec = Math.floor(run.lifespan.ageSeconds % 60);
      const depth = run.deepestDungeonIndex;

      const newTraitIds = [...new Set(
        [...run.visibleTraitIds, ...run.hiddenTraitIds].filter(
          (traitId) => !meta.discoveredTraitIds.includes(traitId)
        )
      )];
      const newItemIds = [...new Set(
        run.inventory.items
          .map((item) => item.itemId)
          .filter((itemId) => !meta.discoveredItemIds.includes(itemId))
      )];

      const lockableJobs = buildUnlockPreviews(
        JOBS,
        "Job",
        meta.unlockedJobIds,
        (job) => (job as JobDef).id
      );
      const lockableDungeons = buildUnlockPreviews(
        DUNGEONS,
        "Dungeon",
        meta.unlockedDungeonIds,
        (dungeon) => (dungeon as DungeonDef).id
      );
      const lockedEntries = [...lockableJobs, ...lockableDungeons].sort(
        (left, right) => left.cost - right.cost || left.name.localeCompare(right.name)
      );
      const newlyAffordable = lockedEntries.filter(
        (entry) => entry.cost > meta.legacyAsh && entry.cost <= totalAshAfterClaim
      );
      const nextTargets = lockedEntries.filter((entry) => entry.cost > totalAshAfterClaim);

      y = drawSectionLines(this, y, [
        { text: `Survived: ${ageMin}m ${ageSec}s` },
        {
          text: `Deepest dungeon: ${
            depth >= 0 ? dungeonNameForDepth(depth) : "None"
          }`,
          color: COLORS.textSecondary,
        },
        {
          text: `Dungeons completed: ${run.totalDungeonsCompleted}`,
          color: COLORS.textSecondary,
        },
        {
          text: `Bosses defeated: ${run.bossesCleared.length}`,
          color: run.bossesCleared.length > 0 ? COLORS.legendary : COLORS.textSecondary,
        },
      ]);

      y = drawSectionTitle(this, y, `Legacy Ash earned: +${ash.total}`, COLORS.accent);
      y = drawSectionLines(this, y, [
        { text: `Depth bonus: +${ash.depthBonus}`, color: COLORS.textSecondary },
        { text: `Age bonus: +${ash.ageBonus}`, color: COLORS.textSecondary },
        { text: `Boss bonus: +${ash.bossBonus}`, color: COLORS.textSecondary },
        { text: `Dungeon clears: +${ash.dungeonBonus}`, color: COLORS.textSecondary },
        { text: `Total Legacy Ash after claim: ${totalAshAfterClaim}`, color: COLORS.textPrimary },
      ]);

      if (newTraitIds.length > 0 || newItemIds.length > 0) {
        const codexLines = [
          ...takePreview(newTraitIds).map((traitId) => ({
            text: `Trait: ${TRAIT_REGISTRY.get(traitId)?.name ?? traitId}`,
          })),
          ...takePreview(newItemIds).map((itemId) => ({
            text: `Item: ${ITEM_REGISTRY.get(itemId)?.name ?? itemId}`,
          })),
        ];
        y = drawSectionTitle(
          this,
          y,
          `New Codex Entries: +${newTraitIds.length + newItemIds.length}`,
          COLORS.accentHoly
        );
        y = drawSectionLines(this, y, codexLines);
      }

      if (newlyAffordable.length > 0) {
        y = drawSectionTitle(this, y, "Affordable After Claim", COLORS.vitalityHigh);
        y = drawSectionLines(
          this,
          y,
          takePreview(newlyAffordable).map((entry) => ({
            text: `${entry.kind}: ${entry.name} (${entry.cost} Ash)`,
          }))
        );
      }

      if (nextTargets.length > 0) {
        y = drawSectionTitle(this, y, "Next Unlock Targets", COLORS.textSecondary);
        y = drawSectionLines(
          this,
          y,
          takePreview(nextTargets).map((entry) => ({
            text: `${entry.kind}: ${entry.name} (${entry.cost} Ash)`,
            color: COLORS.textMuted,
          }))
        );
      }

      if (y > LAYOUT.height - LAYOUT.tabBarHeight - 84) {
        y = LAYOUT.height - LAYOUT.tabBarHeight - 84;
      }
    }

    const newRunBtn = this.add
      .text(LAYOUT.width / 2, y, "[ Begin New Run ]", {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    newRunBtn.on("pointerover", () => newRunBtn.setColor(COLORS.vitalityHigh));
    newRunBtn.on("pointerout", () => newRunBtn.setColor(COLORS.accent));
    newRunBtn.on("pointerup", () => {
      this.dispatch({ type: "CLAIM_DEATH", nowUnixSec: this.nowUnixSec });
      this.dispatch({
        type: "START_NEW_RUN",
        nowUnixSec: this.nowUnixSec,
      });
      this.showTab("MainScene");
    });
  }
}
