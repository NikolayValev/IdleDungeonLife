import type { Modifier, StatKey } from "../../core/types";
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { ITEMS, type ItemDef } from "../../content/items";
import { TRAITS, type TraitRevealRule } from "../../content/traits";
import { FUTURE_CODEX_ENTRIES } from "../../content/codex";

type CodexSection = "traits" | "items";
type DiscoveryFilter = "known" | "unknown" | "all";
type TraitFacet = "any" | "holy" | "unholy" | "relic" | "fate" | "abyss";
type ItemFacet = "any" | "weapon" | "armor" | "artifact" | "common" | "rare" | "legendary";

const P = LAYOUT.padding;
const CONTENT_TOP = LAYOUT.hudHeight + 8;
const CONTENT_BOTTOM = LAYOUT.height - LAYOUT.tabBarHeight - 8;
const ENTRIES_PER_PAGE = 3;

let selectedSection: CodexSection = "traits";
let discoveryFilter: DiscoveryFilter = "known";
let traitFacet: TraitFacet = "any";
let itemFacet: ItemFacet = "any";
let currentPage = 0;

interface CodexEntryBase {
  id: string;
  known: boolean;
}

interface TraitEntryView extends CodexEntryBase {
  type: "trait";
  name: string;
  tags: string[];
  description: string;
  flavorText: string;
  hint: string;
  source?: string;
  evolved: boolean;
  evolutionHint: string | null;
}

interface ItemEntryView extends CodexEntryBase {
  type: "item";
  name: string;
  rarity: ItemDef["rarity"];
  slot: ItemDef["slot"];
  tags: string[];
  flavorText: string;
  modifiers: string[];
  hint: string;
  source?: string;
}

function formatTags(tags: string[]): string {
  return tags.map((tag) => `[${tag}]`).join(" ");
}

function statLabel(stat: StatKey): string {
  switch (stat) {
    case "power": return "Power";
    case "survivability": return "Survivability";
    case "goldRate": return "Gold Rate";
    case "essenceRate": return "Essence Rate";
    case "legendaryDropRate": return "Legendary Rate";
    case "holyAffinity": return "Holy Affinity";
    case "unholyAffinity": return "Unholy Affinity";
    case "vitalityDecayRate": return "Vitality Decay";
    case "dungeonSuccessRate": return "Dungeon Success";
    case "itemFindRate": return "Item Find";
    case "bossWearMultiplier": return "Boss Wear";
    case "dungeonWearMultiplier": return "Dungeon Wear";
    case "alignmentDriftHoly": return "Holy Drift";
    case "alignmentDriftUnholy": return "Unholy Drift";
    case "talentCostMultiplier": return "Talent Cost";
    case "jobOutputMultiplier": return "Job Output";
    case "discoveryRate": return "Discovery";
  }
}

function formatModifier(modifier: Modifier): string {
  const value =
    modifier.op === "mul"
      ? `x${modifier.value.toFixed(2)}`
      : `${modifier.value > 0 ? "+" : ""}${modifier.value}`;
  return `${statLabel(modifier.stat)} ${value}`;
}

function rarityColor(rarity: ItemDef["rarity"]): string {
  switch (rarity) {
    case "legendary": return COLORS.legendary;
    case "rare": return COLORS.rare;
    case "common": return COLORS.common;
  }
}

function labelForDiscoveryFilter(filter: DiscoveryFilter): string {
  switch (filter) {
    case "known": return "[ Known ]";
    case "unknown": return "[ Unknown ]";
    case "all": return "[ All ]";
  }
}

function buildEvolutionHint(rule: TraitRevealRule): string {
  switch (rule.triggerEvent) {
    case "dungeonCompleted":
      return rule.dungeonTag
        ? `Evolves: complete a ${rule.dungeonTag} dungeon.`
        : "Evolves: complete a dungeon tied to this memory.";
    case "alignmentThreshold":
      if ((rule.value ?? 0) < 0) {
        return `Evolves: drift unholy to ${rule.value}.`;
      }
      return `Evolves: drift holy to ${rule.value}.`;
    case "ageReached":
      return `Evolves: survive to ${rule.value}s of age.`;
  }
}

function buildTraitHint(rule?: TraitRevealRule): string {
  if (!rule) {
    return "Survive a run to archive what remains obscured.";
  }

  switch (rule.triggerEvent) {
    case "dungeonCompleted":
      return rule.dungeonTag
        ? `Reveal omen: complete a ${rule.dungeonTag} dungeon.`
        : "Reveal omen: complete a dungeon tied to this memory.";
    case "alignmentThreshold":
      if ((rule.value ?? 0) < 0) {
        return `Reveal omen: drift unholy to ${rule.value}.`;
      }
      return `Reveal omen: drift holy to ${rule.value}.`;
    case "ageReached":
      return `Reveal omen: survive to ${rule.value}s of age.`;
  }
}

function sourceHintForTags(tags: string[]): string {
  const sourceParts: string[] = [];

  if (tags.includes("holy") || tags.includes("shrine")) {
    sourceParts.push("holy or shrine delves");
  }
  if (tags.includes("unholy") || tags.includes("abyss") || tags.includes("decay")) {
    sourceParts.push("unholy, decay, or abyss delves");
  }
  if (tags.includes("knowledge") || tags.includes("relic")) {
    sourceParts.push("archive or relic delves");
  }
  if (tags.includes("wealth")) {
    sourceParts.push("wealth-marked vaults");
  }
  if (tags.includes("fate")) {
    sourceParts.push("strong alignment swings");
  }
  if (tags.includes("vitality")) {
    sourceParts.push("late-life or vitality-heavy runs");
  }
  if (tags.includes("boss")) {
    sourceParts.push("boss remains");
  }

  return sourceParts.length > 0
    ? `Source: ${sourceParts.join(", ")}.`
    : "Source: common delves and long survival.";
}

function buildItemHint(item: ItemDef): string {
  const source = sourceHintForTags(item.tags);
  if (item.rarity === "legendary") {
    return `${source} Legendary items favor difficult delves and matching alignment.`;
  }
  if (item.rarity === "rare") {
    return `${source} Rare gear becomes more common once you move past the chapel.`;
  }
  return `${source} Common gear can surface in even the shallowest delves.`;
}

function traitCardColor(entry: TraitEntryView): number {
  return entry.known ? 0x141428 : 0x101018;
}

function itemCardColor(entry: ItemEntryView): number {
  return entry.known ? 0x141428 : 0x101018;
}

function compareEntries(left: CodexEntryBase & { name: string }, right: CodexEntryBase & { name: string }): number {
  if (left.known !== right.known) {
    return left.known ? -1 : 1;
  }

  const leftFuture = left.id.startsWith("future_");
  const rightFuture = right.id.startsWith("future_");
  if (leftFuture !== rightFuture) {
    return leftFuture ? 1 : -1;
  }

  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) {
    return byName;
  }

  return left.id.localeCompare(right.id);
}

function matchesDiscoveryFilter(known: boolean): boolean {
  switch (discoveryFilter) {
    case "known": return known;
    case "unknown": return !known;
    case "all": return true;
  }
}

function matchesTraitFacet(entry: TraitEntryView): boolean {
  return traitFacet === "any" || entry.tags.includes(traitFacet);
}

function matchesItemFacet(entry: ItemEntryView): boolean {
  switch (itemFacet) {
    case "any": return true;
    case "weapon":
    case "armor":
    case "artifact":
      return entry.slot === itemFacet;
    case "common":
    case "rare":
    case "legendary":
      return entry.rarity === itemFacet;
  }
}

export class CodexScene extends BaseScene {
  constructor() {
    super({ key: "CodexScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    const knownTraitIds = new Set([
      ...this.saveFile.meta.discoveredTraitIds,
      ...(this.saveFile.currentRun?.visibleTraitIds ?? []),
    ]);
    const knownItemIds = new Set([
      ...this.saveFile.meta.discoveredItemIds,
      ...(this.saveFile.currentRun?.inventory.items.map((item) => item.itemId) ?? []),
    ]);
    const evolvedTraitIds = new Set(this.saveFile.currentRun?.evolvedTraitIds ?? []);

    const traitEntries = TRAITS
      .map((trait): TraitEntryView => {
        const known = knownTraitIds.has(trait.id);
        const evolved = evolvedTraitIds.has(trait.id);
        const evolutionHint = known && trait.evolutionRules?.[0]
          ? buildEvolutionHint(trait.evolutionRules[0])
          : null;
        return {
          type: "trait",
          id: trait.id,
          known,
          evolved,
          evolutionHint,
          name: known ? (evolved && trait.evolutionName ? trait.evolutionName : trait.name) : "Unknown Trait",
          tags: trait.tags,
          description: known
            ? (evolved && trait.evolutionDescription ? trait.evolutionDescription : trait.description)
            : trait.revealMode === "hidden"
            ? "Completely sealed. Only an omen remains."
            : "Something about this trait is already leaking through.",
          flavorText: known
            ? (evolved && trait.evolutionFlavorText ? trait.evolutionFlavorText : trait.flavorText)
            : buildTraitHint(trait.revealRules?.[0]),
          hint: buildTraitHint(trait.revealRules?.[0]),
          source: sourceHintForTags(trait.tags),
        };
      })
      .filter((entry) => matchesDiscoveryFilter(entry.known))
      .filter(matchesTraitFacet)
      .concat(
        discoveryFilter === "known"
          ? []
          : FUTURE_CODEX_ENTRIES.filter((entry) => entry.section === "trait").map((entry) => ({
              type: "trait" as const,
              id: entry.id,
              known: false,
              evolved: false,
              evolutionHint: null,
              name: entry.name,
              tags: entry.tags,
              description: `Placeholder archive. ${entry.source}.`,
              flavorText: entry.hint,
              hint: entry.hint,
              source: `Source: ${entry.source}.`,
            }))
      )
      .sort(compareEntries);

    const itemEntries = ITEMS
      .map((item): ItemEntryView => {
        const known = knownItemIds.has(item.id);
        return {
          type: "item",
          id: item.id,
          known,
          name: known ? item.name : `Unknown ${capitalize(item.slot)}`,
          rarity: item.rarity,
          slot: item.slot,
          tags: item.tags,
          flavorText: known ? item.flavorText ?? "" : buildItemHint(item),
          modifiers: known
            ? item.baseModifiers.map(formatModifier)
            : ["Properties remain unidentified."],
          hint: buildItemHint(item),
          source: sourceHintForTags(item.tags),
        };
      })
      .filter((entry) => matchesDiscoveryFilter(entry.known))
      .filter(matchesItemFacet)
      .concat(
        discoveryFilter === "known"
          ? []
          : FUTURE_CODEX_ENTRIES.filter((entry) => entry.section === "item").map((entry) => ({
              type: "item" as const,
              id: entry.id,
              known: false,
              name: entry.name,
              rarity: "legendary" as const,
              slot: "artifact" as const,
              tags: entry.tags,
              flavorText: entry.hint,
              modifiers: ["Future archive pattern."],
              hint: `${entry.hint} Source: ${entry.source}.`,
              source: `Source: ${entry.source}.`,
            }))
      )
      .sort(compareEntries);

    this.drawHeader(knownTraitIds.size, knownItemIds.size);
    this.drawSectionTabs();
    this.drawDiscoveryFilters();
    this.drawFacetFilters();

    const activeEntries = selectedSection === "traits" ? traitEntries : itemEntries;
    const totalPages = Math.max(1, Math.ceil(activeEntries.length / ENTRIES_PER_PAGE));
    currentPage = Math.min(currentPage, totalPages - 1);

    if (activeEntries.length === 0) {
      this.drawEmptyState(selectedSection === "traits");
    } else if (selectedSection === "traits") {
      this.drawTraitEntries(
        traitEntries.slice(currentPage * ENTRIES_PER_PAGE, (currentPage + 1) * ENTRIES_PER_PAGE)
      );
    } else {
      this.drawItemEntries(
        itemEntries.slice(currentPage * ENTRIES_PER_PAGE, (currentPage + 1) * ENTRIES_PER_PAGE)
      );
    }

    this.drawPager(totalPages);
  }

  private drawHeader(knownTraits: number, knownItems: number): void {
    this.add.text(P, CONTENT_TOP, "CODEX", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    this.add.text(P, CONTENT_TOP + 26, `Traits: ${knownTraits}/${TRAITS.length}`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textSecondary,
    });
    this.add.text(P + 118, CONTENT_TOP + 26, `Items: ${knownItems}/${ITEMS.length}`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textSecondary,
    });
    this.add.text(P + 222, CONTENT_TOP + 26, `Archive: ${this.saveFile.meta.codexEntries.length}`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textSecondary,
    });
    this.add.text(P + 312, CONTENT_TOP + 26, `Signals: ${FUTURE_CODEX_ENTRIES.length}`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textMuted,
    });
  }

  private drawSectionTabs(): void {
    const y = CONTENT_TOP + 56;
    this.drawButton(P, y, "[ Traits ]", selectedSection === "traits", () => {
      if (selectedSection === "traits") return;
      selectedSection = "traits";
      currentPage = 0;
      this.refresh();
    });
    this.drawButton(P + 122, y, "[ Items ]", selectedSection === "items", () => {
      if (selectedSection === "items") return;
      selectedSection = "items";
      currentPage = 0;
      this.refresh();
    });
  }

  private drawDiscoveryFilters(): void {
    const y = CONTENT_TOP + 84;
    const filters: DiscoveryFilter[] = ["known", "unknown", "all"];

    filters.forEach((filter, index) => {
      this.drawButton(P + index * 104, y, labelForDiscoveryFilter(filter), discoveryFilter === filter, () => {
        if (discoveryFilter === filter) return;
        discoveryFilter = filter;
        currentPage = 0;
        this.refresh();
      });
    });
  }

  private drawFacetFilters(): void {
    const y = CONTENT_TOP + 112;
    const traits: TraitFacet[] = ["any", "holy", "unholy", "relic", "fate", "abyss"];
    const items: ItemFacet[] = ["any", "weapon", "armor", "artifact", "rare", "legendary"];

    if (selectedSection === "traits") {
      traits.forEach((facet, index) => {
        this.drawButton(P + index * 60, y, `[${capitalize(facet)}]`, traitFacet === facet, () => {
          if (traitFacet === facet) return;
          traitFacet = facet;
          currentPage = 0;
          this.refresh();
        }, "11px");
      });
    } else {
      items.forEach((facet, index) => {
        this.drawButton(P + index * 60, y, `[${capitalize(facet)}]`, itemFacet === facet, () => {
          if (itemFacet === facet) return;
          itemFacet = facet;
          currentPage = 0;
          this.refresh();
        }, "11px");
      });
    }
  }

  private drawButton(
    x: number,
    y: number,
    label: string,
    active: boolean,
    onClick: () => void,
    fontSize = "13px"
  ): void {
    const button = this.add.text(x, y, label, {
      fontFamily: FONTS.body,
      fontSize,
      color: active ? COLORS.accent : COLORS.textSecondary,
    }).setInteractive({ useHandCursor: true });
    button.on("pointerup", onClick);
  }

  private drawEmptyState(isTraitSection: boolean): void {
    const noun = isTraitSection ? "traits" : "items";
    const hint = isTraitSection
      ? "Try switching to [ Unknown ] or a different omen tag."
      : "Try switching to [ Unknown ] or a different slot or rarity filter.";

    this.add.text(P, CONTENT_TOP + 156, `No ${noun} match the current filters.`, {
      fontFamily: FONTS.body,
      fontSize: "15px",
      color: COLORS.textPrimary,
    });
    this.add.text(P, CONTENT_TOP + 184, hint, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textMuted,
      wordWrap: { width: LAYOUT.cardWidth },
    });
  }

  private drawTraitEntries(entries: TraitEntryView[]): void {
    let y = CONTENT_TOP + 150;

    for (const entry of entries) {
      this.add.rectangle(LAYOUT.width / 2, y + 82, LAYOUT.cardWidth, 156, traitCardColor(entry), 0.95);
      const nameLabel = entry.evolved ? `${entry.name}  [evolved]` : entry.name;
      const nameColor = entry.known ? (entry.evolved ? COLORS.accentHoly : COLORS.accent) : COLORS.textMuted;
      this.add.text(P + 8, y + 10, nameLabel, {
        fontFamily: FONTS.body,
        fontSize: "15px",
        color: nameColor,
      });
      this.add.text(P + 8, y + 32, entry.known ? formatTags(entry.tags) : "[sealed memory]", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textSecondary,
      });
      this.add.text(P + 8, y + 54, entry.description, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textPrimary,
        wordWrap: { width: LAYOUT.cardWidth - 16 },
      });
      this.add.text(P + 8, y + 108, entry.known ? entry.flavorText : entry.hint, {
        fontFamily: FONTS.flavor,
        fontSize: "11px",
        color: COLORS.textMuted,
        fontStyle: "italic",
        wordWrap: { width: LAYOUT.cardWidth - 16 },
      });
      if (!entry.known && entry.source) {
        this.add.text(P + 8, y + 132, entry.source, {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.textSecondary,
          wordWrap: { width: LAYOUT.cardWidth - 16 },
        });
      }
      if (entry.known && !entry.evolved && entry.evolutionHint) {
        this.add.text(P + 8, y + 132, entry.evolutionHint, {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.accent,
          wordWrap: { width: LAYOUT.cardWidth - 16 },
        });
      }
      y += 168;
    }
  }

  private drawItemEntries(entries: ItemEntryView[]): void {
    let y = CONTENT_TOP + 150;

    for (const entry of entries) {
      this.add.rectangle(LAYOUT.width / 2, y + 82, LAYOUT.cardWidth, 156, itemCardColor(entry), 0.95);
      this.add.text(P + 8, y + 10, entry.name, {
        fontFamily: FONTS.body,
        fontSize: "15px",
        color: entry.known ? rarityColor(entry.rarity) : COLORS.textMuted,
      });
      this.add.text(LAYOUT.width - P - 8, y + 10, `[${entry.slot}] [${entry.rarity}]`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textSecondary,
      }).setOrigin(1, 0);
      this.add.text(P + 8, y + 32, entry.known ? formatTags(entry.tags) : "[unidentified gear]", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textSecondary,
      });
      this.add.text(P + 8, y + 54, entry.known ? entry.flavorText : entry.hint, {
        fontFamily: FONTS.flavor,
        fontSize: "11px",
        color: COLORS.textMuted,
        fontStyle: "italic",
        wordWrap: { width: LAYOUT.cardWidth - 16 },
      });
      this.add.text(P + 8, y + 98, entry.modifiers.join("  |  "), {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textPrimary,
        wordWrap: { width: LAYOUT.cardWidth - 16 },
      });
      if (!entry.known && entry.source) {
        this.add.text(P + 8, y + 126, entry.source, {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: COLORS.textSecondary,
          wordWrap: { width: LAYOUT.cardWidth - 16 },
        });
      }
      y += 168;
    }
  }

  private drawPager(totalPages: number): void {
    if (totalPages <= 1) return;

    const y = CONTENT_BOTTOM - 20;

    if (currentPage > 0) {
      this.drawButton(P, y, "[ Prev ]", false, () => {
        currentPage -= 1;
        this.refresh();
      }, "12px");
    }

    this.add.text(LAYOUT.width / 2, y, `Page ${currentPage + 1}/${totalPages}`, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      color: COLORS.textSecondary,
    }).setOrigin(0.5, 0);

    if (currentPage < totalPages - 1) {
      const next = this.add.text(LAYOUT.width - P, y, "[ Next ]", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.accent,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      next.on("pointerup", () => {
        currentPage += 1;
        this.refresh();
      });
    }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
