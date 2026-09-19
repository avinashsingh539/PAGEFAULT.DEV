/**
 * TLB tests: the cache of translations, and the fact that it is only a cache.
 *
 * The properties this file exists to protect:
 *
 *   1. a TLB HIT resolves the page and SKIPS the page table (measurably fewer events),
 *   2. a TLB MISS is NOT a page fault - the page table still decides,
 *   3. the TLB only ever holds translations the page table agreed with,
 *   4. capacity is enforced by a documented, deterministic policy,
 *   5. an invalidated translation is no longer usable,
 *   6. a machine without a TLB emits no TLB events at all.
 *
 * All expected numbers are hand-calculated against the lab machine in
 * `engine/presets.ts`: pages 0->3, 1->7, 2->1, 3->5, 4->9 and 5->11 are resident,
 * page 6 is present-but-absent (faults) and page 7 has no entry at all (faults too),
 * with a 4096-byte page size and a 4-entry TLB.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TLB_CAPACITY,
  EngineError,
  LAB_PAGE_TABLE,
  LAB_TLB_CAPACITY,
  TLB_EVICTION_POLICY,
  createExampleMachine,
  createLabMachine,
  createMachineState,
  createTlbState,
  createTlbStateWithEntries,
  fillTlb,
  invalidateTlbPage,
  isTlbFull,
  lookupTlb,
  step,
  tlbEntries,
  tlbEntryFor,
  tlbOccupancy,
} from "../../engine";
import type {
  Action,
  Event,
  EventType,
  MachineState,
  TlbEntry,
  TlbState,
} from "../../engine";

const PAGE_SIZE = 4096;

/** A virtual address inside `pageNumber`, at `offset`. */
function addressOf(pageNumber: number, offset = 0): number {
  return pageNumber * PAGE_SIZE + offset;
}

function accessAddress(address: number): Action {
  return { type: "ACCESS_ADDRESS", address };
}

function invalidateTlb(pageNumber: number): Action {
  return { type: "INVALIDATE_TLB", pageNumber };
}

function eventTypes(events: readonly Event[]): EventType[] {
  return events.map((event) => event.type);
}

/** Fetch an event by type, failing loudly (and type-safely) when it is missing. */
function findEvent<T extends EventType>(events: readonly Event[], type: T): Extract<Event, { type: T }> {
  const event = events.find((candidate) => candidate.type === type);
  if (event === undefined) {
    throw new Error(`expected a ${type} event, got: [${eventTypes(events).join(", ")}]`);
  }
  return event as Extract<Event, { type: T }>;
}

/** The action the test expects to fail, and the error it produced. */
function expectEngineError(run: () => unknown): EngineError {
  try {
    run();
  } catch (error) {
    if (error instanceof EngineError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected an EngineError, but the call succeeded");
}

/** Freeze a value (and everything inside it), so any mutation throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

/** Page numbers currently cached in the TLB, in slot order. */
function cachedPages(tlb: TlbState): number[] {
  return tlbEntries(tlb).map((entry) => entry.pageNumber);
}

describe("the machine's TLB state", () => {
  it("is absent unless the machine was configured with one", () => {
    expect(createExampleMachine().tlb).toEqual({
      enabled: false,
      capacity: DEFAULT_TLB_CAPACITY,
      entries: [],
    });
  });

  it("starts empty and enabled on the lab machine", () => {
    const machine = createLabMachine();

    expect(machine.tlb.enabled).toBe(true);
    expect(machine.tlb.capacity).toBe(LAB_TLB_CAPACITY);
    expect(machine.tlb.entries).toEqual([]);
    expect(tlbOccupancy(machine.tlb)).toBe(0);
    expect(isTlbFull(machine.tlb)).toBe(false);
  });

  it("rejects a capacity that could never hold an entry", () => {
    for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const error = expectEngineError(() => createTlbState(capacity));

      expect(error.code).toBe("INVALID_TLB_CAPACITY");
      expect(error.message).toContain("positive integer");
    }

    expect(expectEngineError(() => createLabMachine({ tlbCapacity: 0 })).code).toBe(
      "INVALID_TLB_CAPACITY",
    );
  });

  it("builds a TLB with entries, and rejects impossible ones", () => {
    const entry: TlbEntry = { pageNumber: 1, frameNumber: 7, fillOrder: 0 };

    expect(createTlbStateWithEntries(2, [entry]).entries).toEqual([entry]);

    expect(expectEngineError(() => createTlbStateWithEntries(4, [entry, entry])).code).toBe(
      "INVALID_TLB_ENTRY",
    );
    expect(
      expectEngineError(() =>
        createTlbStateWithEntries(1, [entry, { pageNumber: 2, frameNumber: 3, fillOrder: 1 }]),
      ).code,
    ).toBe("INVALID_TLB_CAPACITY");
    expect(
      expectEngineError(() =>
        createTlbStateWithEntries(2, [{ pageNumber: -1, frameNumber: 3, fillOrder: 0 }]),
      ).code,
    ).toBe("INVALID_TLB_ENTRY");
    expect(
      expectEngineError(() =>
        createTlbStateWithEntries(2, [{ pageNumber: 1, frameNumber: -1, fillOrder: 0 }]),
      ).code,
    ).toBe("INVALID_TLB_ENTRY");
  });
});

describe("first access to a mapped page: miss, walk, fill, RAM", () => {
  it("follows the full path, in order, with contiguous sequence numbers", () => {
    const { events, state } = step(createLabMachine(), accessAddress(addressOf(0, 0x345)));

    expect(eventTypes(events)).toEqual([
      "CPU_MEMORY_ACCESS",
      "VIRTUAL_ADDRESS_GENERATED",
      "ADDRESS_SPLIT",
      "TLB_LOOKUP",
      "TLB_MISS",
      "PAGE_TABLE_LOOKUP",
      "PAGE_TABLE_HIT",
      "TLB_FILL",
      "FRAME_RESOLVED",
      "PHYSICAL_ADDRESS_GENERATED",
      "RAM_ACCESS",
    ]);
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(state.sequence).toBe(11);
  });

  it("describes the miss, the walk and the fill with hand-calculated values", () => {
    // page 0 -> frame 3, offset 0x345 (837) -> 3 * 4096 + 837 = 13125
    const { events, state } = step(createLabMachine(), accessAddress(addressOf(0, 0x345)));

    const lookup = findEvent(events, "TLB_LOOKUP");
    expect(lookup.pageNumber).toBe(0);
    expect(lookup.entriesSearched).toBe(0);

    const miss = findEvent(events, "TLB_MISS");
    expect(miss.pageNumber).toBe(0);
    expect(miss.reason).toBe("NOT_CACHED");
    expect(miss.entriesSearched).toBe(0);

    const fill = findEvent(events, "TLB_FILL");
    expect(fill.pageNumber).toBe(0);
    expect(fill.frameNumber).toBe(3);
    expect(fill.slotIndex).toBe(0);
    expect(fill.occupancy).toBe(1);
    expect(fill.capacity).toBe(LAB_TLB_CAPACITY);
    expect(fill.evicted).toBe(false);

    const physical = findEvent(events, "PHYSICAL_ADDRESS_GENERATED");
    expect(physical.frameNumber).toBe(3);
    expect(physical.offset).toBe(837);
    expect(physical.physicalAddress).toBe(3 * PAGE_SIZE + 837);
    expect(findEvent(events, "RAM_ACCESS").physicalAddress).toBe(3 * PAGE_SIZE + 837);

    // The translation is now cached, with the access index as its age.
    expect(state.tlb.entries).toEqual([{ pageNumber: 0, frameNumber: 3, fillOrder: 0 }]);
    expect(cachedPages(state.tlb)).toEqual([0]);
  });

  it("is NOT a page fault: a miss on a resident page faults nothing", () => {
    const { events, state } = step(createLabMachine(), accessAddress(addressOf(0)));

    expect(eventTypes(events)).not.toContain("PAGE_FAULT");
    expect(state.cpu.pendingFault).toBeNull();
    expect(state.stats).toEqual({
      accesses: 1,
      translations: 1,
      pageFaults: 0,
      ramAccesses: 1,
    });
  });
});

describe("second access to the same page: TLB hit, page table skipped", () => {
  /** Machine that has already touched page 0 once, so the TLB holds it. */
  function machineAfterFirstTouch(): MachineState {
    return step(createLabMachine(), accessAddress(addressOf(0, 0x345))).state;
  }

  it("resolves the frame from the TLB and never looks at the page table", () => {
    const { events, state } = step(machineAfterFirstTouch(), accessAddress(addressOf(0, 0x999)));

    expect(eventTypes(events)).toEqual([
      "CPU_MEMORY_ACCESS",
      "VIRTUAL_ADDRESS_GENERATED",
      "ADDRESS_SPLIT",
      "TLB_LOOKUP",
      "TLB_HIT",
      "FRAME_RESOLVED",
      "PHYSICAL_ADDRESS_GENERATED",
      "RAM_ACCESS",
    ]);

    // The page table is the thing a TLB exists to avoid touching.
    expect(eventTypes(events)).not.toContain("PAGE_TABLE_LOOKUP");
    expect(eventTypes(events)).not.toContain("PAGE_TABLE_HIT");
    expect(eventTypes(events)).not.toContain("TLB_MISS");
    expect(eventTypes(events)).not.toContain("TLB_FILL");
    expect(eventTypes(events)).not.toContain("PAGE_FAULT");

    const hit = findEvent(events, "TLB_HIT");
    expect(hit.pageNumber).toBe(0);
    expect(hit.frameNumber).toBe(3);
    expect(hit.slotIndex).toBe(0);

    // Same physical address the page-table walk produced for this offset before.
    expect(findEvent(events, "PHYSICAL_ADDRESS_GENERATED").physicalAddress).toBe(
      3 * PAGE_SIZE + 0x999,
    );

    // The hit did not re-fill the TLB, and did not age the entry either.
    expect(state.tlb.entries).toEqual([{ pageNumber: 0, frameNumber: 3, fillOrder: 0 }]);
    expect(state.stats.translations).toBe(2);
  });

  it("is measurably cheaper than the miss that preceded it", () => {
    const miss = step(createLabMachine(), accessAddress(addressOf(0, 0x345)));
    const hit = step(miss.state, accessAddress(addressOf(0, 0x999)));

    expect(miss.events.length).toBe(11);
    expect(hit.events.length).toBe(8);
    expect(hit.events.length).toBeLessThan(miss.events.length);
  });

  it("is deterministic: the same two accesses give the same two results", () => {
    const runA = step(machineAfterFirstTouch(), accessAddress(addressOf(0, 0x999)));
    const runB = step(machineAfterFirstTouch(), accessAddress(addressOf(0, 0x999)));

    expect(runB.events).toEqual(runA.events);
    expect(runB.state).toEqual(runA.state);
    expect(runB.state.tlb).toEqual(runA.state.tlb);
  });

  it("gives the same physical address as the page-table path for every page", () => {
    // The TLB may only change how, never what: for each mapped page, the address
    // produced after a fill must equal the one produced by a cold walk.
    for (const [pageNumber, frameNumber] of [
      [0, 3],
      [1, 7],
      [2, 1],
      [3, 5],
      [4, 9],
      [5, 11],
    ] as const) {
      const cold = step(createLabMachine(), accessAddress(addressOf(pageNumber, 0x40)));
      const warm = step(cold.state, accessAddress(addressOf(pageNumber, 0x40)));

      const coldAddress = findEvent(cold.events, "PHYSICAL_ADDRESS_GENERATED").physicalAddress;
      const warmAddress = findEvent(warm.events, "PHYSICAL_ADDRESS_GENERATED").physicalAddress;

      expect(coldAddress).toBe(frameNumber * PAGE_SIZE + 0x40);
      expect(warmAddress).toBe(coldAddress);
      expect(eventTypes(warm.events)).toContain("TLB_HIT");
    }
  });

  it("misses again for a different page, then hits on that page too", () => {
    const first = step(machineAfterFirstTouch(), accessAddress(addressOf(4)));
    const second = step(first.state, accessAddress(addressOf(4)));

    expect(eventTypes(first.events)).toContain("TLB_MISS");
    expect(eventTypes(first.events)).toContain("TLB_FILL");
    expect(eventTypes(second.events)).toContain("TLB_HIT");
    expect(cachedPages(second.state.tlb)).toEqual([0, 4]);
    expect(second.state.tlb.entries[1]).toEqual({
      pageNumber: 4,
      frameNumber: 9,
      fillOrder: 1,
    });
  });
});

describe("access to an unmapped page: miss, walk, PAGE FAULT, nothing else", () => {
  it("stops at the fault and never resolves a frame, an address or RAM", () => {
    // page 6 exists in the page table but is not resident: 6 * 4096 + 100 = 24676
    const { events, state } = step(createLabMachine(), accessAddress(addressOf(6, 100)));

    expect(eventTypes(events)).toEqual([
      "CPU_MEMORY_ACCESS",
      "VIRTUAL_ADDRESS_GENERATED",
      "ADDRESS_SPLIT",
      "TLB_LOOKUP",
      "TLB_MISS",
      "PAGE_TABLE_LOOKUP",
      "PAGE_FAULT",
    ]);

    expect(eventTypes(events)).not.toContain("TLB_FILL");
    expect(eventTypes(events)).not.toContain("FRAME_RESOLVED");
    expect(eventTypes(events)).not.toContain("PHYSICAL_ADDRESS_GENERATED");
    expect(eventTypes(events)).not.toContain("RAM_ACCESS");

    const fault = findEvent(events, "PAGE_FAULT");
    expect(fault.pageNumber).toBe(6);
    expect(fault.offset).toBe(100);
    expect(fault.reason).toBe("PAGE_NOT_PRESENT");

    // A fault must not poison the TLB with a translation that does not exist.
    expect(state.tlb.entries).toEqual([]);
    expect(state.stats).toEqual({
      accesses: 1,
      translations: 0,
      pageFaults: 1,
      ramAccesses: 0,
    });
    expect(state.cpu.pendingFault?.pageNumber).toBe(6);
  });

  it("faults the same way on a page with no page-table entry at all", () => {
    const { events } = step(createLabMachine(), accessAddress(addressOf(7, 0)));

    expect(findEvent(events, "PAGE_FAULT").pageNumber).toBe(7);
    expect(eventTypes(events)).toContain("TLB_MISS");
    expect(eventTypes(events)).not.toContain("TLB_FILL");
    expect(eventTypes(events)).not.toContain("RAM_ACCESS");
  });

  it("keeps a previously cached translation when another page faults", () => {
    const cached = step(createLabMachine(), accessAddress(addressOf(1))).state;
    const faulted = step(cached, accessAddress(addressOf(6)));

    // The fault says nothing about page 1, which is still resident and still cached.
    expect(faulted.state.tlb.entries).toEqual(cached.tlb.entries);
    expect(faulted.state.stats.pageFaults).toBe(1);
  });

  it("still hits on a cached page after an unrelated fault", () => {
    const cached = step(createLabMachine(), accessAddress(addressOf(1))).state;
    const faulted = step(cached, accessAddress(addressOf(6))).state;
    const afterFault = step(faulted, accessAddress(addressOf(1, 0x20)));

    expect(eventTypes(afterFault.events)).toContain("TLB_HIT");
    expect(findEvent(afterFault.events, "RAM_ACCESS").physicalAddress).toBe(7 * PAGE_SIZE + 0x20);
  });
});

describe("capacity: filling up and evicting deterministically", () => {
  /** Touch pages 0..5 in order on a machine whose TLB holds 4 entries. */
  function touchSixPages(): readonly Event[][] {
    let machine = createLabMachine();
    const perAccess: Event[][] = [];

    for (const pageNumber of [0, 1, 2, 3, 4, 5]) {
      const result = step(machine, accessAddress(addressOf(pageNumber)));
      machine = result.state;
      perAccess.push([...result.events]);
    }

    return perAccess;
  }

  it("fills free slots first, in arrival order", () => {
    const accesses = touchSixPages();

    for (const [index, events] of accesses.slice(0, 4).entries()) {
      const fill = findEvent(events, "TLB_FILL");

      expect(fill.slotIndex).toBe(index);
      expect(fill.occupancy).toBe(index + 1);
      expect(fill.evicted).toBe(false);
      expect(eventTypes(events)).not.toContain("TLB_EVICT");
    }
  });

  it("evicts the oldest entry (FIFO) once every slot is taken", () => {
    const accesses = touchSixPages();

    // Access 4 (page 4): the TLB holds pages 0,1,2,3 and page 0 arrived first.
    const fourth = accesses[4] ?? [];
    const evict = findEvent(fourth, "TLB_EVICT");
    expect(evict.pageNumber).toBe(0);
    expect(evict.frameNumber).toBe(3);
    expect(evict.slotIndex).toBe(0);
    expect(evict.policy).toBe(TLB_EVICTION_POLICY);

    const fill = findEvent(fourth, "TLB_FILL");
    expect(fill.pageNumber).toBe(4);
    expect(fill.slotIndex).toBe(0);
    expect(fill.evicted).toBe(true);
    expect(fill.occupancy).toBe(LAB_TLB_CAPACITY);

    // Access 5 (page 5): page 1 is now the oldest.
    const fifth = accesses[5] ?? [];
    expect(findEvent(fifth, "TLB_EVICT").pageNumber).toBe(1);
    expect(findEvent(fifth, "TLB_FILL").pageNumber).toBe(5);
  });

  it("ends up holding exactly the four newest pages, in slot order", () => {
    const machine = touchSixPages();
    let state = createLabMachine();

    for (const pageNumber of [0, 1, 2, 3, 4, 5]) {
      state = step(state, accessAddress(addressOf(pageNumber))).state;
    }

    expect(machine.length).toBe(6);
    expect(cachedPages(state.tlb)).toEqual([4, 5, 2, 3]);
    expect(tlbOccupancy(state.tlb)).toBe(4);
    expect(isTlbFull(state.tlb)).toBe(true);
    expect(state.tlb.entries).toEqual([
      { pageNumber: 4, frameNumber: 9, fillOrder: 4 },
      { pageNumber: 5, frameNumber: 11, fillOrder: 5 },
      { pageNumber: 2, frameNumber: 1, fillOrder: 2 },
      { pageNumber: 3, frameNumber: 5, fillOrder: 3 },
    ]);
  });

  it("misses on an evicted page and hits on a surviving one", () => {
    let state = createLabMachine();
    for (const pageNumber of [0, 1, 2, 3, 4, 5]) {
      state = step(state, accessAddress(addressOf(pageNumber))).state;
    }

    const evicted = step(state, accessAddress(addressOf(0))); // page 0 was evicted
    const surviving = step(evicted.state, accessAddress(addressOf(3))); // page 3 survived

    expect(eventTypes(evicted.events)).toContain("TLB_MISS");
    expect(eventTypes(evicted.events)).toContain("PAGE_TABLE_LOOKUP");
    expect(eventTypes(evicted.events)).toContain("TLB_FILL");
    expect(eventTypes(surviving.events)).toContain("TLB_HIT");
    expect(eventTypes(surviving.events)).not.toContain("PAGE_TABLE_LOOKUP");

    expect(findEvent(surviving.events, "RAM_ACCESS").physicalAddress).toBe(5 * PAGE_SIZE);
  });

  it("behaves identically on a one-entry TLB: every new page evicts the last", () => {
    let machine = createLabMachine({ tlbCapacity: 1 });

    const first = step(machine, accessAddress(addressOf(0)));
    machine = first.state;
    expect(findEvent(first.events, "TLB_FILL").occupancy).toBe(1);
    expect(eventTypes(first.events)).not.toContain("TLB_EVICT");

    const second = step(machine, accessAddress(addressOf(2)));
    machine = second.state;
    expect(findEvent(second.events, "TLB_EVICT").pageNumber).toBe(0);
    expect(cachedPages(machine.tlb)).toEqual([2]);

    const repeat = step(machine, accessAddress(addressOf(2)));
    expect(eventTypes(repeat.events)).toContain("TLB_HIT");
  });
});

describe("invalidation: a stale translation must not stay usable", () => {
  it("drops one entry and reports it, leaving the rest untouched", () => {
    let machine = createLabMachine();
    machine = step(machine, accessAddress(addressOf(0))).state;
    machine = step(machine, accessAddress(addressOf(2))).state;

    const { events, state } = step(machine, invalidateTlb(0));

    expect(eventTypes(events)).toEqual(["TLB_INVALIDATE"]);
    expect(events[0]?.sequence).toBe(machine.sequence);

    const invalidated = findEvent(events, "TLB_INVALIDATE");
    expect(invalidated.pageNumber).toBe(0);
    expect(invalidated.frameNumber).toBe(3);
    expect(invalidated.reason).toBe("EXPLICIT_INVALIDATION");

    expect(cachedPages(state.tlb)).toEqual([2]);
    expect(state.sequence).toBe(machine.sequence + 1);
  });

  it("makes the next access to that page walk the page table again", () => {
    let machine = createLabMachine();
    machine = step(machine, accessAddress(addressOf(0))).state;

    const before = step(machine, accessAddress(addressOf(0)));
    expect(eventTypes(before.events)).toContain("TLB_HIT");

    machine = step(machine, invalidateTlb(0)).state;
    const after = step(machine, accessAddress(addressOf(0)));

    expect(eventTypes(after.events)).toContain("TLB_MISS");
    expect(eventTypes(after.events)).toContain("PAGE_TABLE_LOOKUP");
    expect(eventTypes(after.events)).toContain("TLB_FILL");
    expect(eventTypes(after.events)).not.toContain("TLB_HIT");

    // The invalidation changed the path, never the answer.
    expect(findEvent(after.events, "RAM_ACCESS").physicalAddress).toBe(3 * PAGE_SIZE);
  });

  it("is a no-op, and silent, for a page that was never cached", () => {
    const machine = step(createLabMachine(), accessAddress(addressOf(0))).state;
    const { events, state } = step(machine, invalidateTlb(5));

    expect(events).toEqual([]);
    expect(state).toBe(machine);
    expect(state.sequence).toBe(machine.sequence);
  });

  it("is a no-op for a page that does not exist in the address space", () => {
    const machine = createLabMachine();
    const { events } = step(machine, invalidateTlb(9999));

    expect(events).toEqual([]);
  });

  it("rejects an invalid page number instead of silently doing nothing", () => {
    for (const pageNumber of [-1, 1.5, Number.NaN]) {
      expect(expectEngineError(() => step(createLabMachine(), invalidateTlb(pageNumber))).code).toBe(
        "INVALID_PAGE_NUMBER",
      );
    }
  });

  it("refuses to invalidate on a machine that has no TLB", () => {
    const error = expectEngineError(() => step(createExampleMachine(), invalidateTlb(0)));

    expect(error.code).toBe("INVALID_MACHINE_CONFIG");
    expect(error.message).toContain("no TLB");
  });

  it("keeps every remaining entry consistent with the page table", () => {
    // The TLB is only ever filled FROM the page table, so every cached frame must
    // still be the frame the page table names for that page.
    let machine = createLabMachine();
    for (const pageNumber of [0, 1, 2, 3, 4, 5]) {
      machine = step(machine, accessAddress(addressOf(pageNumber))).state;
    }

    for (const entry of tlbEntries(machine.tlb)) {
      const tableEntry = machine.process.pageTable.entries[entry.pageNumber];

      expect(tableEntry?.present).toBe(true);
      expect(tableEntry?.frameNumber).toBe(entry.frameNumber);
    }
  });
});

describe("determinism and purity", () => {
  it("produces identical state and events for identical input", () => {
    const actions = [
      accessAddress(addressOf(0)),
      accessAddress(addressOf(0, 0x10)),
      accessAddress(addressOf(2)),
      accessAddress(addressOf(6)),
      accessAddress(addressOf(4)),
      invalidateTlb(0),
      accessAddress(addressOf(0)),
    ];

    const runA = replay(actions);
    const runB = replay(actions);

    expect(runB.events).toEqual(runA.events);
    expect(runB.state).toEqual(runA.state);
    expect(runB.state.tlb).toEqual(runA.state.tlb);
  });

  it("keeps the event numbering contiguous across accesses and invalidations", () => {
    const machine = createLabMachine();

    const first = step(machine, accessAddress(addressOf(0)));
    const second = step(first.state, accessAddress(addressOf(0)));
    const third = step(second.state, invalidateTlb(0));

    expect(first.events[0]?.sequence).toBe(0);
    expect(first.events.at(-1)?.sequence).toBe(10);
    expect(second.events[0]?.sequence).toBe(11);
    expect(third.events[0]?.sequence).toBe(second.state.sequence);
    expect(third.state.sequence).toBe(second.state.sequence + 1);
  });

  it("never mutates the state it is given, even when the TLB is touched", () => {
    const machine = createLabMachine();
    const afterTouch = step(machine, accessAddress(addressOf(0))).state;
    const before = JSON.stringify(afterTouch);

    step(afterTouch, accessAddress(addressOf(2)));
    step(afterTouch, accessAddress(addressOf(0))); // a hit: must not mutate either
    step(afterTouch, invalidateTlb(0));

    expect(JSON.stringify(afterTouch)).toBe(before);
  });

  it("works on a deeply frozen state", () => {
    const frozen = deepFreeze(step(createLabMachine(), accessAddress(addressOf(0))).state);

    const hit = step(frozen, accessAddress(addressOf(0, 0x24)));
    expect(eventTypes(hit.events)).toContain("TLB_HIT");
    expect(frozen.tlb.entries).toHaveLength(1);
  });

  it("returns fresh TLB values, so a finished result cannot be altered by its caller", () => {
    const machine = createLabMachine();
    const result = step(machine, accessAddress(addressOf(0)));

    expect(result.state.tlb).not.toBe(machine.tlb);
    expect(result.state.tlb.entries).not.toBe(machine.tlb.entries);
    expect(machine.tlb.entries).toEqual([]);
  });
});

describe("a machine without a TLB", () => {
  it("emits no TLB event at all, on a hit or on a fault", () => {
    const machine = createExampleMachine();

    const first = step(machine, accessAddress(addressOf(0)));
    const second = step(first.state, accessAddress(addressOf(0)));
    const fault = step(second.state, accessAddress(addressOf(3)));

    for (const result of [first, second, fault]) {
      expect(eventTypes(result.events).some((type) => type.startsWith("TLB_"))).toBe(false);
    }

    // Exactly the 8-event path Day 1 defined, with no extra steps.
    expect(first.events).toHaveLength(8);
    expect(second.events).toHaveLength(8);
    expect(fault.events).toHaveLength(5);
  });

  it("never gains a TLB entry, because it has no TLB", () => {
    const machine = step(createExampleMachine(), accessAddress(addressOf(0))).state;

    expect(machine.tlb.enabled).toBe(false);
    expect(machine.tlb.entries).toEqual([]);
  });

  it("reaches the same results as a machine that has one", () => {
    // Same page table, same accesses; only the equipped machine has a TLB.
    const plain = createMachineState({
      pageSize: PAGE_SIZE,
      frameCount: 16,
      pageTableEntries: [...LAB_PAGE_TABLE],
    });
    const equipped = createLabMachine();

    const addresses = [0, 0, 2, 6, 3, 3].map((page) => addressOf(page));
    const plainRun = replayOn(plain, addresses.map(accessAddress));
    const equippedRun = replayOn(equipped, addresses.map(accessAddress));

    // The TLB may change the PATH, never the OUTCOME: the per-access results and
    // every counter must be identical.
    expect(accessSummaries(equipped, addresses)).toEqual(accessSummaries(plain, addresses));
    expect(equippedRun.state.stats).toEqual(plainRun.state.stats);
    expect(equippedRun.state.cpu).toEqual(plainRun.state.cpu);
    expect(equippedRun.state.process.pageTable).toEqual(plainRun.state.process.pageTable);

    // Only misses walk the page table, so the equipped machine consults it far less
    // often. This - not a lower event count - is the saving a TLB actually buys.
    expect(countEvents(plainRun.events, "PAGE_TABLE_LOOKUP")).toBe(6);
    expect(countEvents(equippedRun.events, "PAGE_TABLE_LOOKUP")).toBe(4);
    expect(countEvents(equippedRun.events, "TLB_HIT")).toBe(2);

    // A hit costs the same number of events as a page-table hit, but a cold miss pays
    // three extra steps (lookup, miss, fill) for the fills that make hits possible.
    const plainCounts = accessEventCounts(plain, addresses);
    const equippedCounts = accessEventCounts(equipped, addresses);
    expect(equippedCounts[1]).toBe(plainCounts[1] ?? 0);
    expect(equippedCounts[0]).toBeGreaterThan(plainCounts[0] ?? 0);
  });
});

describe("the TLB module on hand-built states", () => {
  const cached: readonly TlbEntry[] = [
    { pageNumber: 1, frameNumber: 7, fillOrder: 0 },
    { pageNumber: 2, frameNumber: 1, fillOrder: 5 },
  ];

  it("finds an entry and reports its slot", () => {
    const tlb = createTlbStateWithEntries(4, cached);
    const hit = lookupTlb(tlb, 2);

    expect(hit.hit).toBe(true);
    expect(hit.hit && hit.frameNumber).toBe(1);
    expect(hit.hit && hit.slotIndex).toBe(1);
    expect(hit.hit && hit.entry.fillOrder).toBe(5);
    expect(tlbEntryFor(tlb, 2)).toEqual(cached[1]);
  });

  it("reports a miss with the number of entries it searched", () => {
    const tlb = createTlbStateWithEntries(4, cached);
    const miss = lookupTlb(tlb, 9);

    expect(miss.hit).toBe(false);
    expect(miss.hit === false && miss.reason).toBe("NOT_CACHED");
    expect(miss.hit === false && miss.entriesSearched).toBe(2);
    expect(tlbEntryFor(tlb, 9)).toBeNull();
  });

  it("appends while there is room", () => {
    const filled = fillTlb(createTlbState(4), 1, 7, 0);

    expect(filled.evicted).toBeNull();
    expect(filled.slotIndex).toBe(0);
    expect(filled.tlb.entries).toEqual([{ pageNumber: 1, frameNumber: 7, fillOrder: 0 }]);
    expect(filled.tlb.capacity).toBe(4);
  });

  it("evicts the oldest fill order when full (FIFO) and reuses its slot", () => {
    const tlb = createTlbStateWithEntries(2, cached);
    const filled = fillTlb(tlb, 3, 5, 9);

    expect(filled.evicted).toEqual(cached[0]);
    expect(filled.slotIndex).toBe(0);
    expect(filled.tlb.entries).toEqual([
      { pageNumber: 3, frameNumber: 5, fillOrder: 9 },
      { pageNumber: 2, frameNumber: 1, fillOrder: 5 },
    ]);
    expect(tlbOccupancy(filled.tlb)).toBe(2);
    expect(isTlbFull(filled.tlb)).toBe(true);
  });

  it("updates an already cached page in place instead of evicting", () => {
    const filled = fillTlb(createTlbStateWithEntries(2, cached), 1, 9, 3);

    expect(filled.evicted).toBeNull();
    expect(filled.slotIndex).toBe(0);
    expect(filled.tlb.entries).toEqual([
      { pageNumber: 1, frameNumber: 9, fillOrder: 3 },
      { pageNumber: 2, frameNumber: 1, fillOrder: 5 },
    ]);
  });

  it("invalidates one page and compacts the slots", () => {
    const tlb = createTlbStateWithEntries(4, cached);
    const result = invalidateTlbPage(tlb, 1);

    expect(result.invalidated).toEqual(cached[0]);
    expect(result.tlb.entries).toEqual([{ pageNumber: 2, frameNumber: 1, fillOrder: 5 }]);
    expect(invalidateTlbPage(result.tlb, 1).invalidated).toBeNull();
    expect(invalidateTlbPage(tlb, 42).tlb).toBe(tlb);
  });

  it("evicts by fill order, not by slot order", () => {
    // Slot order and age disagree on purpose: slot 0 holds the NEWER entry.
    const tlb = createTlbStateWithEntries(2, [
      { pageNumber: 4, frameNumber: 9, fillOrder: 8 },
      { pageNumber: 5, frameNumber: 11, fillOrder: 2 },
    ]);
    const filled = fillTlb(tlb, 6, 13, 9);

    expect(filled.evicted?.pageNumber).toBe(5);
    expect(filled.slotIndex).toBe(1);
    expect(cachedPages(filled.tlb)).toEqual([4, 6]);
  });
});

/** Replay a list of actions from a fresh lab machine. */
function replay(actions: readonly Action[]): { state: MachineState; events: Event[] } {
  return replayOn(createLabMachine(), actions);
}

/** Replay a list of actions from a given machine, collecting every event in order. */
function replayOn(
  machine: MachineState,
  actions: readonly Action[],
): { state: MachineState; events: Event[] } {
  let state = machine;
  const events: Event[] = [];

  for (const action of actions) {
    const result = step(state, action);
    state = result.state;
    events.push(...result.events);
  }

  return { state, events };
}

/** How many events of one type a run produced. */
function countEvents(events: readonly Event[], type: EventType): number {
  return events.filter((event) => event.type === type).length;
}

/** How many events each access produced. */
function accessEventCounts(machine: MachineState, addresses: readonly number[]): number[] {
  let state = machine;
  const counts: number[] = [];

  for (const address of addresses) {
    const result = step(state, accessAddress(address));
    state = result.state;
    counts.push(result.events.length);
  }

  return counts;
}

/**
 * One line per access describing what the machine actually achieved: the physical
 * address it touched, or the page it faulted on. Used to prove that a TLB changes the
 * route and never the destination.
 */
function accessSummaries(machine: MachineState, addresses: readonly number[]): string[] {
  let state = machine;
  const summaries: string[] = [];

  for (const address of addresses) {
    const result = step(state, accessAddress(address));
    state = result.state;

    const ram = result.events.find((event) => event.type === "RAM_ACCESS");
    const fault = result.events.find((event) => event.type === "PAGE_FAULT");

    summaries.push(
      ram?.type === "RAM_ACCESS"
        ? `RAM ${ram.physicalAddress} via frame ${ram.frameNumber}`
        : `FAULT page ${fault?.type === "PAGE_FAULT" ? fault.pageNumber : "?"}`,
    );
  }

  return summaries;
}