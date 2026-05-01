"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepRun = stepRun;
exports.advanceRun = advanceRun;
const reducer_1 = require("../core/reducer");
function applyPolicyDecisions(save, nowUnixSec, policy) {
    if (!policy || !save.currentRun?.alive)
        return save;
    let current = save;
    const seen = new Set();
    while (current.currentRun?.alive) {
        const action = policy.decide(current, nowUnixSec);
        if (!action)
            break;
        const fingerprint = JSON.stringify(action);
        if (seen.has(fingerprint))
            break;
        seen.add(fingerprint);
        current = (0, reducer_1.reduceGame)(current, action);
    }
    return current;
}
function stepRun(state, nowUnixSec, policy) {
    if (!state.currentRun?.alive) {
        return { ...state, updatedAtUnixSec: nowUnixSec };
    }
    let current = state;
    while (current.currentRun?.alive) {
        const completionAt = current.currentRun.currentDungeon?.completesAtUnixSec;
        if (completionAt == null ||
            completionAt > nowUnixSec ||
            completionAt <= current.currentRun.lastTickUnixSec) {
            break;
        }
        current = (0, reducer_1.reduceGame)(current, { type: "TICK", nowUnixSec: completionAt });
        current = (0, reducer_1.reduceGame)(current, { type: "COMPLETE_DUNGEON", nowUnixSec: completionAt });
        current = applyPolicyDecisions(current, completionAt, policy);
    }
    if (current.currentRun?.alive && current.currentRun.lastTickUnixSec < nowUnixSec) {
        current = (0, reducer_1.reduceGame)(current, { type: "TICK", nowUnixSec });
    }
    else {
        current = { ...current, updatedAtUnixSec: nowUnixSec };
    }
    if (current.currentRun?.alive &&
        current.currentRun.currentDungeon &&
        nowUnixSec >= current.currentRun.currentDungeon.completesAtUnixSec) {
        current = (0, reducer_1.reduceGame)(current, {
            type: "COMPLETE_DUNGEON",
            nowUnixSec: current.currentRun.currentDungeon.completesAtUnixSec,
        });
    }
    return applyPolicyDecisions(current, nowUnixSec, policy);
}
function advanceRun(state, startUnixSec, durationSec, stepSec, policy) {
    let current = state;
    let now = startUnixSec;
    const end = startUnixSec + durationSec;
    while (now < end && current.currentRun?.alive) {
        now = Math.min(now + stepSec, end);
        current = stepRun(current, now, policy);
    }
    return current;
}
