"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRun = evaluateRun;
const scoring_1 = require("../core/scoring");
function evaluateRun(run, meta) {
    const discoveryCount = (meta?.discoveredItemIds.length ?? 0) + (meta?.discoveredTraitIds.length ?? 0);
    return (0, scoring_1.scoreRun)(run, discoveryCount);
}
