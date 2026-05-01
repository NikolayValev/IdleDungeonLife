// ─── Game Events ──────────────────────────────────────────────────────────────

export type GameEvent =
  | { type: "START_NEW_RUN"; nowUnixSec: number; seed?: number }
  | { type: "TICK"; nowUnixSec: number }
  | { type: "ASSIGN_JOB"; jobId: string }
  | { type: "UNLOCK_JOB"; jobId: string }
  | { type: "UNLOCK_DUNGEON"; dungeonId: string }
  | { type: "START_DUNGEON"; dungeonId: string; nowUnixSec: number }
  | { type: "COMPLETE_DUNGEON"; nowUnixSec: number }
  | { type: "EQUIP_ITEM"; itemInstanceId: string }
  | { type: "UNEQUIP_ITEM"; slot: "weapon" | "armor" | "artifact" }
  | { type: "BREAK_ITEM"; itemInstanceId: string }
  | { type: "UNLOCK_TALENT"; nodeId: string }
  | { type: "DEBUG_ADD_RESOURCES"; gold?: number; essence?: number }
  | { type: "DEBUG_UNLOCK_JOB"; jobId: string }
  | { type: "DEBUG_UNLOCK_DUNGEON"; dungeonId: string }
  | { type: "DEBUG_GRANT_ITEM"; itemId: string }
  | { type: "DEBUG_KILL_RUN" }
  | { type: "CLAIM_DEATH"; nowUnixSec: number }
  | { type: "RECONCILE_OFFLINE"; nowUnixSec: number }
  | { type: "CHOOSE_LEGACY_PATH"; path: "holy" | "abyss" | "knowledge" }
  | { type: "PURCHASE_LEGACY_PERK"; perkId: string };
