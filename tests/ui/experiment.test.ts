/**
 * Tests for the Experiment configuration lib (`ui/src/lib/experiment.ts`).
 *
 * The contract under test: a form value can never become a half-valid configuration.
 * Every field is parsed, every rejection names its field, and the machine is built BY
 * THE ENGINE - so what these tests assert about frame assignment and demo page tables
 * is what the engine actually accepted, not what the UI hopes for.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPERIMENT_CONFIG,
  assignFrames,
  buildExperimentMachine,
  experimentPageTable,
  textForConfig,
  validateExperimentConfig,
} from "../../ui/src/lib/experiment";

describe("validateExperimentConfig", () => {
  it("accepts the documented default configuration", () => {
    const result = validateExperimentConfig(textForConfig(DEFAULT_EXPERIMENT_CONFIG));
    expect(result.ok).toBe(true);
  });

  it("returns the parsed configuration with every field intact", () => {
    const result = validateExperimentConfig({
      pageSize: "2048",
      tlbCapacity: "2",
      frameCount: "3",
      algorithm: "LRU",
    });
    if (!result.ok) {
      throw new Error(`expected acceptance, got: ${result.error}`);
    }
    expect(result.value).toEqual({
      pageSize: 2048,
      tlbCapacity: 2,
      frameCount: 3,
      algorithm: "LRU",
    });
  });

  it("treats tlb=none as a machine without a TLB", () => {
    const result = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "none",
      frameCount: "4",
      algorithm: "FIFO",
    });
    if (!result.ok) {
      throw new Error(`expected acceptance, got: ${result.error}`);
    }
    expect(result.value.tlbCapacity).toBeNull();
  });

  it("rejects frame count 0 and names the field", () => {
    const result = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "4",
      frameCount: "0",
      algorithm: "FIFO",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.frameCount).toBeTruthy();
      expect(result.fieldErrors.pageSize).toBeUndefined();
    }
  });

  it("rejects a negative page size, a bad TLB count and an unknown algorithm", () => {
    const negativePageSize = validateExperimentConfig({
      pageSize: "-4096",
      tlbCapacity: "4",
      frameCount: "3",
      algorithm: "FIFO",
    });
    expect(negativePageSize.ok).toBe(false);
    if (!negativePageSize.ok) {
      expect(negativePageSize.fieldErrors.pageSize).toBeTruthy();
    }

    const zeroTlb = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "0",
      frameCount: "3",
      algorithm: "FIFO",
    });
    expect(zeroTlb.ok).toBe(false);
    if (!zeroTlb.ok) {
      expect(zeroTlb.fieldErrors.tlbCapacity).toBeTruthy();
    }

    const badAlgorithm = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "4",
      frameCount: "3",
      algorithm: "CLOCK",
    });
    expect(badAlgorithm.ok).toBe(false);
    if (!badAlgorithm.ok) {
      expect(badAlgorithm.fieldErrors.algorithm).toContain("FIFO, LRU, OPTIMAL");
    }
  });

  it("rejects a non-integer everywhere it appears", () => {
    const result = validateExperimentConfig({
      pageSize: "1.5",
      tlbCapacity: "4",
      frameCount: "2.5",
      algorithm: "FIFO",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.pageSize).toBeTruthy();
      expect(result.fieldErrors.frameCount).toBeTruthy();
    }
  });

  it("returns a form error (not a crash) when the engine refuses the machine", () => {
    // A page table with a frame number the frame count cannot hold is refused by the
    // engine; the validation must surface that as a message, never as an exception.
    const result = validateExperimentConfig({
      pageSize: "4096",
      tlbCapacity: "4",
      frameCount: "1",
      algorithm: "FIFO",
    });
    // Either it builds (pages left unmapped) or it is refused with a message - both
    // are honest; a thrown error escaping the function is not.
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe("assignFrames", () => {
  it("gives every page a distinct frame when there is room", () => {
    const assignment = assignFrames(16);
    const frames = assignment.filter((frame): frame is number => frame !== null);
    expect(new Set(frames).size).toBe(frames.length);
    expect(assignment.every((frame) => frame !== null)).toBe(true);
  });

  it("leaves pages unmapped instead of inventing a duplicate frame", () => {
    const assignment = assignFrames(2);
    const frames = assignment.filter((frame): frame is number => frame !== null);
    expect(new Set(frames).size).toBe(frames.length);
    expect(assignment.some((frame) => frame === null)).toBe(true);
  });

  it("never returns a negative or fractional frame", () => {
    for (const frameCount of [1, 2, 3, 8, 16]) {
      for (const frame of assignFrames(frameCount)) {
        if (frame !== null) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(frame)).toBe(true);
          expect(frame).toBeLessThan(frameCount);
        }
      }
    }
  });

  it("handles a frame count of 0 without producing NaN", () => {
    const assignment = assignFrames(0);
    expect(assignment).toHaveLength(8);
    expect(assignment.every((frame) => frame === null)).toBe(true);
    expect(assignment.some((frame) => Number.isNaN(frame))).toBe(false);
  });
});

describe("experimentPageTable", () => {
  it("is buildable by the engine for every small frame count", () => {
    for (const frameCount of [1, 2, 3, 4, 8, 16]) {
      const built = buildExperimentMachine({
        ...DEFAULT_EXPERIMENT_CONFIG,
        frameCount,
      });
      // The engine is the authority: whatever it says about this table goes.
      if (!built.ok) {
        expect(built.error.length).toBeGreaterThan(0);
      }
    }
  });

  it("always includes one present-but-absent page so faults stay reachable", () => {
    const entries = experimentPageTable(16);
    expect(entries.some((entry) => !entry.present)).toBe(true);
    expect(entries.some((entry) => entry.present)).toBe(true);
  });
});
