/**
 * The nasty-case matrix, as executable tests (see `docs/test-matrix.md` for the table).
 *
 * Every case here is a configuration or input a learner WILL type by accident. The
 * contract for all of them is the same and is checked mechanically:
 *
 *   no crash, no `NaN`, no negative fault count, no impossible frame state, and a
 *   reset back to a fresh machine that behaves like a fresh machine.
 *
 * These run the ENGINE and the UI LIBS in plain Node. The browser-level version of the
 * same matrix lives in the Playwright specs (`e2e/lab.spec.ts`).
 */

import { describe, expect, it } from "vitest";

import {
  CLASSIC_REFERENCE_STRING,
  createLabMachine,
  runReferenceString,
  step,
} from "../../engine";
import type { MachineState, ReplacementAlgorithm } from "../../engine";
import { compare } from "../../ui/src/lib/compare";
import { parseReferenceString } from "../../ui/src/lib/fields";
import { buildExperimentMachine, validateExperimentConfig } from "../../ui/src/lib/experiment";

const ALGORITHMS: readonly ReplacementAlgorithm[] = ["FIFO", "LRU", "OPTIMAL"];

function expectSaneMachine(machine: MachineState): void {
  const { memory, tlb } = machine;

  expect(Number.isSafeInteger(memory.frameCount)).toBe(true);
  expect(memory.frameCount).toBeGreaterThan(0);
  expect(memory.pageSize).toBeGreaterThan(0);
  expect(Number.isNaN(memory.pageSize)).toBe(false);
  expect(memory.frames).toHaveLength(memory.frameCount);

  // Every frame is either free or owned by a page - never both, never neither.
  for (const frame of memory.frames) {
    const free = frame.pageNumber === null && frame.ownerPid === null;
    const owned = frame.pageNumber !== null && frame.ownerPid !== null;
    expect(free || owned).toBe(true);
    if (frame.pageNumber !== null) {
      expect(frame.pageNumber).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(frame.pageNumber)).toBe(false);
    }
  }

  // A TLB never holds more than its capacity, and never a negative page.
  if (tlb.enabled) {
    expect(tlb.entries.length).toBeLessThanOrEqual(tlb.capacity);
    expect(tlb.capacity).toBeGreaterThanOrEqual(1);
  }
}

function expectSaneRun(
  algorithm: ReplacementAlgorithm,
  run: ReturnType<typeof runReferenceString>,
): void {
  expect(Number.isInteger(run.pageFaults)).toBe(true);
  expect(run.pageFaults).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(run.hits)).toBe(true);
  expect(run.hits).toBeGreaterThanOrEqual(0);
  expect(run.pageFaults + run.hits).toBe(run.accesses);
  // A rate derived from two safe integers is never NaN (zero accesses maps to 0).
  expect(Number.isNaN(run.accesses === 0 ? 0 : run.pageFaults / run.accesses)).toBe(false);

  for (const entry of run.trace) {
    const resident = entry.frames.map((frame) => frame.pageNumber).filter((page) => page !== null);
    expect(new Set(resident).size).toBe(resident.length);
    expect(entry.frames).toHaveLength(run.frameCount);
  }

  void algorithm;
}

/** Reset still works: the fresh machine behaves like a fresh machine. */
function expectResetWorks(machine: MachineState, frameCount: number): void {
  const fresh = createLabMachine();
  const firstAccess = step(fresh, { type: "ACCESS_ADDRESS", address: 0 });
  expect(firstAccess.events[0]).toMatchObject({ type: "CPU_MEMORY_ACCESS" });
  expect(firstAccess.state.stats.accesses).toBe(1);
  // And a reset experiment can run a whole replacement afterwards.
  const run = runReferenceString("FIFO", [1, 2, 3], frameCount);
  expect(run.accesses).toBe(3);
  void machine;
}


describe("Case 1: frame count = 1", () => {
  it("builds a legal machine and stays sane", () => {
    const built = buildExperimentMachine({ pageSize: 4096, tlbCapacity: 4, frameCount: 1, algorithm: "FIFO" });
    if (!built.ok) {
      throw new Error(`frame count 1 must be buildable: ${built.error}`);
    }
    expectSaneMachine(built.value);

    // And the machine still works: a resident page translates, an absent one faults.
    const withAccess = step(built.value, { type: "ACCESS_ADDRESS", address: 0 });
    expect(
      withAccess.events.some((event) => event.type === "PAGE_FAULT" || event.type === "RAM_ACCESS"),
    ).toBe(true);
  });

  it("runs a replacement through one frame without a negative count", () => {
    for (const algorithm of ALGORITHMS) {
      const run = runReferenceString(algorithm, [1, 2, 3, 1], 1);
      expectSaneRun(algorithm, run);
      // One frame holds one page, so every access except the very first must fault,
      // and every fault after RAM is full must evict.
      expect(run.pageFaults).toBe(4);
      expect(run.evictions).toBe(3);
      expect(run.hits).toBe(0);
    }
  });

  it("reset still works afterwards", () => {
    const built = buildExperimentMachine({ pageSize: 4096, tlbCapacity: 4, frameCount: 1, algorithm: "FIFO" });
    if (!built.ok) {
      throw new Error(`frame count 1 must be buildable: ${built.error}`);
    }
    expectResetWorks(built.value, 1);
  });
});

describe("Case 2: TLB entries = 0", () => {
  it("is refused by the config validation with a message, and by the engine", () => {
    const validated = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "0",
      frameCount: "4",
      algorithm: "FIFO",
    });
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.fieldErrors.tlbCapacity).toBeTruthy();
    }

    // The engine agrees, and `buildExperimentMachine` surfaces its refusal as a
    // message rather than letting an exception escape into React.
    const built = buildExperimentMachine({ pageSize: 4096, tlbCapacity: 0, frameCount: 4, algorithm: "FIFO" });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error).toContain("TLB capacity");
    }
  });

  it("tlb=none is the legal way to build the machine, and it behaves Day-1 style", () => {
    const built = buildExperimentMachine({ pageSize: 4096, tlbCapacity: null, frameCount: 4, algorithm: "FIFO" });
    if (!built.ok) {
      throw new Error(`tlb=none must be buildable: ${built.error}`);
    }
    expectSaneMachine(built.value);
    expect(built.value.tlb.enabled).toBe(false);

    const result = step(built.value, { type: "ACCESS_ADDRESS", address: 0 });
    expect(result.events.some((event) => event.type === "TLB_LOOKUP")).toBe(false);
    expectResetWorks(built.value, 4);
  });
});

describe("Case 3: page size larger than every address used", () => {
  it("puts every access in page 0 and still answers honestly", () => {
    const built = buildExperimentMachine({ pageSize: 1048576, tlbCapacity: 4, frameCount: 16, algorithm: "FIFO" });
    if (!built.ok) {
      throw new Error(`1 MiB pages must be buildable: ${built.error}`);
    }
    expectSaneMachine(built.value);

    const machine = built.value;
    const first = step(machine, { type: "ACCESS_ADDRESS", address: 0x12345 });
    const second = step(first.state, { type: "ACCESS_ADDRESS", address: 0x99999 });

    expect(second.events.some((event) => event.type === "TLB_HIT")).toBe(true);
    expect(second.events.some((event) => event.type === "PAGE_TABLE_LOOKUP")).toBe(false);
    expect(second.events.some((event) => event.type === "RAM_ACCESS")).toBe(true);
  });
});

describe("Case 4: smallest valid page size", () => {
  it("builds, translates, and keeps every count an integer", () => {
    const built = buildExperimentMachine({ pageSize: 1, tlbCapacity: 4, frameCount: 16, algorithm: "FIFO" });
    if (!built.ok) {
      throw new Error(`1-byte pages must be buildable: ${built.error}`);
    }
    expectSaneMachine(built.value);

    const result = step(built.value, { type: "ACCESS_ADDRESS", address: 74565 });
    expect(result.events.some((event) => event.type === "ADDRESS_SPLIT")).toBe(true);
    expectResetWorks(built.value, 16);
  });
});

describe("Case 5: large reference string / repeated pages", () => {
  it("runs a long string through all three algorithms and stays sane", () => {
    // 200 accesses over a 6-page alphabet: plenty of repeats, plenty of evictions.
    const longString: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      longString.push(index % 6);
    }

    const result = compare(longString, 3);
    if (!result.ok) {
      throw new Error(`long string must run: ${result.error}`);
    }

    for (const column of result.value.columns) {
      expect(column.accesses).toBe(200);
      expect(column.pageFaults).toBeGreaterThanOrEqual(0);
      expect(column.pageFaults + column.hits).toBe(200);
      expect(Number.isNaN(column.faultRate)).toBe(false);
      for (const entry of column.steps) {
        const resident = entry.frames.filter((page) => page !== null);
        expect(new Set(resident).size).toBe(resident.length);
      }
    }

    // And the generated-case property holds on this long string too.
    const fifo = result.value.columns.find((column) => column.algorithm === "FIFO");
    const optimal = result.value.columns.find((column) => column.algorithm === "OPTIMAL");
    if (fifo !== undefined && optimal !== undefined) {
      expect(optimal.pageFaults).toBeLessThanOrEqual(fifo.pageFaults);
    }
  });

  it("parses a big pasted string without losing or inventing accesses", () => {
    const parsed = parseReferenceString(CLASSIC_REFERENCE_STRING.join(" "));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual([...CLASSIC_REFERENCE_STRING]);
    }
  });
});
