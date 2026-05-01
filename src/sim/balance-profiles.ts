/**
 * Balance profiles: presets for different game behaviors and strategies
 */
import type { Policy } from "./policies";
import { BaselinePolicy, ConservativePolicy, AggressivePolicy } from "./policies";

export interface BalanceProfile {
  name: string;
  description: string;
  policy: Policy;
  durationSec?: number;
  stepSec?: number;
  /** Milestone thresholds to track (e.g., "vitality_under_20", "boss_defeated") */
  milestones?: string[];
}

// Baseline profile: standard balanced play
export const PROFILE_BASELINE: BalanceProfile = {
  name: "Baseline",
  description: "Standard balanced gameplay with moderate risk/reward",
  policy: new BaselinePolicy(),
  durationSec: 2 * 3600,
  stepSec: 10,
  milestones: ["depth_10", "depth_15", "boss_defeated", "legendary_found"],
};

// Conservative: prioritizes survival, avoids risky dungeons
export const PROFILE_CONSERVATIVE: BalanceProfile = {
  name: "Conservative",
  description: "Survival-focused strategy, avoids high-risk dungeons",
  policy: new ConservativePolicy(),
  durationSec: 2 * 3600,
  stepSec: 10,
  milestones: ["depth_5", "depth_10", "legendary_found"],
};

// Aggressive: pushes depth limits, takes calculated risks
export const PROFILE_AGGRESSIVE: BalanceProfile = {
  name: "Aggressive",
  description: "High-risk strategy targeting depth and legendary drops",
  policy: new AggressivePolicy(),
  durationSec: 2 * 3600,
  stepSec: 10,
  milestones: ["depth_12", "depth_15", "boss_defeated", "legendary_found"],
};

// Long run: extended duration for late-game content
export const PROFILE_LONG_RUN: BalanceProfile = {
  name: "Long Run",
  description: "Extended duration to reach late-game content (4 hours)",
  policy: new BaselinePolicy(),
  durationSec: 4 * 3600,
  stepSec: 10,
  milestones: ["depth_15", "legendary_found", "trait_evolved"],
};

// Speedrun: quick runs to test early-game balance
export const PROFILE_SPEEDRUN: BalanceProfile = {
  name: "Speedrun",
  description: "Quick 30-minute runs for early-game balance iteration",
  policy: new BaselinePolicy(),
  durationSec: 30 * 60,
  stepSec: 10,
  milestones: ["depth_5", "depth_10"],
};

export const BALANCE_PROFILES = {
  baseline: PROFILE_BASELINE,
  conservative: PROFILE_CONSERVATIVE,
  aggressive: PROFILE_AGGRESSIVE,
  long_run: PROFILE_LONG_RUN,
  speedrun: PROFILE_SPEEDRUN,
};
