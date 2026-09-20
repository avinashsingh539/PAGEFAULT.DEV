/**
 * The event system of the simulation engine.
 *
 * An event describes something the simulated computer ACTUALLY DID. Events are
 * deliberately low-level and factual - no presentation concerns live here:
 *
 *   GOOD: { type: "ADDRESS_SPLIT", pageNumber: 18, offset: 837 }
 *   BAD:  { type: "SHOW_GREEN_BOX" } / "ANIMATE_ARROW" / "DISPLAY_TEXT"
 *
 * A future UI (Learn / Experiment / Compare mode, timeline scrubbing, replay) will
 * render exactly these events instead of computing any OS logic of its own.
 */

import type {
  TlbEvictionPolicy,
  TlbInvalidationReason,
  TlbMissReason,
} from "./tlb";
import type {
  AccessKind,
  FrameNumber,
  Offset,
  PageFaultReason,
  PageNumber,
  PageSize,
  PhysicalAddress,
  VirtualAddress,
} from "./memory";

/**
 * Monotonic, deterministic event counter.
 *
 * The engine never calls `Date.now()`: `sequence` is derived purely from machine
 * state, so replaying the same actions on the same initial state yields the same
 * numbering on every run and on every machine.
 */
export type EventSequence = number;

/** Fields shared by every event. */
export interface EventBase {
  readonly sequence: EventSequence;
}

/** The CPU asked the memory subsystem to access a virtual address. */
export interface CpuMemoryAccessEvent extends EventBase {
  readonly type: "CPU_MEMORY_ACCESS";
  readonly access: AccessKind;
  readonly virtualAddress: VirtualAddress;
  readonly pid: number;
}

/** The CPU presented that virtual address to the memory subsystem (MMU input). */
export interface VirtualAddressGeneratedEvent extends EventBase {
  readonly type: "VIRTUAL_ADDRESS_GENERATED";
  readonly virtualAddress: VirtualAddress;
  readonly pid: number;
}

/** The MMU split the virtual address into page number + offset. */
export interface AddressSplitEvent extends EventBase {
  readonly type: "ADDRESS_SPLIT";
  readonly virtualAddress: VirtualAddress;
  readonly pageSize: PageSize;
  readonly pageNumber: PageNumber;
  readonly offset: Offset;
}

/** The MMU consulted the process' page table for a page number. */
export interface PageTableLookupEvent extends EventBase {
  readonly type: "PAGE_TABLE_LOOKUP";
  readonly virtualAddress: VirtualAddress;
  readonly pageNumber: PageNumber;
  readonly pid: number;
}

/** The page table entry exists and has a frame: the page is in RAM. */
export interface PageTableHitEvent extends EventBase {
  readonly type: "PAGE_TABLE_HIT";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
}

/**
 * The MMU consulted the TLB for a translation. Emitted only by a machine that has a
 * TLB: a machine without one never runs this step, so it never claims to have.
 */
export interface TlbLookupEvent extends EventBase {
  readonly type: "TLB_LOOKUP";
  readonly virtualAddress: VirtualAddress;
  readonly pageNumber: PageNumber;
  readonly pid: number;
  /** Slots the MMU compared in parallel. */
  readonly entriesSearched: number;
}

/**
 * The TLB answered: the page -> frame translation was cached.
 *
 * This is where the page table is SKIPPED. Adding measurably fewer events is the
 * whole point of a TLB, and the event stream shows it.
 */
export interface TlbHitEvent extends EventBase {
  readonly type: "TLB_HIT";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  readonly slotIndex: number;
}

/**
 * The TLB could not answer. This is NOT a page fault: the MMU simply continues to
 * the page table, which is what decides whether the page is in RAM.
 */
export interface TlbMissEvent extends EventBase {
  readonly type: "TLB_MISS";
  readonly pageNumber: PageNumber;
  readonly reason: TlbMissReason;
  readonly entriesSearched: number;
}

/**
 * A translation from the page table was cached in the TLB, so the NEXT access to
 * this page can skip the page table.
 */
export interface TlbFillEvent extends EventBase {
  readonly type: "TLB_FILL";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  /** Slot the entry now occupies. */
  readonly slotIndex: number;
  /** Occupancy after the fill, for display. */
  readonly occupancy: number;
  readonly capacity: number;
  /** True when a cached translation had to leave to make room (FIFO). */
  readonly evicted: boolean;
}

/** The oldest cached translation left the TLB to make room for a new one. */
export interface TlbEvictEvent extends EventBase {
  readonly type: "TLB_EVICT";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  readonly slotIndex: number;
  readonly policy: TlbEvictionPolicy;
}

/**
 * A cached translation was dropped because it is no longer valid (the page was
 * unmapped or replaced). A stale entry must never stay usable.
 */
export interface TlbInvalidateEvent extends EventBase {
  readonly type: "TLB_INVALIDATE";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  readonly reason: TlbInvalidationReason;
}

/**
 * The page is NOT resident in RAM. Translation stops here: no frame, no physical
 * address, and no RAM access are produced. Fault *handling* is a later phase.
 */
export interface PageFaultEvent extends EventBase {
  readonly type: "PAGE_FAULT";
  readonly virtualAddress: VirtualAddress;
  readonly pageNumber: PageNumber;
  readonly offset: Offset;
  readonly access: AccessKind;
  readonly pid: number;
  readonly reason: PageFaultReason;
}

/**
 * A page's mapping was REMOVED: the page table no longer points it at a frame, and
 * the frame it used is free again.
 *
 * This is the mirror image of a page-table hit, and it is the operation that makes a
 * stale TLB entry dangerous: the translation the TLB cached a moment ago no longer
 * exists, so the same access must be dropped from the cache (see `TLB_INVALIDATE`).
 * Only emitted when a mapping really existed - unmapping an unmapped page changes
 * nothing and therefore reports nothing.
 */
export interface PageUnmappedEvent extends EventBase {
  readonly type: "PAGE_UNMAPPED";
  readonly pageNumber: PageNumber;
  /** The frame the page was released from. */
  readonly frameNumber: FrameNumber;
  readonly pid: number;
}

/** The translation resolved the page to a concrete physical frame. */
export interface FrameResolvedEvent extends EventBase {
  readonly type: "FRAME_RESOLVED";
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
}

/** The MMU combined frame number + offset into a physical address. */
export interface PhysicalAddressGeneratedEvent extends EventBase {
  readonly type: "PHYSICAL_ADDRESS_GENERATED";
  readonly virtualAddress: VirtualAddress;
  readonly physicalAddress: PhysicalAddress;
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  readonly offset: Offset;
  readonly pageSize: PageSize;
}

/** The CPU finally touched physical RAM. Only emitted after a successful translation. */
export interface RamAccessEvent extends EventBase {
  readonly type: "RAM_ACCESS";
  readonly physicalAddress: PhysicalAddress;
  readonly frameNumber: FrameNumber;
  readonly offset: Offset;
  readonly access: AccessKind;
}

/** Every event the engine can produce today. */
export type Event =
  | CpuMemoryAccessEvent
  | VirtualAddressGeneratedEvent
  | AddressSplitEvent
  | TlbLookupEvent
  | TlbHitEvent
  | TlbMissEvent
  | TlbFillEvent
  | TlbEvictEvent
  | TlbInvalidateEvent
  | PageTableLookupEvent
  | PageTableHitEvent
  | PageFaultEvent
  | PageUnmappedEvent
  | FrameResolvedEvent
  | PhysicalAddressGeneratedEvent
  | RamAccessEvent;

/** String literal union of all event tags, convenient for UI/timeline filtering. */
export type EventType = Event["type"];