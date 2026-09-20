/**
 * The TLB: lookup, fill, eviction and invalidation - all pure functions.
 *
 * WHY THIS IS ONLY A CACHE
 *
 * A TLB entry is a copy of a page-table entry. It never creates a translation, and
 * it never decides whether a page is in RAM: on a miss the MMU consults the page
 * table, exactly as it would without a TLB. So a TLB MISS is not a page fault, and a
 * page fault is decided by the page table alone.
 *
 * THE MODEL, AND WHAT IS DELIBERATELY SIMPLIFIED
 *
 * The TLB is modelled as an ordered list of slots, not as tag/way hardware:
 *
 *   - `entries` is compact: index 0..capacity-1, no holes. The index is the slot.
 *   - a fill APPENDS when there is free space, and OVERWRITES the victim's slot when
 *     the TLB is full. The list therefore never grows past `capacity`.
 *   - invalidating an entry removes it and compacts the list.
 *   - a fill for a page that is somehow already cached updates it in place (defensive:
 *     a genuine fill only happens after a miss for that page).
 *
 * Eviction policy: FIFO on `fillOrder`, the access counter value at fill time. The
 * oldest entry leaves first; ties (impossible in practice, since every fill uses a
 * distinct counter value) fall to the lowest slot, which keeps the result stable.
 * This is the simplest policy that needs no clock, no reference bits and no
 * randomness - the three things this engine must never have - and it is documented
 * and tested here rather than left implicit.
 *
 * Real hardware usually prefers LRU or a random replacement and flushes the TLB on
 * a context switch. Both are later concerns; neither is needed to explain what a
 * TLB is or why it exists.
 */

import { assertValidTlbCapacity } from "./validation";
import { EngineError } from "../errors";
import type { FrameNumber, PageNumber } from "../types/memory";
import type { TlbEntry, TlbState } from "../types/machine";
import type {
  TlbEvictionPolicy,
  TlbFillResult,
  TlbFlushResult,
  TlbInvalidationResult,
  TlbLookup,
  TlbMissReason,
} from "../types/tlb";

/** Why a lookup missed. Kept next to the lookup so the reason cannot drift from it. */
const MISS_REASON: TlbMissReason = "NOT_CACHED";

/**
 * The eviction policy this engine implements, exported as data so the CLI and the UI
 * state it without hard-coding the sentence in a component.
 */
export const TLB_EVICTION_POLICY: TlbEvictionPolicy = "FIFO";

/** Build an enabled TLB with the given capacity and no cached translations. */
export function createTlbState(capacity: number): TlbState {
  assertValidTlbCapacity(capacity);

  return { enabled: true, capacity, entries: [] };
}

/** An enabled TLB holding exactly these entries (used by tests and by the UI preset). */
export function createTlbStateWithEntries(
  capacity: number,
  entries: readonly TlbEntry[],
): TlbState {
  assertValidTlbCapacity(capacity);

  if (entries.length > capacity) {
    throw new EngineError(
      "INVALID_TLB_CAPACITY",
      `a TLB with capacity ${capacity} cannot hold ${entries.length} entries`,
    );
  }

  const pageNumbers = new Set<PageNumber>();

  for (const entry of entries) {
    assertValidTlbEntry(entry);
    if (pageNumbers.has(entry.pageNumber)) {
      throw new EngineError(
        "INVALID_TLB_ENTRY",
        `duplicate TLB entry for page ${entry.pageNumber}`,
      );
    }
    pageNumbers.add(entry.pageNumber);
  }

  return { enabled: true, capacity, entries: [...entries] };
}

/**
 * Ask the TLB for a translation. `hit: false` is a MISS, not a fault.
 *
 * The lookup is a linear scan of a handful of slots, which is what a fully
 * associative TLB does in one cycle - and it keeps the engine free of any hashing
 * detail that would not teach anything.
 */
export function lookupTlb(tlb: TlbState, pageNumber: PageNumber): TlbLookup {
  const slotIndex = tlb.entries.findIndex((entry) => entry.pageNumber === pageNumber);
  const entry = tlb.entries[slotIndex];

  if (entry === undefined) {
    return {
      hit: false,
      pageNumber,
      reason: MISS_REASON,
      entriesSearched: tlb.entries.length,
    };
  }

  return {
    hit: true,
    pageNumber,
    frameNumber: entry.frameNumber,
    entry,
    slotIndex,
  };
}

/** The entry cached for `pageNumber`, or `null`. */
export function tlbEntryFor(tlb: TlbState, pageNumber: PageNumber): TlbEntry | null {
  const lookup = lookupTlb(tlb, pageNumber);
  return lookup.hit ? lookup.entry : null;
}

/** Entries in slot order - a stable ordering for logs, tests and the UI. */
export function tlbEntries(tlb: TlbState): readonly TlbEntry[] {
  return tlb.entries;
}

/**
 * Cache a translation. The oldest entry leaves when the TLB is full (FIFO).
 *
 * Called only after a PAGE-TABLE HIT: the TLB is filled from the page table, never
 * from thin air, which is why a fill can never resurrect a page that is not in RAM.
 */
export function fillTlb(
  tlb: TlbState,
  pageNumber: PageNumber,
  frameNumber: FrameNumber,
  fillOrder: number,
): TlbFillResult {
  const fresh: TlbEntry = { pageNumber, frameNumber, fillOrder };
  const existingSlot = tlb.entries.findIndex((entry) => entry.pageNumber === pageNumber);

  // Defensive: updating a translation in place must not cost an eviction.
  if (existingSlot !== -1) {
    const entries = tlb.entries.map((entry, index) => (index === existingSlot ? fresh : entry));
    return { tlb: { ...tlb, entries }, evicted: null, slotIndex: existingSlot };
  }

  if (tlb.entries.length < tlb.capacity) {
    const entries = [...tlb.entries, fresh];
    return { tlb: { ...tlb, entries }, evicted: null, slotIndex: entries.length - 1 };
  }

  const victimSlot = oldestSlot(tlb.entries);
  const victim = tlb.entries[victimSlot];
  const entries = tlb.entries.map((entry, index) => (index === victimSlot ? fresh : entry));

  return { tlb: { ...tlb, entries }, evicted: victim ?? null, slotIndex: victimSlot };
}

/** The slot holding the entry that arrived earliest. Ties fall to the lowest slot. */
function oldestSlot(entries: readonly TlbEntry[]): number {
  return entries.reduce(
    (oldest, entry, index) => (entry.fillOrder < (entries[oldest]?.fillOrder ?? Infinity) ? index : oldest),
    0,
  );
}

/**
 * Drop a cached translation, because the page is no longer valid or was replaced.
 *
 * A page that was not cached is a no-op: the caller asked for a guarantee that
 * already holds, and nothing happened, so nothing is reported.
 */
export function invalidateTlbPage(
  tlb: TlbState,
  pageNumber: PageNumber,
): TlbInvalidationResult {
  const lookup = lookupTlb(tlb, pageNumber);

  if (!lookup.hit) {
    return { tlb, invalidated: null };
  }

  const entries = tlb.entries.filter((entry) => entry.pageNumber !== pageNumber);
  return { tlb: { ...tlb, entries }, invalidated: lookup.entry };
}

/**
 * Drop EVERY cached translation, keeping the TLB itself (capacity and enabled flag).
 *
 * This is the hardware's flush: still the same small cache, just empty. Nothing can
 * be learned from an entry that is gone, so no page table is consulted here - a
 * flush only ever REMOVES knowledge, it never creates a translation.
 *
 * A flush of an already-empty TLB reports nothing (`flushed` is empty), so the caller
 * can emit zero events for an operation in which nothing happened.
 */
export function flushTlb(tlb: TlbState): TlbFlushResult {
  return { tlb: { ...tlb, entries: [] }, flushed: tlb.entries };
}

/** How many slots are in use. */
export function tlbOccupancy(tlb: TlbState): number {
  return tlb.entries.length;
}

/** True when the TLB holds no free slot. */
export function isTlbFull(tlb: TlbState): boolean {
  return tlb.entries.length >= tlb.capacity;
}
function assertValidTlbEntry(entry: TlbEntry): void {
  if (!Number.isSafeInteger(entry.pageNumber) || entry.pageNumber < 0) {
    throw new EngineError(
      "INVALID_TLB_ENTRY",
      `TLB entry page number must be a non-negative integer, received ${String(entry.pageNumber)}`,
    );
  }
  if (!Number.isSafeInteger(entry.frameNumber) || entry.frameNumber < 0) {
    throw new EngineError(
      "INVALID_TLB_ENTRY",
      `TLB entry frame number must be a non-negative integer, received ${String(entry.frameNumber)}`,
    );
  }
  if (!Number.isSafeInteger(entry.fillOrder) || entry.fillOrder < 0) {
    throw new EngineError(
      "INVALID_TLB_ENTRY",
      `TLB entry fill order must be a non-negative integer, received ${String(entry.fillOrder)}`,
    );
  }
}