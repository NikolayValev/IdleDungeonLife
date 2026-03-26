// ─── Balance constants ────────────────────────────────────────────────────────
// All tunable numbers live here. Core logic must not hardcode these values.

export const BALANCE = {
  // Offline reconciliation
  maxOfflineSec: 8 * 3600, // 8 hours maximum offline credit

  // Starting gold on new run
  startingGold: 0,
  startingEssence: 0,

  // Dungeon unlock: legacy ash costs
  unlockCost: {
    grave_hollow: 5,
    relic_vault: 15,
    abyss_stair: 30,
    the_silent_prelate: 50,
    scavenger: 3,
    scribe: 8,
  } as Record<string, number>,

  // Legacy ash scoring weights (see scoring.ts)
  legacyAsh: {
    depthMultiplier: 5,
    ageMinuteMultiplier: 1,
    bossBonus: 10,
    dungeonPerCompletion: 2,
  },

  // Dungeon difficulty base threshold (score must meet this to succeed)
  dungeonSuccessThreshold: 1.0, // multiplied by dungeon.difficulty

  // Alignment drift per dungeon
  alignmentDriftScale: 1.0,

  // Trait reveal chance on discovery
  traitRevealOnDiscoveryChance: 0.3,
} as const;
