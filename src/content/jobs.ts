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
    description: "Haul crates, carry loads. Steady gold, no surprises.",
    tags: ["neutral", "wealth"],
    baseGoldPerSec: 0.5,
    baseEssencePerSec: 0,
  },
  {
    id: "scavenger",
    name: "Scavenger",
    description: "Root through ruins and refuse. Better pay, better finds.",
    tags: ["neutral", "relic"],
    unlockRequirement: { legacyAsh: 3 },
    baseGoldPerSec: 0.9,
    baseEssencePerSec: 0,
    modifiers: [
      { stat: "itemFindRate", op: "mul", value: 1.15, source: "job_scavenger" },
    ],
  },
  {
    id: "scribe",
    name: "Scribe",
    description: "Copy forbidden texts. Low gold, steady essence. Knowledge accumulates.",
    tags: ["knowledge", "neutral"],
    unlockRequirement: { legacyAsh: 8 },
    baseGoldPerSec: 0.25,
    baseEssencePerSec: 0.08,
  },
];

export const JOB_REGISTRY = new Map<string, JobDef>(
  JOBS.map((j) => [j.id, j])
);
