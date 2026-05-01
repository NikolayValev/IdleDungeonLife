"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_REGISTRY = exports.JOBS = void 0;
const balance_1 = require("./balance");
exports.JOBS = [
    {
        id: "porter",
        name: "Porter",
        description: "Haul crates and bodies alike. Reliable gold, no revelations.",
        tags: ["neutral", "wealth"],
        baseGoldPerSec: balance_1.BALANCE.jobRates.porter.goldPerSec,
        baseEssencePerSec: balance_1.BALANCE.jobRates.porter.essencePerSec,
    },
    {
        id: "scavenger",
        name: "Scavenger",
        description: "Strip ruins for saleable parts. Better pay, sharper loot instincts.",
        tags: ["wealth", "relic"],
        unlockRequirement: { legacyAsh: balance_1.BALANCE.unlockCost.scavenger },
        baseGoldPerSec: balance_1.BALANCE.jobRates.scavenger.goldPerSec,
        baseEssencePerSec: balance_1.BALANCE.jobRates.scavenger.essencePerSec,
        modifiers: [
            { stat: "itemFindRate", op: "mul", value: 1.15, source: "job_scavenger" },
        ],
    },
    {
        id: "scribe",
        name: "Scribe",
        description: "Copy forbidden texts. Modest coin, steady essence, sharper discovery.",
        tags: ["knowledge", "neutral"],
        unlockRequirement: { legacyAsh: balance_1.BALANCE.unlockCost.scribe },
        baseGoldPerSec: balance_1.BALANCE.jobRates.scribe.goldPerSec,
        baseEssencePerSec: balance_1.BALANCE.jobRates.scribe.essencePerSec,
        modifiers: [
            { stat: "discoveryRate", op: "mul", value: 1.12, source: "job_scribe" },
        ],
    },
    {
        id: "runecarver",
        name: "Runecarver",
        description: "Inscribe ritual glyphs for the deep guilds. The work demands focus; the pay reflects that.",
        tags: ["knowledge", "relic"],
        unlockRequirement: { legacyAsh: balance_1.BALANCE.unlockCost.runecarver, traitDiscovered: "obsessive" },
        baseGoldPerSec: balance_1.BALANCE.jobRates.runecarver.goldPerSec,
        baseEssencePerSec: balance_1.BALANCE.jobRates.runecarver.essencePerSec,
        modifiers: [
            { stat: "discoveryRate", op: "mul", value: 1.28, source: "job_runecarver" },
            { stat: "essenceRate", op: "mul", value: 1.12, source: "job_runecarver" },
            { stat: "talentCostMultiplier", op: "mul", value: 0.94, source: "job_runecarver" },
        ],
    },
];
exports.JOB_REGISTRY = new Map(exports.JOBS.map((job) => [job.id, job]));
