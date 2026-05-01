// ─── Analytics Interface ──────────────────────────────────────────────────────

export interface AnalyticsSink {
  track(eventName: string, payload: Record<string, unknown>): void;
}

// ─── Analytics Event Names ────────────────────────────────────────────────────

export type AnalyticsEventName =
  | "run_started"
  | "trait_assigned"
  | "dungeon_started"
  | "dungeon_completed"
  | "item_found"
  | "item_equipped"
  | "item_broken"
  | "talent_unlocked"
  | "alignment_shifted"
  | "run_died"
  | "run_summary";

// ─── Console / Local Sink ─────────────────────────────────────────────────────

export class ConsoleAnalyticsSink implements AnalyticsSink {
  track(eventName: string, payload: Record<string, unknown>): void {
    console.log(`[analytics] ${eventName}`, payload);
  }
}

export class LocalArrayAnalyticsSink implements AnalyticsSink {
  readonly events: Array<{ name: string; payload: Record<string, unknown>; seq: number }> = [];
  private nextSeq = 0;

  track(eventName: string, payload: Record<string, unknown>): void {
    this.events.push({ name: eventName, payload, seq: this.nextSeq++ });
  }

  flush(): typeof this.events {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let _sink: AnalyticsSink = new ConsoleAnalyticsSink();

export function getAnalyticsSink(): AnalyticsSink {
  return _sink;
}

export function setAnalyticsSink(sink: AnalyticsSink): void {
  _sink = sink;
}

export function trackEvent(
  eventName: AnalyticsEventName,
  payload: Record<string, unknown>
): void {
  _sink.track(eventName, payload);
}
