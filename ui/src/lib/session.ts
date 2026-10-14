/**
 * The session: one machine, its history, and a cursor into the event stream.
 *
 * THE RULE THIS FILE PROTECTS
 *
 * The UI never computes OS facts. Everything shown comes from one of two places:
 *
 *   1. an EVENT the engine produced (which stage is active, the page number,
 *      the offset, the frame, the physical address, the fault), or
 *   2. ENGINE STATE after an access (`state.tlb`, `state.process.pageTable`,
 *      `state.memory`), handed over whole by `step()`.
 *
 * In particular this file never divides an address into page + offset, never decides
 * whether a translation is a hit or a miss, and never derives a frame or a physical
 * address. It only READS them off events and engine states, which is exactly the
 * boundary the architecture document draws between the engine and pixels.
 *
 * Shape of a session: history is a list of RECORDS, one record per user action.
 * Each record holds the engine's state BEFORE the action, the action's events, and
 * the engine's state AFTER it. The cursor is a position inside one record's events.
 */

import type {
  ActionType,
  Event,
  FrameNumber,
  MachineState,
  Offset,
  PageNumber,
  PhysicalAddress,
  TlbEntry,
  VirtualAddress,
} from "../../../engine";
import { pageTableEntries } from "../../../engine";

/** One completed engine access: before-state, events, after-state. */
export interface AccessRecord {
  readonly kind: "access";
  readonly stateBefore: MachineState;
  readonly address: VirtualAddress;
  readonly accessKind: "read" | "write";
  readonly events: readonly Event[];
  readonly stateAfter: MachineState;
}

/** A completed invalidation, kept on the record so the timeline stays truthful. */
export interface InvalidationRecord {
  readonly kind: "invalidation";
  readonly stateBefore: MachineState;
  readonly pageNumber: PageNumber;
  readonly events: readonly Event[];
  readonly stateAfter: MachineState;
}

/**
 * A completed maintenance action that named no address: a TLB flush, or a page
 * unmapped. Kept apart from an access because there is no virtual address and no
 * translation to report - only the engine events the action produced.
 */
export interface MaintenanceRecord {
  readonly kind: "maintenance";
  readonly stateBefore: MachineState;
  /** The engine action tag that produced this record, e.g. `"CLEAR_TLB"`. */
  readonly action: ActionType;
  /** The page the action named, or `null` when it named none (a whole-TLB flush). */
  readonly pageNumber: PageNumber | null;
  readonly events: readonly Event[];
  readonly stateAfter: MachineState;
}

/** Everything one user action leaves in the session. */
export type SessionRecord = AccessRecord | InvalidationRecord | MaintenanceRecord;

/** A position inside one record's event list. */
export interface SessionCursor {
  readonly recordIndex: number;
  readonly eventIndex: number;
}

/** One row of the session event log, carrying its cursor position for replay. */
export interface TimelineEntry {
  readonly recordIndex: number;
  readonly eventIndex: number;
  readonly event: Event;
  readonly outcome: TimelineOutcome;
}

/** How one record ended, taken from its events - never recomputed here. */
export type TimelineOutcome =
  | { readonly kind: "ram"; readonly physicalAddress: PhysicalAddress }
  | { readonly kind: "fault"; readonly pageNumber: PageNumber }
  | { readonly kind: "invalidate"; readonly pageNumber: PageNumber }
  | { readonly kind: "unmap"; readonly pageNumber: PageNumber; readonly frameNumber: FrameNumber }
  | { readonly kind: "flush"; readonly dropped: number }
  | { readonly kind: "none" };

/** The pipeline column the cursor sits on right now. */
export type PipelineStage =
  | "cpu"
  | "virtual"
  | "split"
  | "tlb"
  | "pageTable"
  | "fault"
  | "fill"
  | "frame"
  | "physical"
  | "ram";

/** The verdict of the event under the cursor, read off whole-record event tags. */
export type AccessVerdict = "hit" | "miss" | "fault" | null;

/** Plenty for a learning session, and bounded is honest: the log cannot grow forever. */
export const MAX_RECORDS = 64;

/** True when the record already reached a TLB mutation at or before `eventIndex`. */
function tlbMutationPassed(record: SessionRecord, eventIndex: number): boolean {
  return record.events
    .slice(0, eventIndex + 1)
    .some((event) => isTlbMutation(event.type));
}

/** True when a TLB mutation is still ahead of the cursor. */
function tlbMutationAhead(record: SessionRecord, eventIndex: number): boolean {
  return record.events
    .slice(eventIndex + 1)
    .some((event) => isTlbMutation(event.type));
}

function isTlbMutation(type: Event["type"]): boolean {
  return type === "TLB_FILL" || type === "TLB_EVICT" || type === "TLB_INVALIDATE";
}

/** Derive the view for the cursor, or the empty view when the session is empty. */
export function viewForCursor(
  records: readonly SessionRecord[],
  cursor: SessionCursor | null,
): SessionView {
  const record = cursor === null ? null : (records[cursor.recordIndex] ?? null);
  const event =
    record === null || cursor === null ? null : (record.events[cursor.eventIndex] ?? null);

  const totalEvents = records.reduce((total, candidate) => total + candidate.events.length, 0);
  const verdicts = countVerdicts(records);

  if (record === null || event === null || cursor === null) {
    return {
      cursor: null,
      record: null,
      recordIndex: null,
      event: null,
      eventPosition: null,
      stage: "cpu",
      verdict: null,
      headline: "No access yet",
      subline: "Use ACCESS to send the first virtual address to the MMU.",
      pageNumber: null,
      offset: null,
      frameNumber: null,
      physicalAddress: null,
      tlbAfter: true,
      faults: verdicts.faults,
      hits: verdicts.hits,
      misses: verdicts.misses,
      tlbEntries: [],
      tlbOccupancy: 0,
      tlbCapacity: 0,
      tlbEnabled: false,
      totalEvents,
      records: records.length,
    };
  }

  const tlb = record.stateAfter.tlb;
  const tlbAfter =
    tlbMutationPassed(record, cursor.eventIndex) || !tlbMutationAhead(record, cursor.eventIndex);
  const shownTlb = tlbAfter ? record.stateAfter.tlb : record.stateBefore.tlb;

  return {
    cursor,
    record,
    recordIndex: cursor.recordIndex,
    event,
    eventPosition: cursor.eventIndex + 1,
    stage: stageForEvent(record, event),
    verdict: verdictForRecord(record),
    headline: headlineForRecord(record),
    subline: sublineForEvent(record, event),
    pageNumber: latestValue(record, cursor.eventIndex, readPageNumber),
    offset: latestValue(record, cursor.eventIndex, readOffset),
    frameNumber: latestValue(record, cursor.eventIndex, readFrameNumber),
    physicalAddress: latestValue(record, cursor.eventIndex, readPhysicalAddress),
    tlbAfter,
    faults: verdicts.faults,
    hits: verdicts.hits,
    misses: verdicts.misses,
    tlbEntries: shownTlb.entries,
    tlbOccupancy: shownTlb.entries.length,
    tlbCapacity: tlb.capacity,
    tlbEnabled: tlb.enabled,
    totalEvents,
    records: records.length,
  };
}

/**
 * PRESENTATION ONLY: which pipeline column an event lights up.
 *
 * This mapping is the one place the UI is allowed to "know" what an event means -
 * it names the box that flashes, and nothing else. It never computes, stores or
 * changes a fact; the facts live in the events and the engine states.
 *
 * A machine WITHOUT a TLB never emits TLB_LOOKUP / TLB_HIT / TLB_MISS, so the TLB
 * column simply never lights up for it. That is the whole visual difference between
 * the two machines, and it falls out of the events for free.
 */
export function stageForEvent(record: SessionRecord, event: Event): PipelineStage {
  void record;
  switch (event.type) {
    case "CPU_MEMORY_ACCESS":
      return "cpu";
    case "VIRTUAL_ADDRESS_GENERATED":
      return "virtual";
    case "ADDRESS_SPLIT":
      return "split";
    case "TLB_LOOKUP":
    case "TLB_HIT":
    case "TLB_MISS":
      return "tlb";
    case "PAGE_TABLE_LOOKUP":
    case "PAGE_TABLE_HIT":
    case "PAGE_UNMAPPED":
      return "pageTable";
    case "PAGE_FAULT":
      return "fault";
    case "TLB_FILL":
    case "TLB_EVICT":
    case "TLB_INVALIDATE":
      return "fill";
    case "FRAME_RESOLVED":
      return "frame";
    case "PHYSICAL_ADDRESS_GENERATED":
      return "physical";
    case "RAM_ACCESS":
      return "ram";
  }
}

/** Session counters, folded over whole records - never over guesses. */
function countVerdicts(records: readonly SessionRecord[]): {
  hits: number;
  misses: number;
  faults: number;
} {
  let hits = 0;
  let misses = 0;
  let faults = 0;

  for (const record of records) {
    const verdict = verdictForRecord(record);
    if (verdict === "hit") {
      hits += 1;
    } else if (verdict === "miss") {
      misses += 1;
    } else if (verdict === "fault") {
      faults += 1;
    }
  }

  return { hits, misses, faults };
}

/** The verdict of the whole record, read off its event tags like a scientist reads data. */
function verdictForRecord(record: SessionRecord): AccessVerdict {
  const kinds = record.events.map((event) => event.type);
  if (kinds.includes("PAGE_FAULT")) {
    return "fault";
  }
  if (kinds.includes("TLB_HIT")) {
    return "hit";
  }
  if (kinds.includes("TLB_MISS")) {
    return "miss";
  }
  // A machine without a TLB can never hit or miss its cache: "miss" is the honest
  // name for its page-table walk, since every such access would have missed a cache.
  return record.kind === "access" ? "miss" : null;
}
/** The record title: an address in hex, or the page the maintenance action named. */
function headlineForRecord(record: SessionRecord): string {
  if (record.kind === "invalidation") {
    return `Invalidate page ${record.pageNumber}`;
  }
  if (record.kind === "maintenance") {
    return record.action === "CLEAR_TLB"
      ? "Clear TLB"
      : `Unmap page ${record.pageNumber ?? "—"}`;
  }
  return `Access ${hex(record.address)}`;
}

/** One line describing the event under the cursor, read off its own payload. */
function sublineForEvent(record: SessionRecord, event: Event): string {
  switch (event.type) {
    case "CPU_MEMORY_ACCESS":
      if (record.kind === "access") {
        return `${record.accessKind} of ${hex(record.address)}`;
      }
      return record.kind === "invalidation"
        ? `invalidating page ${record.pageNumber}`
        : `maintenance: ${record.action}`;
    case "VIRTUAL_ADDRESS_GENERATED":
      return `MMU input: ${hex(event.virtualAddress)}`;
    case "ADDRESS_SPLIT":
      return `page ${event.pageNumber}, offset ${event.offset} (page size ${event.pageSize})`;
    case "TLB_LOOKUP":
      return `searching ${event.entriesSearched} cached translation(s) for page ${event.pageNumber}`;
    case "TLB_HIT":
      return `page ${event.pageNumber} cached in slot ${event.slotIndex}: frame ${event.frameNumber}`;
    case "TLB_MISS":
      return `page ${event.pageNumber} not cached (${event.reason})`;
    case "PAGE_TABLE_LOOKUP":
      return `looking up page ${event.pageNumber}`;
    case "PAGE_TABLE_HIT":
      return `page ${event.pageNumber} lives in frame ${event.frameNumber}`;
    case "PAGE_FAULT":
      return `page ${event.pageNumber} is not resident (${event.reason})`;
    case "PAGE_UNMAPPED":
      return `page ${event.pageNumber} released from frame ${event.frameNumber} (no longer mapped)`;
    case "TLB_FILL":
      return `caching page ${event.pageNumber} as frame ${event.frameNumber} in slot ${event.slotIndex}`;
    case "TLB_EVICT":
      return `slot ${event.slotIndex} evicted page ${event.pageNumber} (${event.policy})`;
    case "TLB_INVALIDATE":
      return `dropped page ${event.pageNumber} (${event.reason})`;
    case "FRAME_RESOLVED":
      return `page ${event.pageNumber} resolved to frame ${event.frameNumber}`;
    case "PHYSICAL_ADDRESS_GENERATED":
      return `frame ${event.frameNumber} + offset ${event.offset} = ${hex(event.physicalAddress)}`;
    case "RAM_ACCESS":
      return `${event.access} ${hex(event.physicalAddress)} (frame ${event.frameNumber})`;
  }
}

/** Scan the record up to the cursor for the latest event carrying a page number. */
function readPageNumber(event: Event): number | null {
  return "pageNumber" in event && typeof event.pageNumber === "number" ? event.pageNumber : null;
}

function readOffset(event: Event): number | null {
  return "offset" in event && typeof event.offset === "number" ? event.offset : null;
}

function readFrameNumber(event: Event): number | null {
  return "frameNumber" in event && typeof event.frameNumber === "number"
    ? event.frameNumber
    : null;
}

function readPhysicalAddress(event: Event): number | null {
  return "physicalAddress" in event && typeof event.physicalAddress === "number"
    ? event.physicalAddress
    : null;
}

/** The latest value a reader found at or before the cursor, or `null`. */
function latestValue<T>(
  record: SessionRecord,
  eventIndex: number,
  read: (event: Event) => T | null,
): T | null {
  let value: T | null = null;
  for (const event of record.events.slice(0, eventIndex + 1)) {
    const found = read(event);
    if (found !== null) {
      value = found;
    }
  }
  return value;
}

/** Oldest-first entries across all records, for the event log. */
export function timelineEntries(records: readonly SessionRecord[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  records.forEach((record, recordIndex) => {
    record.events.forEach((event, eventIndex) => {
      entries.push({
        recordIndex,
        eventIndex,
        event,
        outcome: outcomeForRecord(record),
      });
    });
  });

  return entries;
}

function outcomeForRecord(record: SessionRecord): TimelineOutcome {
  if (record.kind === "invalidation") {
    return { kind: "invalidate", pageNumber: record.pageNumber };
  }

  // Read the outcome off the record's own events, so a maintenance action reports
  // exactly what the engine did and nothing more.
  const unmapped = record.events.find((event) => event.type === "PAGE_UNMAPPED");
  if (unmapped !== undefined && unmapped.type === "PAGE_UNMAPPED") {
    return { kind: "unmap", pageNumber: unmapped.pageNumber, frameNumber: unmapped.frameNumber };
  }

  const flushed = record.events.filter(
    (event) => event.type === "TLB_INVALIDATE" && event.reason === "EXPLICIT_FLUSH",
  );
  if (flushed.length > 0) {
    return { kind: "flush", dropped: flushed.length };
  }

  for (const event of record.events) {
    if (event.type === "RAM_ACCESS") {
      return { kind: "ram", physicalAddress: event.physicalAddress };
    }
    if (event.type === "PAGE_FAULT") {
      return { kind: "fault", pageNumber: event.pageNumber };
    }
  }
  return { kind: "none" };
}

/** Page-table rows in ascending page order, taken whole from engine state. */
export function pageTableRows(state: MachineState): {
  pageNumber: PageNumber;
  present: boolean;
  frameNumber: FrameNumber | null;
}[] {
  return pageTableEntries(state.process.pageTable).map((entry) => ({
    pageNumber: entry.pageNumber,
    present: entry.present,
    frameNumber: entry.frameNumber,
  }));
}

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

/** The page size of the demo machines, kept next to the address presets that use it. */
export const DEMO_PAGE_SIZE = 4096;

/**
 * One preset address per story the lab exists to tell: a first touch, the same
 * page again, a peer page, an absent page and a page with no entry at all.
 */
export const ADDRESS_PRESETS: readonly {
  readonly label: string;
  readonly page: number;
  readonly offset: number;
}[] = [
  { label: "page 1 (first touch)", page: 1, offset: 0x345 },
  { label: "page 1 again", page: 1, offset: 0x999 },
  { label: "page 4 (peer)", page: 4, offset: 0x40 },
  { label: "page 6 (absent)", page: 6, offset: 100 },
  { label: "page 7 (no entry)", page: 7, offset: 0 },
];


/** Append one access record, capping the history at `MAX_RECORDS`. */
export function appendAccess(
  records: readonly SessionRecord[],
  record: AccessRecord,
): readonly SessionRecord[] {
  return capRecords([...records, record]);
}

/** Append one invalidation record, capping the history at `MAX_RECORDS`. */
export function appendInvalidation(
  records: readonly SessionRecord[],
  record: InvalidationRecord,
): readonly SessionRecord[] {
  return capRecords([...records, record]);
}

/** Append one maintenance record (a flush or an unmap), capping the history. */
export function appendMaintenance(
  records: readonly SessionRecord[],
  record: MaintenanceRecord,
): readonly SessionRecord[] {
  return capRecords([...records, record]);
}

function capRecords(records: readonly SessionRecord[]): readonly SessionRecord[] {
  return records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records;
}

/** A fresh cursor points at the first event of the newest record. */
export function cursorForNewRecord(records: readonly SessionRecord[]): SessionCursor {
  return { recordIndex: records.length - 1, eventIndex: 0 };
}

export function cursorForward(
  records: readonly SessionRecord[],
  cursor: SessionCursor,
): SessionCursor {
  const record = records[cursor.recordIndex];
  if (record === undefined) {
    return cursor;
  }
  if (cursor.eventIndex + 1 < record.events.length) {
    return { recordIndex: cursor.recordIndex, eventIndex: cursor.eventIndex + 1 };
  }
  if (cursor.recordIndex + 1 < records.length) {
    return { recordIndex: cursor.recordIndex + 1, eventIndex: 0 };
  }
  return cursor;
}

export function cursorBackward(cursor: SessionCursor): SessionCursor {
  if (cursor.eventIndex > 0) {
    return { recordIndex: cursor.recordIndex, eventIndex: cursor.eventIndex - 1 };
  }
  if (cursor.recordIndex > 0) {
    return { recordIndex: cursor.recordIndex - 1, eventIndex: 0 };
  }
  return cursor;
}

/**
 * The cursor at the last event of the newest record, or `null` when the log is
 * empty. Moved here from the lesson so Lab and Learn share one implementation:
 * "jump to latest" must mean the same thing on both screens.
 */
export function cursorAtEndOf(records: readonly SessionRecord[]): SessionCursor | null {
  const recordIndex = records.length - 1;
  const record = records[recordIndex];
  if (record === undefined || record.events.length === 0) {
    return record === undefined ? null : { recordIndex, eventIndex: 0 };
  }
  return { recordIndex, eventIndex: record.events.length - 1 };
}

/**
 * Where the cursor sits in the whole-session event order: 1-based position and
 * total, computed by flattening the records exactly the way `timelineStops`
 * does, so the readout can never disagree with the timeline a click away.
 * `null` when the session is empty or the cursor is unset.
 */
export function historyPosition(
  records: readonly SessionRecord[],
  cursor: SessionCursor | null,
): { readonly position: number; readonly total: number } | null {
  if (cursor === null) {
    return null;
  }
  const record = records[cursor.recordIndex];
  if (record === undefined || cursor.eventIndex >= record.events.length) {
    return null;
  }
  let before = 0;
  let total = 0;
  records.forEach((candidate, index) => {
    if (index < cursor.recordIndex) {
      before += candidate.events.length;
    }
    total += candidate.events.length;
  });
  return { position: before + cursor.eventIndex + 1, total };
}

/** Position a cursor on a timeline entry. */
export function cursorForEntry(entry: TimelineEntry): SessionCursor {
  return { recordIndex: entry.recordIndex, eventIndex: entry.eventIndex };
}

/**
 * Everything the UI paints for one cursor position, folded from events and the engine
 * states that produced them.
 */
export interface SessionView {
  readonly cursor: SessionCursor | null;
  readonly record: SessionRecord | null;
  readonly recordIndex: number | null;
  readonly event: Event | null;
  readonly eventPosition: number | null;
  readonly stage: PipelineStage;
  readonly verdict: AccessVerdict;
  /** Window title for the current record: the address, or the invalidated page. */
  readonly headline: string;
  readonly subline: string;
  /** Values read off the latest event of that kind at or before the cursor. */
  readonly pageNumber: PageNumber | null;
  readonly offset: Offset | null;
  readonly frameNumber: FrameNumber | null;
  readonly physicalAddress: PhysicalAddress | null;
  /**
   * Whether the TLB panel shows the state BEFORE or AFTER the current access.
   * The engine only returns whole states, so whole states are what this chooses
   * between: "before" while the cursor is still ahead of the access's TLB work,
   * "after" from the first TLB_MUTATION event (TLB_FILL, TLB_EVICT or
   * TLB_INVALIDATE) on. Positioning - never content - comes from the events; the
   * content itself is always unmodified engine state.
   */
  readonly tlbAfter: boolean;
  readonly faults: number;
  readonly hits: number;
  readonly misses: number;
  /** The entries shown in the TLB panel (before- or after-state, per `tlbAfter`). */
  readonly tlbEntries: readonly TlbEntry[];
  readonly tlbOccupancy: number;
  readonly tlbCapacity: number;
  readonly tlbEnabled: boolean;
  readonly totalEvents: number;
  readonly records: number;
}

