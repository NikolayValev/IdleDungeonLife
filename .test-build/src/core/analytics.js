"use strict";
// ─── Analytics Interface ──────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalArrayAnalyticsSink = exports.ConsoleAnalyticsSink = void 0;
exports.getAnalyticsSink = getAnalyticsSink;
exports.setAnalyticsSink = setAnalyticsSink;
exports.trackEvent = trackEvent;
// ─── Console / Local Sink ─────────────────────────────────────────────────────
class ConsoleAnalyticsSink {
    track(eventName, payload) {
        console.log(`[analytics] ${eventName}`, payload);
    }
}
exports.ConsoleAnalyticsSink = ConsoleAnalyticsSink;
class LocalArrayAnalyticsSink {
    events = [];
    nextSeq = 0;
    track(eventName, payload) {
        this.events.push({ name: eventName, payload, seq: this.nextSeq++ });
    }
    flush() {
        return [...this.events];
    }
    clear() {
        this.events.length = 0;
    }
}
exports.LocalArrayAnalyticsSink = LocalArrayAnalyticsSink;
// ─── Module-level singleton ───────────────────────────────────────────────────
let _sink = new ConsoleAnalyticsSink();
function getAnalyticsSink() {
    return _sink;
}
function setAnalyticsSink(sink) {
    _sink = sink;
}
function trackEvent(eventName, payload) {
    _sink.track(eventName, payload);
}
