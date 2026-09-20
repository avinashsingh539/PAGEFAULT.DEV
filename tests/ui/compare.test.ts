/**
 * Tests for Compare Mode's lib (`ui/src/lib/compare.ts`).
 *
 * THE contract: Compare Mode has no second implementation of any algorithm. Every
 * column it produces comes from one call to the engine's shared harness per algorithm,
 * so the classic textbook run must come back exactly as the reference values say -
 * FIFO 15, LRU 12, Optimal 9 - with the same access counts and the same frame count
 * the caller asked for.
 */

import { describe, expect, it } from "vitest";

import {
  CLASSIC_REFERENCE_STRING,
  QUOTED_REFERENCE_STRING,
  REPLACEMENT_ALGORITHMS,
} from "../../engine";
import { changedFrame, compare, parseCompareFrameCount } from "../../ui/src/lib/compare";

describe("compare", () => {
  it("runs the classic string and reproduces the documented fault counts", () => {
    const result = compare(CLASSIC_REFERENCE_STRING, 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    expect(result.value.frameCount).toBe(3);
    expect(result.value.referenceString).toEqual(CLASSIC_REFERENCE_STRING);
    expect(result.value.columns.map((column) => column.algorithm)).toEqual([
      "FIFO",
      "LRU",
      "OPTIMAL",
    ]);

    const [fifo, lru, optimal] = result.value.columns;
    expect(fifo?.pageFaults).toBe(15);
    expect(fifo?.hits).toBe(5);
    expect(lru?.pageFaults).toBe(12);
    expect(lru?.hits).toBe(8);
    expect(optimal?.pageFaults).toBe(9);
    expect(optimal?.hits).toBe(11);
  });

  it("gives every column the same reference string and the same access count", () => {
    const result = compare(QUOTED_REFERENCE_STRING, 4);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    for (const column of result.value.columns) {
      expect(column.accesses).toBe(QUOTED_REFERENCE_STRING.length);
      expect(column.steps).toHaveLength(QUOTED_REFERENCE_STRING.length);
      for (const [index, step] of column.steps.entries()) {
        // The SAME string: every column touches the same page at every step.
        expect(step.pageNumber).toBe(QUOTED_REFERENCE_STRING[index]);
        expect(step.accessIndex).toBe(index);
        expect(step.outcome === "HIT" || step.outcome === "FAULT").toBe(true);
      }
    }
  });

  it("keeps the counts consistent inside every column", () => {
    const result = compare(CLASSIC_REFERENCE_STRING, 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    for (const column of result.value.columns) {
      expect(column.hits + column.pageFaults).toBe(column.accesses);
      expect(column.evictions).toBeLessThanOrEqual(column.pageFaults);
      expect(column.faultRate).toBeGreaterThanOrEqual(0);
      expect(column.faultRate).toBeLessThanOrEqual(1);
      expect(Number.isNaN(column.faultRate)).toBe(false);
    }
  });

  it("handles an empty reference string without NaN and without crashing", () => {
    const result = compare([], 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    for (const column of result.value.columns) {
      expect(column.accesses).toBe(0);
      expect(column.pageFaults).toBe(0);
      expect(column.faultRate).toBe(0);
      expect(Number.isNaN(column.faultRate)).toBe(false);
      expect(column.steps).toEqual([]);
      expect(column.finalFrames.every((page) => page === null)).toBe(true);
    }
  });

  it("surfaces an engine refusal as a message, not an exception", () => {
    const refused = compare([7, -1, 2], 3);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toContain("-1");
    }

    const zeroFrames = compare(CLASSIC_REFERENCE_STRING, 0);
    expect(zeroFrames.ok).toBe(false);
    if (!zeroFrames.ok) {
      expect(zeroFrames.error.length).toBeGreaterThan(0);
    }
  });

  it("records an eviction only when a page really had to leave", () => {
    // Three pages fill three frames; the fourth access faults and must evict exactly
    // the page FIFO loaded first, page 1.
    const result = compare([1, 2, 3, 4], 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    const fifo = result.value.columns.find((column) => column.algorithm === "FIFO");
    if (fifo === undefined) {
      throw new Error("no FIFO column");
    }
    // First three accesses fill RAM; nothing can be evicted before that.
    for (const step of fifo.steps.slice(0, 3)) {
      expect(step.evictedPageNumber).toBeNull();
      expect(step.outcome).toBe("FAULT");
    }
    // And the fourth access evicts exactly the page FIFO loaded first.
    expect(fifo.steps[3]?.evictedPageNumber).toBe(1);
    expect(fifo.steps[3]?.outcome).toBe("FAULT");
  });

  it("records a hit with no eviction and no frame work", () => {
    const result = compare([1, 1, 1], 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }

    const fifo = result.value.columns.find((column) => column.algorithm === "FIFO");
    if (fifo === undefined) {
      throw new Error("no FIFO column");
    }
    expect(fifo.steps[0]?.outcome).toBe("FAULT");
    for (const step of fifo.steps.slice(1)) {
      expect(step.outcome).toBe("HIT");
      expect(step.evictedPageNumber).toBeNull();
    }
  });
});

describe("parseCompareFrameCount", () => {
  it("accepts any positive integer", () => {
    expect(parseCompareFrameCount("1")).toEqual({ ok: true, value: 1 });
    expect(parseCompareFrameCount("64")).toEqual({ ok: true, value: 64 });
  });

  it("rejects zero, negatives and garbage", () => {
    expect(parseCompareFrameCount("0").ok).toBe(false);
    expect(parseCompareFrameCount("-3").ok).toBe(false);
    expect(parseCompareFrameCount("2.5").ok).toBe(false);
    expect(parseCompareFrameCount("many").ok).toBe(false);
  });
});

describe("changedFrame", () => {
  it("names the frame that changed between two snapshots", () => {
    expect(changedFrame([1, 2, 3], [4, 2, 3])).toBe(0);
    expect(changedFrame([1, 2, 3], [1, 5, 3])).toBe(1);
    expect(changedFrame([1, 2, 3], [1, 2, 3])).toBeNull();
  });

  it("treats the first access as changing whatever it filled", () => {
    expect(changedFrame(null, [7, null, null])).toBe(0);
    expect(changedFrame(null, [null, null, null])).toBeNull();
  });

  it("detects a page changing places between frames", () => {
    expect(changedFrame([1, null], [null, 1])).toBe(0);
  });
});

describe("column order matches the engine's algorithm order", () => {
  it("is FIFO, LRU, OPTIMAL - the order every textbook lists them in", () => {
    const result = compare(CLASSIC_REFERENCE_STRING, 3);
    if (!result.ok) {
      throw new Error(`expected a run, got: ${result.error}`);
    }
    expect(result.value.columns.map((column) => column.algorithm)).toEqual([
      ...REPLACEMENT_ALGORITHMS,
    ]);
  });
});
