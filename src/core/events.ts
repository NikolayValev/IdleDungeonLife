// ─── Game Events ──────────────────────────────────────────────────────────────

export type GameEvent =
  | { type: "START_NEW_RUN"; nowUnixSec: number; seed?: number }
  | { type: "TICK"; nowUnixSec: number }
  | { type: "ASSIGN_JOB"; jobId: string }
  | { type: "START_DUNGEON"; dungeonId: string; nowUnixSec: number }
  | { type: "COMPLETE_DUNGEON"; nowUnixSec: number }
  | { type: "EQUIP_ITEM"; itemInstanceId: string }
  | { type: "UNEQUIP_ITEM"; slot: "weapon" | "armor" | "artifact" }
  | { type: "BREAK_ITEM"; itemInstanceId: string }
  | { type: "UNLOCK_TALENT"; nodeId: string }
  | { type: "CLAIM_DEATH"; nowUnixSec: number }
  | { type: "RECONCILE_OFFLINE"; nowUnixSec: number };
