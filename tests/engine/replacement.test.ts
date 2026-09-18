/**
 * Reference-string simulation tests: accuracy, events, trace and edge cases.
 *
 * Every expected number in this file is hand-calculated in
 * `docs/reference-values.md`, and the preset strings live in `engine/presets.ts`.
 *
 * Note on the accuracy gate: the Day 2 brief quoted a 13-access reference string
 * but expected the fault counts of the classic 20-access textbook string (FIFO 15,
 * Optimal 9). Fifteen faults cannot happen in thirteen accesses, so BOTH strings
 * are tested here - the full classic string against 15/12/9, and the quoted prefix
 * against its own hand-verified 10/9/7.
 */

import { describe, expect, it } from "vitest";

import {
  BELADY_REFERENCE_STRING,
  CLASSIC_REFERENCE_STRING,
  EngineError,
  QUOTED_REFERENCE_STRING,
  REPLACEMENT_ALGORITHMS,
  TEXTBOOK_FRAME_COUNT,
  createReplacementState,
  frameHoldingPage,
  runReferenceString,
  stepReplacement,
} from "../../engine";
import type {
  PageNumber,
  ReplacementAlgorithm,
  ReplacementEvent,
  ReplacementEventType,
  ReplacementState,
} from "../../engine";

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

/** Freeze a value (and everything inside it), so any mutation throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** The events of one type, narrowed so the payload can be asserted. */
function eventsOfType<T extends ReplacementEventType>(
  events: readonly ReplacementEvent[],
  type: T,
): readonly Extract<ReplacementEvent, { type: T }>[] {
  return events.filter((event): event is Extract<ReplacementEvent, { type: T }> => {
    return event.type === type;
  });
}

/** Page numbers in RAM, frame by frame, with free frames as `null`. */
function pagesIn(frames: ReplacementState["frames"]): readonly (PageNumber | null)[] {
  return frames.map((frame) => frame.pageNumber);
}

/** The resident page numbers only, i.e. `pagesIn` without the free frames. */
function residentPages(frames: ReplacementState["frames"]): readonly PageNumber[] {
  return frames
    .map((frame) => frame.pageNumber)
    .filter((pageNumber): pageNumber is PageNumber => pageNumber !== null);
}

/** The outcome of every access, as a compact string such as `FFFH`. */
function outcomePattern(algorithm: Parameters<typeof runReferenceString>[0]): string {
  return runReferenceString(algorithm, QUOTED_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT)
    .trace.map((entry) => (entry.outcome === "FAULT" ? "F" : "H"))
    .join("");
}

describe("accuracy: the classic 20-access string with 3 frames", () => {
  it("FIFO faults 15 times", () => {
    const run = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.accesses).toBe(20);
    expect(run.pageFaults).toBe(15);
    expect(run.hits).toBe(5);
    expect(run.evictions).toBe(12);
    expect(pagesIn(run.finalFrames)).toEqual([7, 0, 1]);
  });

  it("LRU faults 12 times", () => {
    const run = runReferenceString("LRU", CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.accesses).toBe(20);
    expect(run.pageFaults).toBe(12);
    expect(run.hits).toBe(8);
    expect(run.evictions).toBe(9);
    expect(pagesIn(run.finalFrames)).toEqual([1, 0, 7]);
  });

  it("Optimal faults 9 times", () => {
    const run = runReferenceString("OPTIMAL", CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.accesses).toBe(20);
    expect(run.pageFaults).toBe(9);
    expect(run.hits).toBe(11);
    expect(run.evictions).toBe(6);
    expect(pagesIn(run.finalFrames)).toEqual([7, 0, 1]);
  });

  it("is the expected ordering of the three policies: 9 < 12 < 15", () => {
    const faults = (algorithm: Parameters<typeof runReferenceString>[0]): number => {
      return runReferenceString(algorithm, CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT)
        .pageFaults;
    };

    expect(faults("OPTIMAL")).toBeLessThan(faults("LRU"));
    expect(faults("LRU")).toBeLessThan(faults("FIFO"));
  });

  it("Optimal is never worse than FIFO or LRU, for every frame count from 1 to 6", () => {
    for (let frameCount = 1; frameCount <= 6; frameCount += 1) {
      const optimal = runReferenceString("OPTIMAL", CLASSIC_REFERENCE_STRING, frameCount);
      const fifo = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, frameCount);
      const lru = runReferenceString("LRU", CLASSIC_REFERENCE_STRING, frameCount);

      expect(optimal.pageFaults).toBeLessThanOrEqual(fifo.pageFaults);
      expect(optimal.pageFaults).toBeLessThanOrEqual(lru.pageFaults);
    }
  });
});
describe("accuracy: the 13-access string quoted in the brief", () => {
  it("is the first 13 accesses of the classic string", () => {
    expect(QUOTED_REFERENCE_STRING).toHaveLength(13);
    expect(QUOTED_REFERENCE_STRING).toEqual(CLASSIC_REFERENCE_STRING.slice(0, 13));
  });

  it("FIFO faults 10 times - 15 would be impossible in 13 accesses", () => {
    const run = runReferenceString("FIFO", QUOTED_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.accesses).toBe(13);
    expect(run.pageFaults).toBe(10);
    expect(run.hits).toBe(3);
    expect(run.evictions).toBe(7);
    expect(pagesIn(run.finalFrames)).toEqual([0, 2, 3]);
  });

  it("LRU faults 9 times", () => {
    const run = runReferenceString("LRU", QUOTED_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.pageFaults).toBe(9);
    expect(run.hits).toBe(4);
    expect(run.evictions).toBe(6);
    expect(pagesIn(run.finalFrames)).toEqual([0, 3, 2]);
  });

  it("Optimal faults 7 times", () => {
    const run = runReferenceString("OPTIMAL", QUOTED_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    expect(run.pageFaults).toBe(7);
    expect(run.hits).toBe(6);
    expect(run.evictions).toBe(4);
    expect(pagesIn(run.finalFrames)).toEqual([2, 0, 3]);
  });

  it("never reports more faults than accesses", () => {
    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const run = runReferenceString(algorithm, QUOTED_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

      expect(run.pageFaults).toBeLessThanOrEqual(run.accesses);
    }
  });

  it("carries the published counts only when the whole string is used", () => {
    // The brief's 15 / 9 are the textbook values for all 20 accesses.
    expect(runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 3).pageFaults).toBe(15);
    expect(runReferenceString("OPTIMAL", CLASSIC_REFERENCE_STRING, 3).pageFaults).toBe(9);
    expect(runReferenceString("FIFO", QUOTED_REFERENCE_STRING, 3).pageFaults).not.toBe(15);
  });
});

describe("Belady's anomaly", () => {
  it("FIFO faults MORE with 4 frames than with 3", () => {
    const three = runReferenceString("FIFO", BELADY_REFERENCE_STRING, 3);
    const four = runReferenceString("FIFO", BELADY_REFERENCE_STRING, 4);

    expect(three.pageFaults).toBe(9);
    expect(three.hits).toBe(3);
    expect(four.pageFaults).toBe(10);
    expect(four.hits).toBe(2);
    expect(four.pageFaults).toBeGreaterThan(three.pageFaults);
  });

  it("LRU (a stack algorithm) faults FEWER with 4 frames: 10 -> 8", () => {
    const three = runReferenceString("LRU", BELADY_REFERENCE_STRING, 3);
    const four = runReferenceString("LRU", BELADY_REFERENCE_STRING, 4);

    expect(three.pageFaults).toBe(10);
    expect(three.hits).toBe(2);
    expect(four.pageFaults).toBe(8);
    expect(four.hits).toBe(4);
    expect(four.pageFaults).toBeLessThan(three.pageFaults);
  });

  it("Optimal faults FEWER with 4 frames: 7 -> 6", () => {
    const three = runReferenceString("OPTIMAL", BELADY_REFERENCE_STRING, 3);
    const four = runReferenceString("OPTIMAL", BELADY_REFERENCE_STRING, 4);

    expect(three.pageFaults).toBe(7);
    expect(three.hits).toBe(5);
    expect(four.pageFaults).toBe(6);
    expect(four.hits).toBe(6);
    expect(four.pageFaults).toBeLessThan(three.pageFaults);
  });

  it("more frames never hurt LRU or Optimal on this string", () => {
    for (const algorithm of ["LRU", "OPTIMAL"] as const) {
      let previous = Number.POSITIVE_INFINITY;

      for (let frameCount = 1; frameCount <= 4; frameCount += 1) {
        const faults = runReferenceString(algorithm, BELADY_REFERENCE_STRING, frameCount)
          .pageFaults;

        expect(faults).toBeLessThanOrEqual(previous);
        previous = faults;
      }
    }
  });
});
describe("events", () => {
  it("a hit emits exactly one PAGE_HIT and no frame work", () => {
    const run = runReferenceString("FIFO", [5, 5], 1);

    expect(run.events.map((event) => event.type)).toEqual(["PAGE_FAULT", "LOAD_PAGE", "PAGE_HIT"]);
    expect(run.events[2]).toEqual({
      type: "PAGE_HIT",
      sequence: 2,
      accessIndex: 1,
      pageNumber: 5,
      frameNumber: 0,
    });
  });

  it("a cold miss emits PAGE_FAULT then LOAD_PAGE", () => {
    const run = runReferenceString("FIFO", [7], 3);

    expect(run.events.map((event) => event.type)).toEqual(["PAGE_FAULT", "LOAD_PAGE"]);
    expect(run.events[0]).toEqual({
      type: "PAGE_FAULT",
      sequence: 0,
      accessIndex: 0,
      pageNumber: 7,
      reason: "PAGE_NOT_PRESENT",
      freeFramesRemaining: 3,
    });
    expect(run.events[1]).toEqual({
      type: "LOAD_PAGE",
      sequence: 1,
      accessIndex: 0,
      pageNumber: 7,
      frameNumber: 0,
    });
  });

  it("a miss with no free frame emits the whole causal chain, in order", () => {
    const run = runReferenceString("FIFO", [1, 2, 3, 4], 3);

    expect(run.events.map((event) => event.type)).toEqual([
      "PAGE_FAULT",
      "LOAD_PAGE",
      "PAGE_FAULT",
      "LOAD_PAGE",
      "PAGE_FAULT",
      "LOAD_PAGE",
      "PAGE_FAULT",
      "REPLACEMENT_DECISION",
      "EVICT_PAGE",
      "LOAD_PAGE",
    ]);
  });

  it("reports how many frames were still free when the fault happened", () => {
    const run = runReferenceString("FIFO", [1, 2, 3, 4], 3);
    const faults = eventsOfType(run.events, "PAGE_FAULT");

    expect(faults.map((fault) => fault.freeFramesRemaining)).toEqual([3, 2, 1, 0]);
  });

  it("numbers every event from 0, without gaps", () => {
    const run = runReferenceString("LRU", CLASSIC_REFERENCE_STRING, 3);

    expect(run.events.map((event) => event.sequence)).toEqual(
      run.events.map((_, index) => index),
    );
  });

  it("makes the decision name the same page and frame the eviction removes", () => {
    const run = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 3);
    const decisions = eventsOfType(run.events, "REPLACEMENT_DECISION");
    const evictions = eventsOfType(run.events, "EVICT_PAGE");

    expect(decisions).toHaveLength(12);
    expect(evictions).toHaveLength(12);

    for (const [index, decision] of decisions.entries()) {
      const eviction = evictions[index];

      expect(eviction?.pageNumber).toBe(decision.victimPageNumber);
      expect(eviction?.frameNumber).toBe(decision.victimFrameNumber);
      expect(eviction?.accessIndex).toBe(decision.accessIndex);
      expect(eviction?.algorithm).toBe("FIFO");
      expect(decision.algorithm).toBe("FIFO");
      expect(decision.evidence.rule).toBe("FIFO_EARLIEST_LOADED");
    }
  });

  it("pins the first replacement of the classic run", () => {
    const run = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 3);
    const decisions = eventsOfType(run.events, "REPLACEMENT_DECISION");

    // Access index 3 is the first access that finds all three frames full.
    expect(decisions[0]).toEqual({
      type: "REPLACEMENT_DECISION",
      sequence: 7,
      accessIndex: 3,
      pageNumber: 2,
      algorithm: "FIFO",
      victimPageNumber: 7,
      victimFrameNumber: 0,
      evidence: {
        rule: "FIFO_EARLIEST_LOADED",
        victimLoadedAt: 0,
        candidateFrameNumbers: [0, 1, 2],
      },
    });
  });

  it("always follows an eviction with the load that uses the freed frame", () => {
    const run = runReferenceString("OPTIMAL", CLASSIC_REFERENCE_STRING, 3);

    for (const [index, event] of run.events.entries()) {
      if (event.type !== "EVICT_PAGE") {
        continue;
      }

      const decision = run.events[index - 1];
      const load = run.events[index + 1];

      expect(load).toMatchObject({ type: "LOAD_PAGE", frameNumber: event.frameNumber });
      expect(load?.pageNumber).toBe(
        decision?.type === "REPLACEMENT_DECISION" ? decision.pageNumber : -1,
      );
    }
  });

  it("keeps every access to exactly one outcome", () => {
    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const run = runReferenceString(algorithm, CLASSIC_REFERENCE_STRING, 3);

      for (const entry of run.trace) {
        const types = entry.events.map((event) => event.type);

        if (entry.outcome === "HIT") {
          expect(types).toEqual(["PAGE_HIT"]);
        } else {
          expect(types[0]).toBe("PAGE_FAULT");
          expect(types.at(-1)).toBe("LOAD_PAGE");
        }
      }
    }
  });
});

describe("the trace", () => {
  it("has one entry per access, in the order of the reference string", () => {
    const run = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 3);

    expect(run.trace).toHaveLength(20);
    expect(run.trace.map((entry) => entry.accessIndex)).toEqual([...CLASSIC_REFERENCE_STRING.keys()]);
    expect(run.trace.map((entry) => entry.pageNumber)).toEqual([...CLASSIC_REFERENCE_STRING]);
  });

  it("is the flat event list, regrouped per access", () => {
    const run = runReferenceString("OPTIMAL", CLASSIC_REFERENCE_STRING, 3);

    expect(run.trace.flatMap((entry) => entry.events)).toEqual(run.events);
    // One event per hit, a fault+load pair per fault, and a decision+evict pair
    // per eviction.
    expect(run.events).toHaveLength(run.hits + 2 * run.pageFaults + 2 * run.evictions);
  });

  it("records the victim of a replacement, in the frame it was taken from", () => {
    const run = runReferenceString("FIFO", [1, 2, 3, 4], 3);

    expect(run.trace[3]?.outcome).toBe("FAULT");
    expect(run.trace[3]?.frameNumber).toBe(0);
    expect(run.trace[3]?.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
    expect(run.trace[0]?.evicted).toBeNull();
  });

  it("snapshots RAM after every access, and never rewrites an old snapshot", () => {
    const run = runReferenceString("FIFO", [1, 2, 3, 4], 3);

    expect(pagesIn(run.trace[0]?.frames ?? [])).toEqual([1, null, null]);
    expect(pagesIn(run.trace[3]?.frames ?? [])).toEqual([4, 2, 3]);
    expect(pagesIn(run.finalFrames)).toEqual([4, 2, 3]);

    // The first snapshot still describes the moment it was taken.
    expect(pagesIn(run.trace[0]?.frames ?? [])).toEqual([1, null, null]);
    expect(run.trace[0]?.frames).not.toBe(run.finalFrames);
    expect(run.trace[0]).not.toBe(run.trace[3]);
  });

  it("starts with every frame empty, and ends where the last snapshot says", () => {
    const run = runReferenceString("LRU", CLASSIC_REFERENCE_STRING, 3);

    expect(pagesIn(run.initialFrames)).toEqual([null, null, null]);
    expect(run.finalFrames).toEqual(run.trace.at(-1)?.frames);
    expect(residentPages(run.finalFrames)).toEqual([1, 0, 7]);
  });

  it("shows FIFO and LRU holding identical state but choosing different victims", () => {
    const fifo = runReferenceString("FIFO", [1, 2, 3, 1, 4], 3);
    const lru = runReferenceString("LRU", [1, 2, 3, 1, 4], 3);

    // Same frame contents after the hit, recorded bookkeeping and all.
    expect(fifo.trace[3]?.frames[0]).toEqual({
      frameNumber: 0,
      pageNumber: 1,
      loadedAt: 0,
      lastUsedAt: 3,
      useCount: 1,
    });
    expect(lru.trace[3]?.frames[0]).toEqual(fifo.trace[3]?.frames[0]);

    // FIFO evicts the page that arrived first; LRU evicts the one used longest ago.
    expect(fifo.trace[4]?.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
    expect(lru.trace[4]?.evicted).toEqual({ pageNumber: 2, frameNumber: 1 });
  });

  it("pins the whole outcome pattern of the quoted 13-access string", () => {
    expect(outcomePattern("FIFO")).toBe("FFFFHFFFFFFHH");
    expect(outcomePattern("LRU")).toBe("FFFFHFHFFFFHH");
    expect(outcomePattern("OPTIMAL")).toBe("FFFFHFHFHHFHH");
  });
});

describe("purity and determinism", () => {
  it("never mutates the reference string it is given", () => {
    const reference = deepFreeze([1, 2, 3, 1, 4]);
    const run = runReferenceString("OPTIMAL", reference, 3);

    expect([...reference]).toEqual([1, 2, 3, 1, 4]);
    expect(run.referenceString).toEqual([1, 2, 3, 1, 4]);
    expect(run.referenceString).not.toBe(reference);
  });

  it("keeps its result independent of later changes to the caller's array", () => {
    const reference: PageNumber[] = [1, 2, 3, 1, 4];
    const run = runReferenceString("FIFO", reference, 3);

    reference.push(99);
    reference[0] = 42;

    expect(run.referenceString).toEqual([1, 2, 3, 1, 4]);
    expect(run.pageFaults).toBe(4);
    expect(run.trace[0]?.pageNumber).toBe(1);
    expect(run.trace).toHaveLength(5);
  });

  it("never mutates the state it is given to stepReplacement", () => {
    const initial = deepFreeze(createReplacementState("LRU", 2));

    const first = stepReplacement(initial, { pageNumber: 1 });
    const second = stepReplacement(first.state, { pageNumber: 2 });
    const third = stepReplacement(second.state, { pageNumber: 3 });

    expect(pagesIn(initial.frames)).toEqual([null, null]);
    expect(initial.stats.pageFaults).toBe(0);
    expect(third.outcome).toBe("FAULT");
    expect(third.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
    expect(pagesIn(third.state.frames)).toEqual([3, 2]);
  });

  it("reports per-access stats that only ever grow", () => {
    const first = stepReplacement(createReplacementState("FIFO", 1), { pageNumber: 1 });

    expect(first.outcome).toBe("FAULT");
    expect(first.frameNumber).toBe(0);
    expect(first.evicted).toBeNull();
    expect(first.state.stats).toEqual({
      accesses: 1,
      hits: 0,
      pageFaults: 1,
      loads: 1,
      evictions: 0,
    });

    const second = stepReplacement(first.state, { pageNumber: 1 });

    expect(second.outcome).toBe("HIT");
    expect(second.events.map((event) => event.type)).toEqual(["PAGE_HIT"]);
    expect(second.state.stats).toEqual({
      accesses: 2,
      hits: 1,
      pageFaults: 1,
      loads: 1,
      evictions: 0,
    });

    const third = stepReplacement(second.state, { pageNumber: 2 });

    expect(third.outcome).toBe("FAULT");
    expect(third.evicted).toEqual({ pageNumber: 1, frameNumber: 0 });
    expect(third.state.stats).toEqual({
      accesses: 3,
      hits: 1,
      pageFaults: 2,
      loads: 2,
      evictions: 1,
    });
  });

  it("finds a resident page by page number, and nothing else", () => {
    const { state } = stepReplacement(createReplacementState("FIFO", 2), { pageNumber: 5 });

    expect(frameHoldingPage(state.frames, 5)?.frameNumber).toBe(0);
    expect(frameHoldingPage(state.frames, 6)).toBeNull();
    expect(frameHoldingPage(createReplacementState("FIFO", 2).frames, 0)).toBeNull();
  });

  it("is deterministic: identical runs are deeply equal and share nothing", () => {
    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const first = runReferenceString(algorithm, CLASSIC_REFERENCE_STRING, 3);
      const second = runReferenceString(algorithm, CLASSIC_REFERENCE_STRING, 3);

      expect(first).toEqual(second);
      expect(first.events).not.toBe(second.events);
      expect(first.events[0]).not.toBe(second.events[0]);
      expect(first.finalFrames).not.toBe(second.finalFrames);
      expect(first.trace).not.toBe(second.trace);
    }
  });
});
describe("edge cases", () => {
  it("an empty reference string touches nothing", () => {
    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const run = runReferenceString(algorithm, [], 3);

      expect(run.accesses).toBe(0);
      expect(run.hits).toBe(0);
      expect(run.pageFaults).toBe(0);
      expect(run.loads).toBe(0);
      expect(run.evictions).toBe(0);
      expect(run.events).toEqual([]);
      expect(run.trace).toEqual([]);
      expect(pagesIn(run.finalFrames)).toEqual([null, null, null]);
      expect(run.finalFrames).toHaveLength(3);
    }
  });

  it("a single frame re-faults on every alternation, for every policy", () => {
    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const run = runReferenceString(algorithm, [1, 2, 1, 2], 1);

      expect(run.pageFaults).toBe(4);
      expect(run.hits).toBe(0);
      expect(run.evictions).toBe(3);
      expect(pagesIn(run.finalFrames)).toEqual([2]);
    }
  });

  it("never faults twice on the same page when it stays resident", () => {
    const run = runReferenceString("FIFO", [5, 5, 5, 5], 2);

    expect(run.pageFaults).toBe(1);
    expect(run.hits).toBe(3);
    expect(run.evictions).toBe(0);
    expect(run.finalFrames[0]).toEqual({
      frameNumber: 0,
      pageNumber: 5,
      loadedAt: 0,
      lastUsedAt: 3,
      useCount: 3,
    });
    expect(eventsOfType(run.events, "PAGE_FAULT")).toHaveLength(1);
    expect(eventsOfType(run.events, "LOAD_PAGE")).toHaveLength(1);
  });

  it("wastes frames instead of evicting when RAM is larger than the working set", () => {
    const run = runReferenceString("LRU", [1, 2, 3], 5);

    expect(run.pageFaults).toBe(3);
    expect(run.evictions).toBe(0);
    expect(pagesIn(run.finalFrames)).toEqual([1, 2, 3, null, null]);
    expect(eventsOfType(run.events, "REPLACEMENT_DECISION")).toEqual([]);
  });

  it("evicts only once the working set no longer fits", () => {
    const run = runReferenceString("FIFO", [1, 2, 3, 4], 3);

    expect(run.pageFaults).toBe(4);
    expect(run.evictions).toBe(1);
    expect(pagesIn(run.finalFrames)).toEqual([4, 2, 3]);
  });

  it("treats a page number as an identity, however large", () => {
    const run = runReferenceString("LRU", [1_048_575, 0, 1_048_575], 2);

    expect(run.pageFaults).toBe(2);
    expect(run.hits).toBe(1);
    expect(residentPages(run.finalFrames)).toEqual([1_048_575, 0]);
  });

  it("handles a string of one repeated page in one frame", () => {
    const run = runReferenceString("OPTIMAL", [0, 0, 0], 1);

    expect(run.pageFaults).toBe(1);
    expect(run.hits).toBe(2);
    expect(run.evictions).toBe(0);
    expect(run.events.map((event) => event.type)).toEqual([
      "PAGE_FAULT",
      "LOAD_PAGE",
      "PAGE_HIT",
      "PAGE_HIT",
    ]);
  });
});

describe("rejected input", () => {
  it("rejects frame counts that are not positive integers", () => {
    const badFrameCounts = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53];

    for (const frameCount of badFrameCounts) {
      const error = expectEngineError(() => createReplacementState("FIFO", frameCount));

      expect(error.code).toBe("INVALID_FRAME_COUNT");
      expect(error.message).toContain("frame count must be a positive integer");
      expect(expectEngineError(() => runReferenceString("FIFO", [1], frameCount)).code).toBe(
        "INVALID_FRAME_COUNT",
      );
    }
  });

  it("rejects unknown algorithm names instead of silently picking one", () => {
    const badAlgorithms = ["CLOCK", "fifo", "Optimal", "", "LFU"];

    for (const algorithm of badAlgorithms) {
      const error = expectEngineError(() =>
        runReferenceString(algorithm as ReplacementAlgorithm, [1], 1),
      );

      expect(error.code).toBe("INVALID_REPLACEMENT_ALGORITHM");
      expect(error.message).toContain("expected one of");
      expect(expectEngineError(() => createReplacementState(algorithm as ReplacementAlgorithm, 4))
        .code).toBe("INVALID_REPLACEMENT_ALGORITHM");
    }
  });

  it("rejects page references that are not non-negative integers", () => {
    const badReferences: readonly (readonly unknown[])[] = [
      [-1],
      [-4096],
      [1.5],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      ["1"],
      [null],
    ];

    for (const reference of badReferences) {
      const error = expectEngineError(() =>
        runReferenceString("FIFO", reference as readonly PageNumber[], 1),
      );

      expect(error.code).toBe("INVALID_REFERENCE_STRING");
      expect(error.message).toContain("reference 0");
    }
  });

  it("rejects a sparse array instead of skipping its holes", () => {
    // `Array.prototype.every` skips holes, so this would sail through a naive check.
    const sparse = new Array<PageNumber>(3);
    sparse[0] = 1;
    sparse[2] = 2;

    const error = expectEngineError(() => runReferenceString("FIFO", sparse, 2));

    expect(error.code).toBe("INVALID_REFERENCE_STRING");
    expect(error.message).toContain("reference 1");
    expect(error.message).toContain("undefined");
  });

  it("rejects a reference that is not an array at all", () => {
    const error = expectEngineError(() =>
      runReferenceString("FIFO", "7,0,1" as unknown as readonly PageNumber[], 3),
    );

    expect(error.code).toBe("INVALID_REFERENCE_STRING");
    expect(error.message).toContain("must be an array");
  });

  it("reports the position of the offending reference", () => {
    const error = expectEngineError(() => runReferenceString("FIFO", [7, 0, -1], 3));

    expect(error.code).toBe("INVALID_REFERENCE_STRING");
    expect(error.message).toContain("reference 2");
  });
});
describe("accounting invariants", () => {
  /**
   * Every number a run reports is derived from the same events, so these identities
   * must hold for every policy, every string and every frame count. A policy that
   * lies about its faults cannot satisfy them all at once.
   */
  const strings: readonly (readonly [string, readonly PageNumber[]])[] = [
    ["classic (20 accesses)", CLASSIC_REFERENCE_STRING],
    ["quoted (13 accesses)", QUOTED_REFERENCE_STRING],
    ["belady (12 accesses)", BELADY_REFERENCE_STRING],
    ["single page", [3, 3, 3]],
    ["empty", []],
  ];

  it("keeps accesses = hits + faults and loads = faults", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        for (const frameCount of [1, 2, 3, 5]) {
          const run = runReferenceString(algorithm, referenceString, frameCount);

          expect(run.accesses).toBe(referenceString.length);
          expect(run.hits + run.pageFaults).toBe(run.accesses);
          expect(run.loads).toBe(run.pageFaults);
        }
      }
    }
  });

  it("accounts for every frame: resident + free = frame count, always", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, referenceString, 3);

        for (const entry of run.trace) {
          expect(entry.frames).toHaveLength(3);
          expect(residentPages(entry.frames)).toHaveLength(new Set(residentPages(entry.frames)).size);
        }
        expect(residentPages(run.finalFrames).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("never reports more distinct resident pages than frames", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, referenceString, 3);

        expect(new Set(residentPages(run.finalFrames)).size).toBe(
          residentPages(run.finalFrames).length,
        );
      }
    }
  });

  it("never evicts a page that is not in RAM, and never evicts into a free frame", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, referenceString, 2);

        for (const [index, entry] of run.trace.entries()) {
          if (entry.evicted === null) {
            continue;
          }

          const before = run.trace[index - 1] ?? { frames: run.initialFrames };
          const resident = before.frames.map((frame) => frame.pageNumber);

          expect(resident).toContain(entry.evicted.pageNumber);
          expect(resident[entry.evicted.frameNumber]).toBe(entry.evicted.pageNumber);
          expect(entry.frames[entry.evicted.frameNumber]?.pageNumber).toBe(entry.pageNumber);
        }
      }
    }
  });

  it("evicts exactly once per fault that finds RAM full", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, referenceString, 2);
        const fullFaults = eventsOfType(run.events, "PAGE_FAULT").filter(
          (fault) => fault.freeFramesRemaining === 0,
        ).length;

        expect(run.evictions).toBe(fullFaults);
        expect(run.pageFaults - run.evictions).toBeLessThanOrEqual(2);
      }
    }
  });

  it("keeps HIT entries free of any frame work", () => {
    for (const [, referenceString] of strings) {
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, referenceString, 2);

        for (const entry of run.trace) {
          if (entry.outcome !== "HIT") {
            continue;
          }

          expect(entry.evicted).toBeNull();
          expect(entry.events.map((event) => event.type)).toEqual(["PAGE_HIT"]);
          expect(entry.frames[entry.frameNumber]?.pageNumber).toBe(entry.pageNumber);
        }
      }
    }
  });
});