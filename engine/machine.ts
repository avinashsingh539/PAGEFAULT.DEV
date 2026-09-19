/**
 * The machine: state construction and `step()`.
 *
 * `step(state, action)` is the single entry point of the engine and is PURE:
 *
 *   - it never mutates the state it is given,
 *   - it never reads a clock, a random number generator or any module-level variable,
 *   - it returns both the next state and the ordered list of events that explain it.
 *
 * Today the machine implements exactly one path, the one every later feature builds on:
 *
 *   Virtual Address -> Page + Offset -> Page Table -> Frame | PAGE FAULT
 *                                                    -> Physical Address -> RAM
 */

import { EngineError, assertUnreachable } from "./errors";
import { createPageTable, lookupPage, pageTableEntries } from "./memory/pageTable";
import { buildPhysicalAddress } from "./memory/physicalAddress";
import { translateAddress } from "./memory/translateAddress";
import {
  assertValidPageNumber,
  assertValidPageSize,
  assertValidVirtualAddress,
} from "./memory/validation";
import {
  TLB_EVICTION_POLICY,
  createTlbState,
  fillTlb,
  invalidateTlbPage,
  lookupTlb,
} from "./tlb/tlb";
import type { Action } from "./types/actions";
import type { Event } from "./types/events";
import type { MachineState, StepResult } from "./types/machine";
import type {
  AccessKind,
  FrameNumber,
  PageSize,
  PageTableEntry,
  PhysicalFrame,
} from "./types/memory";

/** 4 KiB: the page size used by the reference values in docs/ and by the CLI demo. */
export const DEFAULT_PAGE_SIZE: PageSize = 4096;

/** Physical RAM size, expressed in frames. */
export const DEFAULT_FRAME_COUNT = 16;

/** The TLB is a cache of translations; this is how many it holds when it is enabled. */
export const DEFAULT_TLB_CAPACITY = 4;

/** Description of the machine to build. */
export interface MachineConfig {
  /** Page size in bytes. Defaults to `DEFAULT_PAGE_SIZE`. */
  readonly pageSize?: PageSize;
  /** Number of frames in physical RAM. Defaults to `DEFAULT_FRAME_COUNT`. */
  readonly frameCount?: number;
  /** Process id. Defaults to 1. */
  readonly pid?: number;
  /** Human readable process name. Defaults to `"process-1"`. */
  readonly processName?: string;
  /** The initial page table of the process. */
  readonly pageTableEntries: readonly PageTableEntry[];
  /**
   * Number of entries in the TLB. Omitting it builds a machine WITHOUT a TLB, which
   * emits no TLB events at all and behaves exactly like the simpler machine every
   * earlier test was written against - a machine is never retroactively given a
   * component it was not configured with.
   */
  readonly tlbCapacity?: number;
}

export function createMachineState(config: MachineConfig): MachineState {
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  const frameCount = config.frameCount ?? DEFAULT_FRAME_COUNT;
  const pid = config.pid ?? 1;
  const name = config.processName ?? `process-${pid}`;

  assertValidPageSize(pageSize);
  assertFrameCount(frameCount);
  assertPid(pid);

  const pageTable = createPageTable(pageSize, config.pageTableEntries);
  const entries = pageTableEntries(pageTable);

  for (const entry of entries) {
    if (entry.frameNumber !== null && entry.frameNumber >= frameCount) {
      throw new EngineError(
        "INVALID_PAGE_TABLE",
        `page ${entry.pageNumber} maps to frame ${entry.frameNumber}, but physical memory only has ${frameCount} frames`,
      );
    }
  }

  return {
    cpu: {
      mode: "user",
      pendingFault: null,
    },
    process: {
      pid,
      name,
      pageTable,
      // A page table that knows about pages 0..n implies an address space of (n + 1) pages.
      virtualMemorySizeBytes: pageSize * (highestPageNumberOf(entries) + 1),
    },
    tlb:
      config.tlbCapacity === undefined
        ? // No TLB was configured: the state still describes that honestly, and no
          // TLB event is ever emitted, because there is nothing to consult.
          { enabled: false, capacity: DEFAULT_TLB_CAPACITY, entries: [] }
        : createTlbState(config.tlbCapacity),
    memory: {
      pageSize,
      frameCount,
      frames: createFrames(frameCount, entries, pid),
    },
    swap: {
      enabled: false,
      slots: [],
    },
    stats: {
      accesses: 0,
      translations: 0,
      pageFaults: 0,
      ramAccesses: 0,
    },
    sequence: 0,
  };
}

/**
 * Apply one action to the machine.
 *
 * Malformed actions (negative or non-integer addresses, ...) are rejected with an
 * `EngineError` BEFORE any event is produced: a bad request is not something the
 * simulated computer did, so it must never appear in the event stream.
 */
export function step(state: MachineState, action: Action): StepResult {
  switch (action.type) {
    case "ACCESS_ADDRESS":
      return stepAccessAddress(state, action);
    case "INVALIDATE_TLB":
      return stepInvalidateTlb(state, action);
    default:
      // Defensive: keeps `step` total (and the error honest) if the Action union
      // grows without a matching case above. The cast is required because the
      // compiler already proved this branch unreachable.
      return assertUnreachable(action as never, "step");
  }
}

/** The full memory-access path. Reads like the event sequence it emits, on purpose. */
function stepAccessAddress(
  state: MachineState,
  action: Extract<Action, { type: "ACCESS_ADDRESS" }>,
): StepResult {
  const virtualAddress = action.address;
  const access: AccessKind = action.access ?? "read";
  const { pageTable } = state.process;
  const { pageSize } = pageTable;

  assertValidVirtualAddress(virtualAddress);
  assertValidPageSize(pageSize);

  const events: Event[] = [];
  let sequence = state.sequence;
  const nextSequence = (): number => sequence++;

  // 1. The CPU issues a memory access.
  events.push({
    type: "CPU_MEMORY_ACCESS",
    sequence: nextSequence(),
    access,
    virtualAddress,
    pid: state.process.pid,
  });

  // 2. The CPU presents the virtual address to the MMU.
  events.push({
    type: "VIRTUAL_ADDRESS_GENERATED",
    sequence: nextSequence(),
    virtualAddress,
    pid: state.process.pid,
  });

  // 3. The MMU splits it into page number + offset.
  const split = translateAddress(virtualAddress, pageSize);
  events.push({
    type: "ADDRESS_SPLIT",
    sequence: nextSequence(),
    virtualAddress,
    pageSize,
    pageNumber: split.pageNumber,
    offset: split.offset,
  });

  // 4. The MMU consults the TLB, when the machine has one. A TLB HIT resolves the
  //    frame immediately and SKIPS the page table: that is the entire point of a
  //    TLB, and it is visible here as a shorter event path for the same answer.
  const tlb = state.tlb;
  let tlbAfterAccess = tlb;
  let frameNumber: FrameNumber | null = null;

  // The access counter is the only clock this engine has, and it is deterministic:
  // it identifies this access for FIFO TLB eviction without ever reading a clock.
  const fillOrder = state.stats.accesses;

  if (tlb.enabled) {
    events.push({
      type: "TLB_LOOKUP",
      sequence: nextSequence(),
      virtualAddress,
      pageNumber: split.pageNumber,
      pid: state.process.pid,
      entriesSearched: tlb.entries.length,
    });

    const cached = lookupTlb(tlb, split.pageNumber);

    if (cached.hit) {
      events.push({
        type: "TLB_HIT",
        sequence: nextSequence(),
        pageNumber: split.pageNumber,
        frameNumber: cached.frameNumber,
        slotIndex: cached.slotIndex,
      });
      frameNumber = cached.frameNumber;
    } else {
      // A miss is NOT a fault: it only means the MMU has to walk the page table.
      events.push({
        type: "TLB_MISS",
        sequence: nextSequence(),
        pageNumber: split.pageNumber,
        reason: cached.reason,
        entriesSearched: cached.entriesSearched,
      });
    }
  }

  // 5. Without a TLB answer, the page table decides - exactly as it did before a TLB
  //    existed. The TLB can therefore never change the OUTCOME of an access, only the
  //    number of steps needed to reach it.
  if (frameNumber === null) {
    events.push({
      type: "PAGE_TABLE_LOOKUP",
      sequence: nextSequence(),
      virtualAddress,
      pageNumber: split.pageNumber,
      pid: state.process.pid,
    });

    const lookup = lookupPage(pageTable, split.pageNumber);

    // 5a. Miss: the page is not in RAM. Translation STOPS here - there is no frame,
    //     no physical address and no RAM access.
    if (!lookup.present) {
      events.push({
        type: "PAGE_FAULT",
        sequence: nextSequence(),
        virtualAddress,
        pageNumber: split.pageNumber,
        offset: split.offset,
        access,
        pid: state.process.pid,
        reason: lookup.reason,
      });

      return {
        state: {
          ...state,
          cpu: {
            ...state.cpu,
            pendingFault: {
              virtualAddress,
              pageNumber: split.pageNumber,
              offset: split.offset,
              access,
              reason: lookup.reason,
            },
          },
          stats: {
            ...state.stats,
            accesses: state.stats.accesses + 1,
            pageFaults: state.stats.pageFaults + 1,
          },
          sequence,
        },
        events,
      };
    }

    // 5b. Hit: the page table names the frame holding this page.
    events.push({
      type: "PAGE_TABLE_HIT",
      sequence: nextSequence(),
      pageNumber: split.pageNumber,
      frameNumber: lookup.frameNumber,
    });

    frameNumber = lookup.frameNumber;

    // 5c. Cache the translation so the NEXT access to this page skips the page table.
    if (tlb.enabled) {
      const fill = fillTlb(tlb, split.pageNumber, lookup.frameNumber, fillOrder);

      if (fill.evicted !== null) {
        events.push({
          type: "TLB_EVICT",
          sequence: nextSequence(),
          pageNumber: fill.evicted.pageNumber,
          frameNumber: fill.evicted.frameNumber,
          slotIndex: fill.slotIndex,
          policy: TLB_EVICTION_POLICY,
        });
      }

      events.push({
        type: "TLB_FILL",
        sequence: nextSequence(),
        pageNumber: split.pageNumber,
        frameNumber: lookup.frameNumber,
        slotIndex: fill.slotIndex,
        occupancy: fill.tlb.entries.length,
        capacity: fill.tlb.capacity,
        evicted: fill.evicted !== null,
      });

      tlbAfterAccess = fill.tlb;
    }
  }

  // 6. The page is resolved to a frame of physical RAM.
  events.push({
    type: "FRAME_RESOLVED",
    sequence: nextSequence(),
    pageNumber: split.pageNumber,
    frameNumber,
  });

  // 7. Frame + offset become a physical address.
  const physicalAddress = buildPhysicalAddress(frameNumber, split.offset, pageSize);
  events.push({
    type: "PHYSICAL_ADDRESS_GENERATED",
    sequence: nextSequence(),
    virtualAddress,
    physicalAddress,
    pageNumber: split.pageNumber,
    frameNumber,
    offset: split.offset,
    pageSize,
  });

  // 8. The CPU touches physical RAM.
  events.push({
    type: "RAM_ACCESS",
    sequence: nextSequence(),
    physicalAddress,
    frameNumber,
    offset: split.offset,
    access,
  });

  return {
    state: {
      ...state,
      tlb: tlbAfterAccess,
      cpu: {
        ...state.cpu,
        pendingFault: null,
      },
      stats: {
        ...state.stats,
        accesses: state.stats.accesses + 1,
        translations: state.stats.translations + 1,
        ramAccesses: state.stats.ramAccesses + 1,
      },
      sequence,
    },
    events,
  };
}

/**
 * Drop one cached translation. This is the hardware's invalidation step, and it is
 * the ONLY thing that removes an entry other than eviction by capacity.
 *
 * Why it matters: a TLB entry is a copy of a page-table translation. If a page is
 * unmapped or replaced and the copy is left behind, the CPU would keep using a
 * translation that no longer exists - the classic stale-TLB bug. Invalidating a page
 * that is not cached is a no-op and produces NO event, because nothing happened.
 */
function stepInvalidateTlb(
  state: MachineState,
  action: Extract<Action, { type: "INVALIDATE_TLB" }>,
): StepResult {
  const { pageNumber } = action;

  assertValidPageNumber(pageNumber);

  if (!state.tlb.enabled) {
    throw new EngineError(
      "INVALID_MACHINE_CONFIG",
      "this machine has no TLB, so it has no cached translation to invalidate",
    );
  }

  const result = invalidateTlbPage(state.tlb, pageNumber);

  if (result.invalidated === null) {
    return { state, events: [] };
  }

  const events: Event[] = [
    {
      type: "TLB_INVALIDATE",
      sequence: state.sequence,
      pageNumber: result.invalidated.pageNumber,
      frameNumber: result.invalidated.frameNumber,
      reason: "EXPLICIT_INVALIDATION",
    },
  ];

  return {
    state: {
      ...state,
      tlb: result.tlb,
      sequence: state.sequence + 1,
    },
    events,
  };
}

/** Physical memory starts as one frame per slot, with the initial mappings recorded. */
function createFrames(
  frameCount: number,
  entries: readonly PageTableEntry[],
  pid: number,
): readonly PhysicalFrame[] {
  const frames: PhysicalFrame[] = [];

  for (let frameNumber: FrameNumber = 0; frameNumber < frameCount; frameNumber += 1) {
    const owner = entries.find((entry) => entry.frameNumber === frameNumber);
    frames.push({
      frameNumber,
      ownerPid: owner === undefined ? null : pid,
      pageNumber: owner === undefined ? null : owner.pageNumber,
    });
  }

  return frames;
}

function highestPageNumberOf(entries: readonly PageTableEntry[]): number {
  return entries.reduce((highest, entry) => Math.max(highest, entry.pageNumber), 0);
}

function assertFrameCount(frameCount: number): void {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    throw new EngineError(
      "INVALID_MACHINE_CONFIG",
      `frame count must be a positive integer, received ${String(frameCount)}`,
    );
  }
}

function assertPid(pid: number): void {
  if (!Number.isSafeInteger(pid) || pid < 0) {
    throw new EngineError(
      "INVALID_MACHINE_CONFIG",
      `pid must be a non-negative integer, received ${String(pid)}`,
    );
  }
}