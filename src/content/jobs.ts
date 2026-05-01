import { BALANCE } from "./balance";
import type { Modifier, Tag, UnlockRequirement } from "../core/types";

export interface JobDef {
  id: string;
  name: string;
  description: string;
  tags: Tag[];
  unlockRequirement?: UnlockRequirement;
  baseGoldPerSec: number;
  baseEssencePerSec?: number;
  modifiers?: Modifier[];
}

export const JOBS: JobDef[] = [
  {
    id: "porter",
    name: "Porter",
    description: "Haul crates and bodies alike. Reliable gold, no revelations.",
    tags: ["neutral", "wealth"],
    baseGoldPerSec: BALANCE.jobRates.porter.goldPerSec,
    baseEssencePerSec: BALANCE.jobRates.porter.essencePerSec,
  },
  {
    id: "scavenger",
    name: "Scavenger",
    description: "Strip ruins for saleable parts. Better pay, sharper loot instincts.",
    tags: ["wealth", "relic"],
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.scavenger },
    baseGoldPerSec: BALANCE.jobRates.scavenger.goldPerSec,
    baseEssencePerSec: BALANCE.jobRates.scavenger.essencePerSec,
    modifiers: [
      { stat: "itemFindRate", op: "mul", value: 1.15, source: "job_scavenger" },
    ],
  },
  {
    id: "scribe",
    name: "Scribe",
    description: "Copy forbidden texts. Modest coin, steady essence, sharper discovery.",
    tags: ["knowledge", "neutral"],
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.scribe },
    baseGoldPerSec: BALANCE.jobRates.scribe.goldPerSec,
    baseEssencePerSec: BALANCE.jobRates.scribe.essencePerSec,
    modifiers: [
      { stat: "discoveryRate", op: "mul", value: 1.12, source: "job_scribe" },
    ],
  },
  {
    id: "runecarver",
    name: "Runecarver",
    description: "Inscribe ritual glyphs for the deep guilds. The work demands focus; the pay reflects that.",
    tags: ["knowledge", "relic"],
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.runecarver, traitDiscovered: "obsessive" },
    baseGoldPerSec: BALANCE.jobRates.runecarver.goldPerSec,
    baseEssencePerSec: BALANCE.jobRates.runecarver.essencePerSec,
    modifiers: [
      { stat: "discoveryRate", op: "mul", value: 1.28, source: "job_runecarver" },
      { stat: "essenceRate", op: "mul", value: 1.12, source: "job_runecarver" },
      { stat: "talentCostMultiplier", op: "mul", value: 0.94, source: "job_runecarver" },
    ],
  },
];

export const JOB_REGISTRY = new Map<string, JobDef>(
  JOBS.map((job) => [job.id, job])
);
