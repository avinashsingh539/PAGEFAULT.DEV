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
  | PageTableLookupEvent
  | PageTableHitEvent
  | PageFaultEvent
  | FrameResolvedEvent
  | PhysicalAddressGeneratedEvent
  | RamAccessEvent;

/** String literal union of all event tags, convenient for UI/timeline filtering. */
export type EventType = Event["type"];