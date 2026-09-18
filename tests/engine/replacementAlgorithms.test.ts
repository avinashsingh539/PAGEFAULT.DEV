/**
 * Victim-selection tests for the three replacement policies.
 *
 * These tests drive the policies DIRECTLY, with hand-built frame sets, so a wrong
 * decision is visible as a wrong victim - not hidden behind a fault count. The
 * frame sets below are literal values: `[pageNumber, loadedAt, lastUsedAt]` per
 * frame, in frame-number order.
 */

import { describe, expect, it } from "vitest";

import {
  EngineError,
  REPLACEMENT_ALGORITHMS,
  chooseFifoVictim,
  chooseLruVictim,
  chooseOptimalVictim,
  chooseVictim,
  createReplacementState,
  freeFrames,
  isReplacementAlgorithm,
  occupiedFrames,
  runReferenceString,
  stepReplacement,
} from "../../engine";
import type { PageNumber, ReplacementFrame } from "../../engine";

/** Build frames by hand: one `[pageNumber, loadedAt, lastUsedAt]` triple per frame. */
function framesOf(
  holes: readonly (readonly [PageNumber, number, number])[],
): readonly ReplacementFrame[] {
  return holes.map(([pageNumber, loadedAt, lastUsedAt], frameNumber) => ({
    frameNumber,
    pageNumber,
    loadedAt,
    lastUsedAt,
    useCount: 0,
  }));
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

describe("the supported algorithms", () => {
  it("is a closed set: FIFO, LRU and Optimal", () => {
    expect(REPLACEMENT_ALGORITHMS).toEqual(["FIFO", "LRU", "OPTIMAL"]);
  });

  it("guards unknown names at runtime instead of guessing", () => {
    expect(isReplacementAlgorithm("FIFO")).toBe(true);
    expect(isReplacementAlgorithm("OPTIMAL")).toBe(true);
    expect(isReplacementAlgorithm("fifo")).toBe(false);
    expect(isReplacementAlgorithm("CLOCK")).toBe(false);
    expect(isReplacementAlgorithm(undefined)).toBe(false);
    expect(isReplacementAlgorithm(3)).toBe(false);
  });
});

describe("freeFrames / occupiedFrames", () => {
  it("partitions the frames of a fresh state", () => {
    const state = createReplacementState("FIFO", 3);

    expect(state.frames).toHaveLength(3);
    expect(occupiedFrames(state.frames)).toEqual([]);
    expect(freeFrames(state.frames).map((frame) => frame.frameNumber)).toEqual([0, 1, 2]);
  });

  it("describes the frames after a real access", () => {
    const { state } = stepReplacement(createReplacementState("FIFO", 2), { pageNumber: 5 });

    expect(occupiedFrames(state.frames).map((frame) => frame.pageNumber)).toEqual([5]);
    expect(freeFrames(state.frames).map((frame) => frame.frameNumber)).toEqual([1]);
  });
});

describe("FIFO", () => {
  it("evicts the page that was loaded first, ignoring when it was last used", () => {
    const frames = framesOf([
      [7, 0, 9],
      [0, 1, 8],
      [1, 2, 7],
    ]);

    const decision = chooseFifoVictim(frames);

    expect(decision.victimPageNumber).toBe(7);
    expect(decision.victimFrameNumber).toBe(0);
    expect(decision.evidence).toEqual({
      rule: "FIFO_EARLIEST_LOADED",
      victimLoadedAt: 0,
      candidateFrameNumbers: [0, 1, 2],
    });
    expect(decision.reason).toContain("loaded at access 0");
  });

  it("does not care about hits: after a hit on page 1, page 1 is still the victim", () => {
    // 1, 2, 3 fill three frames; the access to 1 again is a HIT for both policies,
    // but only LRU treats it as "used recently".
    const fifo = runReferenceString("FIFO", [1, 2, 3, 1, 4], 3);

    expect(fifo.trace[3]?.outcome).toBe("HIT");
    expect(fifo.trace[4]?.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
  });

  it("breaks a timestamp tie by frame number", () => {
    const frames = framesOf([
      [7, 4, 4],
      [0, 4, 4],
    ]);

    expect(chooseFifoVictim(frames).victimFrameNumber).toBe(0);
  });
});

describe("LRU", () => {
  it("evicts the page used longest ago", () => {
    const frames = framesOf([
      [7, 0, 9],
      [0, 1, 8],
      [1, 2, 7],
    ]);

    const decision = chooseLruVictim(frames);

    expect(decision.victimPageNumber).toBe(1);
    expect(decision.victimFrameNumber).toBe(2);
    expect(decision.evidence).toEqual({
      rule: "LRU_LEAST_RECENTLY_USED",
      victimLastUsedAt: 7,
      candidateFrameNumbers: [0, 1, 2],
    });
    expect(decision.reason).toContain("last used at access 7");
  });

  it("protects a page that was just hit - the exact opposite of FIFO", () => {
    const lru = runReferenceString("LRU", [1, 2, 3, 1, 4], 3);
    const fifo = runReferenceString("FIFO", [1, 2, 3, 1, 4], 3);

    expect(lru.trace[4]?.evicted).toEqual({ pageNumber: 2, frameNumber: 1 });
    expect(fifo.trace[4]?.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
  });

  it("breaks a timestamp tie by frame number", () => {
    const frames = framesOf([
      [7, 0, 3],
      [0, 1, 3],
    ]);

    expect(chooseLruVictim(frames).victimFrameNumber).toBe(0);
  });
});
describe("Optimal", () => {
  const frames = framesOf([
    [7, 0, 0],
    [0, 1, 1],
    [1, 2, 2],
  ]);

  it("evicts the page whose next use is farthest away", () => {
    // Future is "0 then 1": page 7 is never used again, so it goes first.
    const decision = chooseOptimalVictim(frames, [0, 1]);

    expect(decision.victimPageNumber).toBe(7);
    expect(decision.evidence).toEqual({
      rule: "OPTIMAL_FARTHEST_NEXT_USE",
      victimNextUseIndex: null,
      candidateFrameNumbers: [0, 1, 2],
    });
    expect(decision.reason).toContain("never referenced again");
  });

  it("reads the future it is given: the same frames yield a different victim", () => {
    // Future is "1 then 7": now page 0 is the one that is never used again, and a
    // page that is reused later always beats one that is reused sooner.
    const decision = chooseOptimalVictim(frames, [1, 7]);

    expect(decision.victimPageNumber).toBe(0);
    expect(decision.evidence).toEqual({
      rule: "OPTIMAL_FARTHEST_NEXT_USE",
      victimNextUseIndex: null,
      candidateFrameNumbers: [0, 1, 2],
    });
  });

  it("reports how far away the victim's next use is", () => {
    // Future is "0, 7, 1": every page is reused, and page 1 is reused last.
    const decision = chooseOptimalVictim(frames, [0, 7, 1]);

    expect(decision.victimPageNumber).toBe(1);
    expect(decision.evidence).toEqual({
      rule: "OPTIMAL_FARTHEST_NEXT_USE",
      victimNextUseIndex: 2,
      candidateFrameNumbers: [0, 1, 2],
    });
    expect(decision.reason).toContain("3 access(es) from now");
  });

  it("prefers 'never used again' over any reuse", () => {
    // Future is "7, 0": both are reused, page 1 never is, so page 1 goes.
    const decision = chooseOptimalVictim(frames, [7, 0]);

    expect(decision.victimPageNumber).toBe(1);
    expect(decision.evidence).toMatchObject({ victimNextUseIndex: null });
  });

  it("breaks a tie between pages that are never used again by frame number", () => {
    // Future is just "1": pages 7 and 0 are both never used again.
    const decision = chooseOptimalVictim(frames, [1]);

    expect(decision.victimFrameNumber).toBe(0);
    expect(decision.victimPageNumber).toBe(7);
  });

  it("treats an empty future as 'nothing is used again'", () => {
    expect(chooseOptimalVictim(frames, []).victimFrameNumber).toBe(0);
    expect(chooseOptimalVictim(frames).victimFrameNumber).toBe(0);
  });
});

describe("chooseVictim", () => {
  it("dispatches to the three policies and lets all three disagree", () => {
    const frames = framesOf([
      [7, 0, 5],
      [0, 1, 0],
      [1, 2, 2],
    ]);
    const future: readonly PageNumber[] = [7, 0];

    expect(chooseVictim("FIFO", frames).victimPageNumber).toBe(7);
    expect(chooseVictim("LRU", frames).victimPageNumber).toBe(0);
    expect(chooseVictim("OPTIMAL", frames, future).victimPageNumber).toBe(1);
  });

  it("only ever considers frames that hold a page", () => {
    const { state } = stepReplacement(createReplacementState("FIFO", 3), { pageNumber: 5 });

    expect(chooseVictim("FIFO", state.frames).evidence.candidateFrameNumbers).toEqual([0]);
    expect(state.frames[1]?.pageNumber).toBeNull();
  });

  it("refuses to invent a victim when nothing is resident", () => {
    const empty = createReplacementState("FIFO", 2).frames;

    expect(expectEngineError(() => chooseFifoVictim(empty)).code).toBe("NO_EVICTION_CANDIDATE");
    expect(expectEngineError(() => chooseLruVictim(empty)).code).toBe("NO_EVICTION_CANDIDATE");
    expect(expectEngineError(() => chooseOptimalVictim(empty, [1])).code).toBe(
      "NO_EVICTION_CANDIDATE",
    );
    expect(expectEngineError(() => chooseVictim("LRU", empty)).code).toBe("NO_EVICTION_CANDIDATE");
  });
});

describe("purity of the policies", () => {
  it("is deterministic and never mutates the frames it is given", () => {
    const frames = framesOf([
      [7, 0, 5],
      [0, 1, 0],
      [1, 2, 2],
    ]);
    const before = JSON.stringify(frames);

    expect(chooseFifoVictim(frames)).toEqual(chooseFifoVictim(frames));
    expect(chooseLruVictim(frames)).toEqual(chooseLruVictim(frames));
    expect(chooseOptimalVictim(frames, [7, 0])).toEqual(chooseOptimalVictim(frames, [7, 0]));
    expect(JSON.stringify(frames)).toBe(before);
  });
});