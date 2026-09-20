/**
 * The two explicit maintenance operations the Experiment mode drives: a whole-TLB
 * FLUSH (`CLEAR_TLB`) and an UNMAP of a page (`UNMAP_PAGE`).
 *
 * Why these need their own file: both operations REMOVE knowledge, which is the one
 * direction that can silently corrupt a simulation. A stale translation left behind
 * by a buggy unmap would make a page that is no longer in RAM keep translating
 * successfully, and no fault count anywhere else in the suite would notice.
 *
 * The lab machine (`createLabMachine`) maps pages 0->3, 1->7, 2->1, 3->5, 4->9 and
 * 5->11, has page 6 absent and page 7 with no entry at all, 16 frames, 4096-byte
 * pages and a 4-entry FIFO TLB. Every number below is hand-checked against that.
 */

import { describe, expect, it } from "vitest";

import {
  EngineError,
  createLabMachine,
  step,
  tlbEntries,
  tlbOccupancy,
} from "../../engine";
import type { Action, Event, MachineState } from "../../engine";

const PAGE_SIZE = 4096;

/** A virtual address inside `pageNumber`, at `offset`. */
function addressOf(pageNumber: number, offset = 0): number {
  return pageNumber * PAGE_SIZE + offset;
}

function access(address: number): Action {
  return { type: "ACCESS_ADDRESS", address };
}

/** Touch `pageNumber` once, so the lab TLB caches its translation. */
function touch(state: MachineState, pageNumber: number): MachineState {
  return step(state, access(addressOf(pageNumber))).state;
}

/** Run a call that must fail, and hand back the engine error it threw. */
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

function typesOf(events: readonly Event[]): string[] {
  return events.map((event) => event.type);
}

describe("CLEAR_TLB", () => {
  it("empties the TLB and reports every dropped translation", () => {
    const cached = touch(touch(createLabMachine(), 1), 2);
    expect(tlbOccupancy(cached.tlb)).toBe(2);

    const result = step(cached, { type: "CLEAR_TLB" });

    expect(tlbOccupancy(result.state.tlb)).toBe(0);
    expect(tlbEntries(result.state.tlb)).toEqual([]);
    // The TLB itself survives the flush: same machine, just an empty cache.
    expect(result.state.tlb.enabled).toBe(true);
    expect(result.state.tlb.capacity).toBe(cached.tlb.capacity);

    expect(typesOf(result.events)).toEqual(["TLB_INVALIDATE", "TLB_INVALIDATE"]);
    expect(
      result.events.map((event) => (event.type === "TLB_INVALIDATE" ? event.pageNumber : -1)),
    ).toEqual([1, 2]);
    expect(
      result.events.every(
        (event) => event.type === "TLB_INVALIDATE" && event.reason === "EXPLICIT_FLUSH",
      ),
    ).toBe(true);
  });

  it("numbers the flush events consecutively from the machine's own sequence", () => {
    const cached = touch(createLabMachine(), 1);
    const before = cached.sequence;

    const result = step(cached, { type: "CLEAR_TLB" });

    expect(result.events.map((event) => event.sequence)).toEqual([before]);
    expect(result.state.sequence).toBe(before + 1);
  });

  it("is honest about doing nothing: flushing an empty TLB emits no events", () => {
    const machine = createLabMachine();
    expect(tlbOccupancy(machine.tlb)).toBe(0);

    const result = step(machine, { type: "CLEAR_TLB" });

    expect(result.events).toEqual([]);
    // The state is returned untouched - not a new object pretending to be a change.
    expect(result.state).toBe(machine);
  });

  it("makes the next access to a previously cached page miss again", () => {
    const warm = touch(touch(createLabMachine(), 1), 1);
    const wasHit = step(warm, access(addressOf(1)));
    expect(typesOf(wasHit.events)).toContain("TLB_HIT");

    const flushed = step(warm, { type: "CLEAR_TLB" }).state;
    const afterFlush = step(flushed, access(addressOf(1)));

    expect(typesOf(afterFlush.events)).toContain("TLB_MISS");
    expect(typesOf(afterFlush.events)).not.toContain("TLB_HIT");
    // A miss is not a fault: the page table still resolves page 1 to frame 7.
    expect(typesOf(afterFlush.events)).toContain("PAGE_TABLE_HIT");
    expect(typesOf(afterFlush.events)).toContain("RAM_ACCESS");
  });

  it("does not touch the page table or RAM: a flush only removes knowledge", () => {
    const cached = touch(createLabMachine(), 3);
    const result = step(cached, { type: "CLEAR_TLB" });

    for (const type of ["PAGE_TABLE_LOOKUP", "PAGE_FAULT", "RAM_ACCESS", "FRAME_RESOLVED"]) {
      expect(typesOf(result.events)).not.toContain(type);
    }
    expect(result.state.process.pageTable).toBe(cached.process.pageTable);
    expect(result.state.memory.frames).toBe(cached.memory.frames);
    expect(result.state.stats).toBe(cached.stats);
  });

  it("refuses to flush a machine that has no TLB", () => {
    const noTlb = createLabMachine({ tlbCapacity: undefined });

    const error = expectEngineError(() => step(noTlb, { type: "CLEAR_TLB" }));

    expect(error.code).toBe("INVALID_MACHINE_CONFIG");
  });

  it("cannot be tricked into a partial flush by capacity", () => {
    // Six distinct pages against four slots: the TLB has already evicted twice.
    let machine = createLabMachine();
    for (const page of [0, 1, 2, 3, 4, 5]) {
      machine = touch(machine, page);
    }
    expect(tlbOccupancy(machine.tlb)).toBe(4);

    const result = step(machine, { type: "CLEAR_TLB" });

    expect(result.events).toHaveLength(4);
    expect(tlbOccupancy(result.state.tlb)).toBe(0);
  });
});
describe("UNMAP_PAGE", () => {
  it("removes the mapping, reports it, and frees the frame", () => {
    const machine = createLabMachine();

    const result = step(machine, { type: "UNMAP_PAGE", pageNumber: 1 });

    expect(typesOf(result.events)).toEqual(["PAGE_UNMAPPED"]);
    expect(result.events[0]).toMatchObject({
      type: "PAGE_UNMAPPED",
      pageNumber: 1,
      frameNumber: 7,
      pid: 1,
    });

    // The page table still knows the page, but it is no longer present.
    expect(result.state.process.pageTable.entries[1]).toEqual({
      pageNumber: 1,
      present: false,
      frameNumber: null,
    });
    // Frame 7 is free again, and its old owner is gone.
    expect(result.state.memory.frames[7]).toEqual({
      frameNumber: 7,
      ownerPid: null,
      pageNumber: null,
    });
  });

  it("makes the next access to that page fault", () => {
    const machine = createLabMachine();
    const unmapped = step(machine, { type: "UNMAP_PAGE", pageNumber: 2 }).state;

    const result = step(unmapped, access(addressOf(2)));

    expect(typesOf(result.events)).toContain("PAGE_FAULT");
    expect(typesOf(result.events)).not.toContain("RAM_ACCESS");
    expect(typesOf(result.events)).not.toContain("FRAME_RESOLVED");
    // The page still exists in the page table, so the fault names it.
    expect(result.events.find((event) => event.type === "PAGE_FAULT")).toMatchObject({
      type: "PAGE_FAULT",
      pageNumber: 2,
      reason: "PAGE_NOT_PRESENT",
    });
  });

  it("drops the stale TLB entry for the unmapped page", () => {
    const warm = touch(touch(createLabMachine(), 1), 2);
    expect(tlbOccupancy(warm.tlb)).toBe(2);

    const result = step(warm, { type: "UNMAP_PAGE", pageNumber: 1 });

    expect(typesOf(result.events)).toEqual(["PAGE_UNMAPPED", "TLB_INVALIDATE"]);
    expect(result.events[1]).toMatchObject({
      type: "TLB_INVALIDATE",
      pageNumber: 1,
      frameNumber: 7,
      reason: "PAGE_NO_LONGER_PRESENT",
    });
    expect(tlbOccupancy(result.state.tlb)).toBe(1);
    expect(tlbEntries(result.state.tlb).map((entry) => entry.pageNumber)).toEqual([2]);
  });

  it("leaves other cached translations alone", () => {
    const warm = touch(touch(touch(createLabMachine(), 1), 2), 3);

    const result = step(warm, { type: "UNMAP_PAGE", pageNumber: 2 });

    expect(tlbEntries(result.state.tlb).map((entry) => entry.pageNumber)).toEqual([1, 3]);
  });

  it("keeps the TLB unchanged when the page was never cached", () => {
    const machine = createLabMachine();

    const result = step(machine, { type: "UNMAP_PAGE", pageNumber: 4 });

    expect(typesOf(result.events)).toEqual(["PAGE_UNMAPPED"]);
    expect(result.state.tlb).toBe(machine.tlb);
  });

  it("never leaves a translation usable for a page it just unmapped", () => {
    // The whole point: warm the TLB, unmap, then access. It must FAULT, not hit.
    const warm = touch(createLabMachine(), 5);
    const unmapped = step(warm, { type: "UNMAP_PAGE", pageNumber: 5 }).state;

    const result = step(unmapped, access(addressOf(5)));

    expect(typesOf(result.events)).not.toContain("TLB_HIT");
    expect(typesOf(result.events)).not.toContain("RAM_ACCESS");
    expect(typesOf(result.events)).toContain("PAGE_FAULT");
  });

  it("reports nothing when there was no mapping to remove", () => {
    const machine = createLabMachine();

    // Page 6 exists but is already not present.
    const absent = step(machine, { type: "UNMAP_PAGE", pageNumber: 6 });
    expect(absent.events).toEqual([]);
    expect(absent.state).toBe(machine);

    // Page 7 has no entry at all.
    const missing = step(machine, { type: "UNMAP_PAGE", pageNumber: 7 });
    expect(missing.events).toEqual([]);
    expect(missing.state).toBe(machine);

    // Unmapping twice is a no-op the second time: the guarantee already holds.
    const once = step(machine, { type: "UNMAP_PAGE", pageNumber: 0 });
    const twice = step(once.state, { type: "UNMAP_PAGE", pageNumber: 0 });
    expect(twice.events).toEqual([]);
    expect(twice.state).toBe(once.state);
  });

  it("rejects a malformed page number before any event is produced", () => {
    const machine = createLabMachine();

    for (const pageNumber of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const error = expectEngineError(() => step(machine, { type: "UNMAP_PAGE", pageNumber }));
      expect(error.code).toBe("INVALID_PAGE_NUMBER");
    }
  });

  it("works on a machine with no TLB, because a page table is enough", () => {
    const noTlb = createLabMachine({ tlbCapacity: undefined });

    const result = step(noTlb, { type: "UNMAP_PAGE", pageNumber: 3 });

    expect(typesOf(result.events)).toEqual(["PAGE_UNMAPPED"]);
    expect(result.state.process.pageTable.entries[3]).toMatchObject({ present: false });
  });

  it("moves the frame count of occupied frames by exactly one", () => {
    const machine = createLabMachine();
    const occupiedBefore = machine.memory.frames.filter((frame) => frame.pageNumber !== null).length;

    const result = step(machine, { type: "UNMAP_PAGE", pageNumber: 1 });

    const occupiedAfter = result.state.memory.frames.filter(
      (frame) => frame.pageNumber !== null,
    ).length;
    expect(occupiedAfter).toBe(occupiedBefore - 1);
  });
});

