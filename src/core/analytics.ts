// ─── Analytics Interface ──────────────────────────────────────────────────────

export interface AnalyticsSink {
  track(eventName: string, payload: Record<string, unknown>): void;
}

export interface AnalyticsTimelineEvent {
  name: string;
  payload: Record<string, unknown>;
  seq: number;
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
  readonly events: AnalyticsTimelineEvent[] = [];
  private nextSeq = 0;

  track(eventName: string, payload: Record<string, unknown>): void {
    this.events.push({ name: eventName, payload, seq: this.nextSeq++ });
  }

  flush(): AnalyticsTimelineEvent[] {
    return this.events.map((event) => ({
      name: event.name,
      payload: { ...event.payload },
      seq: event.seq,
    }));
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

export function resetAnalyticsTimeline(): void {
  if (_sink instanceof LocalArrayAnalyticsSink) {
    _sink.clear();
  }
}

export function snapshotAnalyticsTimeline(clear = false): AnalyticsTimelineEvent[] {
  if (!(_sink instanceof LocalArrayAnalyticsSink)) {
    return [];
  }

  const events = _sink.flush();
  if (clear) {
    _sink.clear();
  }
  return events;
}
