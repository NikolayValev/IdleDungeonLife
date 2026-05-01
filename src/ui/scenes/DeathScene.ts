import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { computeLegacyAshBreakdown } from "../../core/scoring";
import { TRAIT_REGISTRY } from "../../content/traits";
import { ITEM_REGISTRY } from "../../content/items";
import { DUNGEONS, type DungeonDef } from "../../content/dungeons";
import { JOBS, type JobDef } from "../../content/jobs";
import type { UnlockRequirement } from "../../core/types";
import { LEGACY_PERKS, canPurchasePerk } from "../../content/legacyPerks";

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

            // Evolutions achieved this run
            const evolutionCount = run.evolvedTraitIds.length;
            if (evolutionCount > 0) {
              y = drawSectionTitle(this, y, `Evolutions achieved: ${evolutionCount}`, COLORS.accentHoly);
              y = drawSectionLines(
                this,
                y,
                run.evolvedTraitIds.map((tid) => {
                  const def = TRAIT_REGISTRY.get(tid);
                  return {
                    text: `  ${def?.evolutionName ?? def?.name ?? tid}`,
                    color: COLORS.accent,
                  };
                })
              );
            }

            // Legacy path selection or perk purchases
            const pathAfterClaim = meta.legacyPath ?? null;
            if (!pathAfterClaim && totalAshAfterClaim >= 5) {
              y = drawSectionTitle(this, y, "Choose Your Legacy Path", COLORS.accent);
              y = drawSectionLines(this, y, [
                { text: "Your lineage must choose a road. This cannot be undone.", color: COLORS.textMuted },
              ]);
              for (const path of ["holy", "abyss", "knowledge"] as const) {
                const btn = this.add
                  .text(P + 8, y, `[ Path of ${path.charAt(0).toUpperCase() + path.slice(1)} ]`, {
                    fontFamily: FONTS.body,
                    fontSize: "13px",
                    color: COLORS.textSecondary,
                  })
                  .setInteractive({ useHandCursor: true });
                btn.on("pointerover", () => btn.setColor(COLORS.accent));
                btn.on("pointerout", () => btn.setColor(COLORS.textSecondary));
                btn.on("pointerup", () => {
                  this.dispatch({ type: "CLAIM_DEATH", nowUnixSec: this.nowUnixSec });
                  this.dispatch({ type: "CHOOSE_LEGACY_PATH", path });
                  this.refresh();
                });
                y += 22;
              }
            } else if (pathAfterClaim) {
              const availablePerks = LEGACY_PERKS.filter((perk) =>
                canPurchasePerk(perk.id, pathAfterClaim, meta.legacyPerks ?? [], totalAshAfterClaim)
              ).slice(0, 3);
              if (availablePerks.length > 0) {
                y = drawSectionTitle(this, y, `Legacy Perks (${pathAfterClaim})`, COLORS.accent);
                for (const perk of availablePerks) {
                  const btn = this.add
                    .text(P + 8, y, `[ ${perk.name} - ${perk.costAsh} Ash ]`, {
                      fontFamily: FONTS.body,
                      fontSize: "12px",
                      color: COLORS.textSecondary,
                    })
                    .setInteractive({ useHandCursor: true });
                  btn.on("pointerover", () => btn.setColor(COLORS.accent));
                  btn.on("pointerout", () => btn.setColor(COLORS.textSecondary));
                  btn.on("pointerup", () => {
                    this.dispatch({ type: "CLAIM_DEATH", nowUnixSec: this.nowUnixSec });
                    this.dispatch({ type: "PURCHASE_LEGACY_PERK", perkId: perk.id });
                    this.refresh();
                  });
                  y += 18;
                  this.add.text(P + 16, y, perk.description, {
                    fontFamily: FONTS.body,
                    fontSize: "11px",
                    color: COLORS.textMuted,
                    wordWrap: { width: CONTENT_WIDTH - 24 },
                  });
                  y += 20;
                }
              }
            }

            if (y > LAYOUT.height - LAYOUT.tabBarHeight - 84) {
              y = LAYOUT.height - LAYOUT.tabBarHeight - 84;
            }
      }
    }

    // ─── Save Export/Import Buttons ────────────────────────────────────────────
    let buttonY = y;
    const exportBtn = this.add
      .text(P, buttonY, "[ Export Save ]", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      })
      .setInteractive({ useHandCursor: true });

    exportBtn.on("pointerover", () => exportBtn.setColor(COLORS.accent));
    exportBtn.on("pointerout", () => exportBtn.setColor(COLORS.textSecondary));
    exportBtn.on("pointerup", () => {
      const saveData = JSON.stringify(this.saveFile, null, 2);
      const blob = new Blob([saveData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `idle-dungeon-save-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });

    const importBtn = this.add
      .text(LAYOUT.width / 2 + 80, buttonY, "[ Import Save ]", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.textSecondary,
      })
      .setInteractive({ useHandCursor: true });

    importBtn.on("pointerover", () => importBtn.setColor(COLORS.accent));
    importBtn.on("pointerout", () => importBtn.setColor(COLORS.textSecondary));
    importBtn.on("pointerup", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const imported = JSON.parse(text);
            // Dispatch custom event or call reducer to load the imported save
            // For now, we'll use localStorage directly as a shortcut
            if (typeof imported === "object" && imported !== null) {
              localStorage.setItem("idleDungeonSave", JSON.stringify(imported));
              window.location.reload();
            }
          } catch {
            alert("Failed to import save. Invalid JSON format.");
          }
        };
        reader.readAsText(file);
      };
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });

    buttonY += 24;

    const newRunBtn = this.add
      .text(LAYOUT.width / 2, buttonY, "[ Begin New Run ]", {
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
