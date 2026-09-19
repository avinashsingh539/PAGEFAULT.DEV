/**
 * Machine state - the complete, serialisable snapshot of the simulated computer.
 *
 * Everything the engine needs to continue from belongs here; nothing is kept in
 * module-level mutable variables. Given the same state and the same action, the
 * engine must always produce the same next state and the same events.
 *
 * Growth plan (types are already in place, behaviour is NOT implemented today):
 *   - `tlb`    : TLB lookups / hits / misses
 *   - `swap`   : pages evicted to disk
 *   - `memory` : page replacement algorithms (FIFO / LRU / Optimal)
 *   - `cpu`    : user <-> kernel mode transitions, context switches
 */

import type { Event } from "./events";
import type {
  AccessKind,
  FrameNumber,
  Offset,
  PageNumber,
  PageTable,
  PhysicalMemory,
  VirtualAddress,
} from "./memory";

/** Execution mode of the simulated CPU. Only "user" is ever entered today. */
export type CpuMode = "user" | "kernel";

/**
 * A memory access that could not complete because its page is not in RAM.
 *
 * Today this is recorded as an observable fact only: handling the fault
 * (kernel transition, disk I/O, page replacement) is a later phase.
 */
export interface PendingPageFault {
  readonly virtualAddress: VirtualAddress;
  readonly pageNumber: PageNumber;
  readonly offset: Offset;
  readonly access: AccessKind;
  readonly reason: "PAGE_NOT_PRESENT";
}

export interface CpuState {
  readonly mode: CpuMode;
  /** Set when the last access faulted and cleared by the next successful access. */
  readonly pendingFault: PendingPageFault | null;
}

export interface ProcessState {
  readonly pid: number;
  readonly name: string;
  /** The page table belongs to the process (cf. the MMU's page-table base register). */
  readonly pageTable: PageTable;
  /** Size of the process' virtual address space in bytes, given its page table. */
  readonly virtualMemorySizeBytes: number;
}

/**
 * The Translation Lookaside Buffer - a small hardware cache of translations.
 *
 * WHAT IT IS: a list of (page -> frame) pairs that the MMU keeps after a successful
 * page-table lookup, so the next access to the same page never has to consult the
 * page table at all. It caches TRANSLATIONS ONLY: a TLB entry says "page 18 is in
 * frame 7", never "page 18 is present in RAM". That is why a TLB miss is NOT a page
 * fault - the hardware simply falls back to the page table.
 *
 * `fillOrder` is the deterministic age of the entry: it is the value of the access
 * counter when the entry was written. When the TLB is full, the entry with the
 * smallest `fillOrder` leaves first - a plain FIFO policy, chosen because it needs
 * no clock and no reference bits, and because its behaviour is easy to explain and
 * test. (Real hardware often uses LRU or random; this engine stays deterministic.)
 */
export interface TlbEntry {
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  /** Access counter value when this entry was filled. Used only for FIFO eviction. */
  readonly fillOrder: number;
}

/**
 * The TLB as machine state.
 *
 * `enabled` is a property of the MACHINE, not of an access: a machine built without
 * a TLB never emits TLB events at all, because it has no TLB to consult. This keeps
 * a machine with no TLB byte-for-byte the behaviour of the simpler Day 1 machine.
 *
 * The TLB is not a second source of truth: it is only ever filled from a page-table
 * hit, and an entry that the page table no longer agrees with is invalidated.
 */
export interface TlbState {
  readonly enabled: boolean;
  /** Number of entries the TLB can hold. Always a positive integer when enabled. */
  readonly capacity: number;
  readonly entries: readonly TlbEntry[];
}


/** A page that has been moved out of RAM. Populated once swap exists. */
export interface SwapPage {
  readonly pageNumber: PageNumber;
  readonly pid: number;
}

export interface SwapState {
  readonly enabled: boolean;
  readonly slots: readonly SwapPage[];
}

/** Deterministic counters. Derived only from executed actions - never from a clock. */
export interface MachineStats {
  readonly accesses: number;
  readonly translations: number;
  readonly pageFaults: number;
  readonly ramAccesses: number;
}

export interface MachineState {
  readonly cpu: CpuState;
  readonly process: ProcessState;
  readonly tlb: TlbState;
  readonly memory: PhysicalMemory;
  readonly swap: SwapState;
  readonly stats: MachineStats;
  /** Monotonic event counter used to number the events produced so far. */
  readonly sequence: number;
}

/** What `step()` returns: the next state plus the truthful ordered events. */
export interface StepResult {
  readonly state: MachineState;
  readonly events: readonly Event[];
}