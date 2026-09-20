/**
 * TLB result types: what a lookup, a fill and an invalidation produced.
 *
 * These are the values the MMU works with, so they live beside the other types and
 * carry no behaviour. Keeping them as discriminated unions means a caller cannot
 * read a frame number out of a miss by accident.
 */

import type { FrameNumber, PageNumber } from "./memory";
import type { TlbEntry, TlbState } from "./machine";

/**
 * Why the TLB could not answer. Only one reason exists today, and the type exists so
 * a future reason (a flushed entry, a stale process ASID, ...) cannot be invented
 * silently at the call site.
 */
export type TlbMissReason = "NOT_CACHED";

/** Deterministic TLB eviction policy. One policy today; the type names it in events. */
export type TlbEvictionPolicy = "FIFO";

/** Why a cached translation was dropped. */
export type TlbInvalidationReason =
  | "EXPLICIT_INVALIDATION"
  /** The whole TLB was flushed in one operation (every entry dropped together). */
  | "EXPLICIT_FLUSH"
  | "PAGE_REPLACED"
  | "PAGE_NO_LONGER_PRESENT";

/** The MMU asked the TLB for a translation. Either the entry is there, or it is not. */
export type TlbLookup =
  | {
      readonly hit: true;
      readonly pageNumber: PageNumber;
      readonly frameNumber: FrameNumber;
      readonly entry: TlbEntry;
      /** Position of the entry in the TLB, for display and tests. */
      readonly slotIndex: number;
    }
  | {
      readonly hit: false;
      readonly pageNumber: PageNumber;
      readonly reason: TlbMissReason;
      /** How many entries were searched, i.e. occupancy at lookup time. */
      readonly entriesSearched: number;
    };

/**
 * What a fill did: the new TLB plus, when the TLB was already full, the entry that
 * had to leave to make room. `evicted` is `null` when the fill only used free space.
 */
export interface TlbFillResult {
  readonly tlb: TlbState;
  readonly evicted: TlbEntry | null;
  /** Slot the new entry occupies after the fill. */
  readonly slotIndex: number;
}

/** What an invalidation did. A page that was not cached is a no-op, not an error. */
export interface TlbInvalidationResult {
  readonly tlb: TlbState;
  readonly invalidated: TlbEntry | null;
}

/**
 * What a flush did: the emptied TLB plus the entries that left it, in the order they
 * occupied. The list exists so the caller can report one event per dropped
 * translation instead of claiming a single silent change.
 */
export interface TlbFlushResult {
  readonly tlb: TlbState;
  readonly flushed: readonly TlbEntry[];
}
