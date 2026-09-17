/**
 * Machine tests: `step(state, action)`.
 *
 * These tests pin down the two behaviours the whole product depends on:
 *
 *   1. a successful access produces the full 8-event translation path, and
 *   2. a faulting access produces a PAGE_FAULT and NOTHING after it
 *      (no frame, no physical address, no RAM access).
 *
 * They also pin down purity: the engine must not mutate the state it is given,
 * and identical input must always produce identical output.
 */

import { describe, expect, it } from "vitest";

import {
  EngineError,
  absentEntry,
  createExampleMachine,
  createMachineState,
  presentEntry,
  step,
} from "../../engine";
import type { Action, Event, MachineState } from "../../engine";

const PAGE_SIZE = 4096;

/** Machine with page 18 -> frame 7 (present) and page 3 -> not present. */
function machineWithPage18(): MachineState {
  return createMachineState({
    pageSize: PAGE_SIZE,
    frameCount: 16,
    pageTableEntries: [presentEntry(18, 7), absentEntry(3)],
  });
}

function accessAddress(address: number, access?: "read" | "write"): Action {
  return access === undefined
    ? { type: "ACCESS_ADDRESS", address }
    : { type: "ACCESS_ADDRESS", address, access };
}

function eventTypes(events: readonly Event[]): string[] {
  return events.map((event) => event.type);
}

/** Fetch an event by type, failing loudly (and type-safely) when it is missing. */
function findEvent<T extends Event["type"]>(
  events: readonly Event[],
  type: T,
): Extract<Event, { type: T }> {
  const event = events.find((candidate) => candidate.type === type);
  if (event === undefined) {
    throw new Error(`expected a ${type} event, got: [${eventTypes(events).join(", ")}]`);
  }
  return event as Extract<Event, { type: T }>;
}

describe("createMachineState", () => {
  it("starts clean: no accesses, no faults and no events yet", () => {
    const machine = machineWithPage18();

    expect(machine.stats).toEqual({
      accesses: 0,
      translations: 0,
      pageFaults: 0,
      ramAccesses: 0,
    });
    expect(machine.sequence).toBe(0);
    expect(machine.cpu.mode).toBe("user");
    expect(machine.cpu.pendingFault).toBeNull();
  });

  it("creates placeholder containers for the future TLB and swap phases", () => {
    const machine = machineWithPage18();

    expect(machine.tlb).toEqual({ enabled: false, capacity: 4, entries: [] });
    expect(machine.swap).toEqual({ enabled: false, slots: [] });
  });
});

describe("step ACCESS_ADDRESS - successful translation", () => {
  it("emits the full translation path in order", () => {
    const { events } = step(machineWithPage18(), accessAddress(0x12345));

    expect(eventTypes(events)).toEqual([
      "CPU_MEMORY_ACCESS",
      "VIRTUAL_ADDRESS_GENERATED",
      "ADDRESS_SPLIT",
      "PAGE_TABLE_LOOKUP",
      "PAGE_TABLE_HIT",
      "FRAME_RESOLVED",
      "PHYSICAL_ADDRESS_GENERATED",
      "RAM_ACCESS",
    ]);
  });

  it("carries the hand-calculated values through the events", () => {
    // 0x12345 = 74565 -> page 18, offset 837 -> frame 7 -> 7*4096 + 837 = 29509
    const { events } = step(machineWithPage18(), accessAddress(0x12345));

    const access = findEvent(events, "CPU_MEMORY_ACCESS");
    expect(access.virtualAddress).toBe(0x12345);
    expect(access.access).toBe("read");
    expect(access.pid).toBe(1);

    const generated = findEvent(events, "VIRTUAL_ADDRESS_GENERATED");
    expect(generated.virtualAddress).toBe(0x12345);

    const split = findEvent(events, "ADDRESS_SPLIT");
    expect(split.pageNumber).toBe(18);
    expect(split.offset).toBe(837);
    expect(split.pageSize).toBe(PAGE_SIZE);

    const lookup = findEvent(events, "PAGE_TABLE_LOOKUP");
    expect(lookup.pageNumber).toBe(18);

    expect(findEvent(events, "PAGE_TABLE_HIT").frameNumber).toBe(7);
    expect(findEvent(events, "FRAME_RESOLVED").frameNumber).toBe(7);

    const physical = findEvent(events, "PHYSICAL_ADDRESS_GENERATED");
    expect(physical.physicalAddress).toBe(29509);
    expect(physical.frameNumber).toBe(7);
    expect(physical.offset).toBe(837);

    const ram = findEvent(events, "RAM_ACCESS");
    expect(ram.physicalAddress).toBe(29509);
    expect(ram.frameNumber).toBe(7);
    expect(ram.offset).toBe(837);
    expect(ram.access).toBe("read");
  });

  it("numbers events contiguously from the machine's sequence counter", () => {
    const machine = machineWithPage18();
    const { state, events } = step(machine, accessAddress(0x12345));

    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.sequence).toBe(events.length);
  });

  it("advances the counters exactly once", () => {
    const { state } = step(machineWithPage18(), accessAddress(0x12345));

    expect(state.stats).toEqual({
      accesses: 1,
      translations: 1,
      pageFaults: 0,
      ramAccesses: 1,
    });
    expect(state.cpu.pendingFault).toBeNull();
  });

  it("models a write access as a write", () => {
    const { events } = step(machineWithPage18(), accessAddress(0x12345, "write"));

    expect(findEvent(events, "CPU_MEMORY_ACCESS").access).toBe("write");
    expect(findEvent(events, "RAM_ACCESS").access).toBe("write");
  });

  it("translates the first byte and the last byte of a page correctly", () => {
    // page 18 spans 73728..77823
    const firstByte = step(machineWithPage18(), accessAddress(18 * PAGE_SIZE));
    expect(findEvent(firstByte.events, "ADDRESS_SPLIT").offset).toBe(0);
    expect(findEvent(firstByte.events, "RAM_ACCESS").physicalAddress).toBe(7 * PAGE_SIZE);

    const lastByte = step(machineWithPage18(), accessAddress(18 * PAGE_SIZE + 4095));
    expect(findEvent(lastByte.events, "ADDRESS_SPLIT").offset).toBe(4095);
    expect(findEvent(lastByte.events, "RAM_ACCESS").physicalAddress).toBe(7 * PAGE_SIZE + 4095);
  });
});
describe("step ACCESS_ADDRESS - page fault detection", () => {
  it("stops at the page fault and never claims RAM was accessed", () => {
    // page 3 is not present: 3 * 4096 + 100 = 12388
    const { events } = step(createExampleMachine(), accessAddress(12388));

    expect(eventTypes(events)).toEqual([
      "CPU_MEMORY_ACCESS",
      "VIRTUAL_ADDRESS_GENERATED",
      "ADDRESS_SPLIT",
      "PAGE_TABLE_LOOKUP",
      "PAGE_FAULT",
    ]);

    expect(eventTypes(events)).not.toContain("PAGE_TABLE_HIT");
    expect(eventTypes(events)).not.toContain("FRAME_RESOLVED");
    expect(eventTypes(events)).not.toContain("PHYSICAL_ADDRESS_GENERATED");
    expect(eventTypes(events)).not.toContain("RAM_ACCESS");
  });

  it("describes the fault precisely", () => {
    const { events } = step(createExampleMachine(), accessAddress(12388));

    const fault = findEvent(events, "PAGE_FAULT");
    expect(fault.virtualAddress).toBe(12388);
    expect(fault.pageNumber).toBe(3);
    expect(fault.offset).toBe(100);
    expect(fault.access).toBe("read");
    expect(fault.pid).toBe(1);
    expect(fault.reason).toBe("PAGE_NOT_PRESENT");
  });

  it("records the unresolved fault in the machine state", () => {
    const { state } = step(createExampleMachine(), accessAddress(12388));

    expect(state.cpu.pendingFault).toEqual({
      virtualAddress: 12388,
      pageNumber: 3,
      offset: 100,
      access: "read",
      reason: "PAGE_NOT_PRESENT",
    });
    expect(state.stats).toEqual({
      accesses: 1,
      translations: 0,
      pageFaults: 1,
      ramAccesses: 0,
    });
  });

  it("faults on a page that has no page-table entry at all", () => {
    const { events } = step(createExampleMachine(), accessAddress(99 * PAGE_SIZE));

    expect(findEvent(events, "PAGE_FAULT").pageNumber).toBe(99);
    expect(eventTypes(events)).toHaveLength(5);
  });

  it("keeps the CPU in user mode and lets a later successful access clear the fault", () => {
    const faulted = step(createExampleMachine(), accessAddress(12388));
    const recovered = step(faulted.state, accessAddress(1 * PAGE_SIZE));

    expect(faulted.state.cpu.mode).toBe("user");
    expect(recovered.state.cpu.pendingFault).toBeNull();
    expect(eventTypes(recovered.events)).toHaveLength(8);
  });
});

describe("step purity and determinism", () => {
  it("does not mutate the state it is given", () => {
    const machine = createExampleMachine();
    const before = JSON.stringify(machine);

    step(machine, accessAddress(0x12345));
    step(machine, accessAddress(12388));

    expect(JSON.stringify(machine)).toBe(before);
  });

  it("still works on a deeply frozen state (proving no hidden mutation)", () => {
    const machine = deepFreeze(createExampleMachine());

    const { state, events } = step(machine, accessAddress(1 * PAGE_SIZE));

    expect(eventTypes(events)).toHaveLength(8);
    expect(state.stats.translations).toBe(1);
  });

  it("produces identical events and state for identical input", () => {
    const firstRun = step(createExampleMachine(), accessAddress(0x12345));
    const secondRun = step(createExampleMachine(), accessAddress(0x12345));

    expect(secondRun.events).toEqual(firstRun.events);
    expect(secondRun.state).toEqual(firstRun.state);

    const faultA = step(createExampleMachine(), accessAddress(12388));
    const faultB = step(createExampleMachine(), accessAddress(12388));
    expect(faultA.events).toEqual(faultB.events);
    expect(faultA.state).toEqual(faultB.state);
  });

  it("continues the event numbering across steps", () => {
    let machine = createExampleMachine();

    const first = step(machine, accessAddress(1 * PAGE_SIZE));
    machine = first.state;
    const second = step(machine, accessAddress(2 * PAGE_SIZE));
    machine = second.state;

    expect(first.events[0]?.sequence).toBe(0);
    expect(second.events[0]?.sequence).toBe(8);
    expect(machine.sequence).toBe(16);
    expect(machine.stats.accesses).toBe(2);
    expect(machine.stats.translations).toBe(2);
  });
});

describe("step input validation", () => {
  it.each([-1, -4096, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the invalid address %s without touching the machine",
    (badAddress) => {
      const machine = createExampleMachine();

      expect(() => step(machine, accessAddress(badAddress))).toThrowError(EngineError);
      expect(machine.stats.accesses).toBe(0);
      expect(machine.sequence).toBe(0);
    },
  );

  it("reports INVALID_VIRTUAL_ADDRESS as the error code", () => {
    try {
      step(createExampleMachine(), accessAddress(-1));
      expect.unreachable("step should have thrown");
    } catch (error) {
      expect((error as EngineError).code).toBe("INVALID_VIRTUAL_ADDRESS");
    }
  });

  it("rejects an action the machine does not understand", () => {
    const bogus = { type: "TICK" } as unknown as Action;

    expect(() => step(createExampleMachine(), bogus)).toThrowError(EngineError);
  });
});

/** Freeze an object graph so any mutation attempt throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}