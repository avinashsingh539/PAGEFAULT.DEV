/**
 * Page table tests.
 *
 * The example page table (see `docs/reference-values.md`):
 *
 *   page 0 -> frame 3
 *   page 1 -> frame 7
 *   page 2 -> frame 1
 *   page 3 -> NOT PRESENT
 */

import { describe, expect, it } from "vitest";

import {
  EngineError,
  absentEntry,
  createPageTable,
  createExampleMachine,
  lookupPage,
  pageTableEntries,
  presentEntry,
} from "../../engine";
import type { PageTable } from "../../engine";

const PAGE_SIZE = 4096;

function exampleTable(): PageTable {
  return createPageTable(PAGE_SIZE, [
    presentEntry(0, 3),
    presentEntry(1, 7),
    presentEntry(2, 1),
    absentEntry(3),
  ]);
}

describe("lookupPage", () => {
  it("returns the frame for a present page", () => {
    expect(lookupPage(exampleTable(), 0)).toMatchObject({ present: true, frameNumber: 3 });
    expect(lookupPage(exampleTable(), 1)).toMatchObject({ present: true, frameNumber: 7 });
    expect(lookupPage(exampleTable(), 2)).toMatchObject({ present: true, frameNumber: 1 });
  });

  it("reports PAGE_NOT_PRESENT for a page that exists but is swapped out", () => {
    const lookup = lookupPage(exampleTable(), 3);

    expect(lookup.present).toBe(false);
    expect(lookup.pageNumber).toBe(3);
    if (lookup.present) {
      expect.unreachable("page 3 must not be present");
    }
    expect(lookup.reason).toBe("PAGE_NOT_PRESENT");
    expect(lookup.entry).toEqual(absentEntry(3));
  });

  it("reports PAGE_NOT_PRESENT for a page with no entry at all", () => {
    const lookup = lookupPage(exampleTable(), 99);

    expect(lookup.present).toBe(false);
    expect(lookup.pageNumber).toBe(99);
    if (lookup.present) {
      expect.unreachable("page 99 does not exist");
    }
    expect(lookup.reason).toBe("PAGE_NOT_PRESENT");
    expect(lookup.entry).toBeNull();
  });

  it("is pure: two lookups of the same page agree", () => {
    const table = exampleTable();
    expect(lookupPage(table, 1)).toEqual(lookupPage(table, 1));
  });

  it("rejects an invalid page number instead of inventing a result", () => {
    expect(() => lookupPage(exampleTable(), -1)).toThrowError(EngineError);
    expect(() => lookupPage(exampleTable(), 1.5)).toThrowError(/page number must be/);
    expect(() => lookupPage(exampleTable(), Number.NaN)).toThrowError(/page number must be/);
  });
});

describe("createPageTable", () => {
  it("keeps every entry, keyed by page number", () => {
    const table = exampleTable();

    expect(Object.keys(table.entries).sort()).toEqual(["0", "1", "2", "3"]);
    expect(table.pageSize).toBe(PAGE_SIZE);
  });

  it("rejects duplicate page numbers", () => {
    expect(() => createPageTable(PAGE_SIZE, [presentEntry(1, 3), presentEntry(1, 7)])).toThrowError(
      /duplicate page table entry/,
    );
  });

  it("rejects a present page without a frame", () => {
    expect(() =>
      createPageTable(PAGE_SIZE, [{ pageNumber: 1, present: true, frameNumber: null }]),
    ).toThrowError(/marked present but has no frame number/);
  });

  it("rejects a non-present page that still names a frame", () => {
    expect(() =>
      createPageTable(PAGE_SIZE, [{ pageNumber: 1, present: false, frameNumber: 3 }]),
    ).toThrowError(/not present but names frame 3/);
  });

  it("rejects an invalid entry page number and negative frames", () => {
    expect(() =>
      createPageTable(PAGE_SIZE, [{ pageNumber: -1, present: true, frameNumber: 0 }]),
    ).toThrowError(/page number must be/);
    expect(() => createPageTable(PAGE_SIZE, [presentEntry(0, -1)])).toThrowError(
      /frame number must be/,
    );
  });
});

describe("pageTableEntries", () => {
  it("returns entries in ascending page order", () => {
    const table = createPageTable(PAGE_SIZE, [
      presentEntry(2, 1),
      presentEntry(0, 3),
      absentEntry(3),
      presentEntry(1, 7),
    ]);

    expect(pageTableEntries(table).map((entry) => entry.pageNumber)).toEqual([0, 1, 2, 3]);
  });
});

describe("createExampleMachine page table wiring", () => {
  it("mounts the example page table on the process", () => {
    const machine = createExampleMachine();

    expect(machine.process.pid).toBe(1);
    expect(machine.process.pageTable.pageSize).toBe(PAGE_SIZE);
    expect(lookupPage(machine.process.pageTable, 1)).toMatchObject({ frameNumber: 7 });
    // Pages 0..3 exist, so the virtual address space is 4 pages = 16384 bytes.
    expect(machine.process.virtualMemorySizeBytes).toBe(16384);
  });

  it("records which frames are occupied by which page", () => {
    const machine = createExampleMachine();

    expect(machine.memory.frames).toHaveLength(16);
    expect(machine.memory.frames[3]).toEqual({ frameNumber: 3, ownerPid: 1, pageNumber: 0 });
    expect(machine.memory.frames[7]).toEqual({ frameNumber: 7, ownerPid: 1, pageNumber: 1 });
    expect(machine.memory.frames[2]).toEqual({
      frameNumber: 2,
      ownerPid: null,
      pageNumber: null,
    });
  });

  it("refuses a page table that maps a page outside physical RAM", () => {
    expect(() =>
      createExampleMachine({ pageTableEntries: [presentEntry(0, 99)], frameCount: 16 }),
    ).toThrowError(/physical memory only has 16 frames/);
  });

  it("refuses an empty or negative frame count", () => {
    expect(() => createExampleMachine({ frameCount: 0 })).toThrowError(
      /frame count must be a positive integer/,
    );
  });
});