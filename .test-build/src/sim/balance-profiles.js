"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BALANCE_PROFILES = exports.PROFILE_SPEEDRUN = exports.PROFILE_LONG_RUN = exports.PROFILE_AGGRESSIVE = exports.PROFILE_CONSERVATIVE = exports.PROFILE_BASELINE = void 0;
const policies_1 = require("./policies");
// Baseline profile: standard balanced play
exports.PROFILE_BASELINE = {
    name: "Baseline",
    description: "Standard balanced gameplay with moderate risk/reward",
    policy: new policies_1.BaselinePolicy(),
    durationSec: 2 * 3600,
    stepSec: 10,
    milestones: ["depth_10", "depth_15", "boss_defeated", "legendary_found"],
};
// Conservative: prioritizes survival, avoids risky dungeons
exports.PROFILE_CONSERVATIVE = {
    name: "Conservative",
    description: "Survival-focused strategy, avoids high-risk dungeons",
    policy: new policies_1.ConservativePolicy(),
    durationSec: 2 * 3600,
    stepSec: 10,
    milestones: ["depth_5", "depth_10", "legendary_found"],
};
// Aggressive: pushes depth limits, takes calculated risks
exports.PROFILE_AGGRESSIVE = {
    name: "Aggressive",
    description: "High-risk strategy targeting depth and legendary drops",
    policy: new policies_1.AggressivePolicy(),
    durationSec: 2 * 3600,
    stepSec: 10,
    milestones: ["depth_12", "depth_15", "boss_defeated", "legendary_found"],
};
// Long run: extended duration for late-game content
exports.PROFILE_LONG_RUN = {
    name: "Long Run",
    description: "Extended duration to reach late-game content (4 hours)",
    policy: new policies_1.BaselinePolicy(),
    durationSec: 4 * 3600,
    stepSec: 10,
    milestones: ["depth_15", "legendary_found", "trait_evolved"],
};
// Speedrun: quick runs to test early-game balance
exports.PROFILE_SPEEDRUN = {
    name: "Speedrun",
    description: "Quick 30-minute runs for early-game balance iteration",
    policy: new policies_1.BaselinePolicy(),
    durationSec: 30 * 60,
    stepSec: 10,
    milestones: ["depth_5", "depth_10"],
};
exports.BALANCE_PROFILES = {
    baseline: exports.PROFILE_BASELINE,
    conservative: exports.PROFILE_CONSERVATIVE,
    aggressive: exports.PROFILE_AGGRESSIVE,
    long_run: exports.PROFILE_LONG_RUN,
    speedrun: exports.PROFILE_SPEEDRUN,
};
