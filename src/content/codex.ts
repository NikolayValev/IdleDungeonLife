import type { Tag } from "../core/types";

export interface FutureCodexEntry {
  id: string;
  section: "trait" | "item";
  name: string;
  tags: Tag[];
  hint: string;
  source: string;
}

export const FUTURE_CODEX_ENTRIES: FutureCodexEntry[] = [
  {
    id: "future_trait_reliquary_sing",
    section: "trait",
    name: "Future Trait Record",
    tags: ["holy", "relic", "knowledge"],
    source: "Archive reliquaries",
    hint: "Future omen: archive relic delves may uncover a saintly mnemonic strain.",
  },
  {
    id: "future_trait_hollow_patron",
    section: "trait",
    name: "Future Trait Record",
    tags: ["wealth", "fate", "unholy"],
    source: "Alignment omen",
    hint: "Future omen: heavily unholy wealth-aligned runs may attract a hidden patron.",
  },
  {
    id: "future_item_greenhouse_relic",
    section: "item",
    name: "Future Artifact Pattern",
    tags: ["vitality", "knowledge"],
    source: "Verdant delves",
    hint: "Future pattern: vitality-tag dungeons may yield a living archive device.",
  },
  {
    id: "future_item_boss_regalia",
    section: "item",
    name: "Future Armor Pattern",
    tags: ["boss", "holy", "abyss"],
    source: "Boss remains",
    hint: "Future pattern: late boss delves may expose contested regalia.",
  },
];
