/**
 * Property tests for the replacement algorithms.
 *
 * These are the invariants a textbook claims and a simulation must actually keep. They
 * are generated, not hand-picked, so they cover reference strings nobody thought to
 * write down - and they are SEEDED, so a failure is reproducible forever: the message
 * names the seed, the string and the frame count, and re-running the suite replays the
 * exact same inputs. `Math.random()` is never called.
 *
 * THE PROPERTIES, AND WHAT THEY ARE NOT
 *
 *   Optimal <= FIFO        true: Belady's MIN is the lower bound for any policy that
 *                          only looks at the past.
 *   Optimal <= LRU         true, for the same reason.
 *   LRU monotone in frames true: LRU is a STACK algorithm. More memory can only
 *                          remove faults, never add them.
 *   Optimal monotone       true, for the same reason.
 *   FIFO monotone          FALSE - and this file deliberately does NOT assert it.
 *                          FIFO is not a stack algorithm; Belady's anomaly is real.
 *                          The Belady string is asserted positively below (9 faults
 *                          with 3 frames, 10 with 4), which is the honest way to pin
 *                          the anomaly without inventing a property FIFO must break.
 */

import { describe, expect, it } from "vitest";

import {
  BELADY_REFERENCE_STRING,
  CLASSIC_REFERENCE_STRING,
  REPLACEMENT_ALGORITHMS,
  runReferenceString,
} from "../../engine";
import type { PageNumber, ReferenceStringRun } from "../../engine";

/** Deterministic PRNG (mulberry32): same seed, same sequence, forever. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One generated case, carrying everything needed to reproduce a failure. */
interface Case {
  readonly seed: number;
  readonly referenceString: readonly PageNumber[];
  readonly frameCount: number;
}

const PAGE_ALPHABET = 6; // pages 0..5: small enough to hit pages again, often
const CASES_PER_PROPERTY = 300;
const MAX_LENGTH = 40;

function caseAt(seed: number, index: number): Case {
  const random = mulberry32(seed + index * 7919);
  const length = 1 + Math.floor(random() * MAX_LENGTH);
  const referenceString: PageNumber[] = [];
  for (let position = 0; position < length; position += 1) {
    referenceString.push(Math.floor(random() * PAGE_ALPHABET));
  }
  return {
    seed: seed + index * 7919,
    referenceString,
    frameCount: 1 + Math.floor(random() * 6),
  };
}

/** Run all three algorithms over one case, keyed by algorithm name. */
function runsFor(
  referenceString: readonly PageNumber[],
  frameCount: number,
): {
  readonly FIFO: ReferenceStringRun;
  readonly LRU: ReferenceStringRun;
  readonly OPTIMAL: ReferenceStringRun;
} {
  return {
    FIFO: runReferenceString("FIFO", referenceString, frameCount),
    LRU: runReferenceString("LRU", referenceString, frameCount),
    OPTIMAL: runReferenceString("OPTIMAL", referenceString, frameCount),
  };
}

/** The message a failing property hands back: seed, string, frames, both counts. */
function repro(case_: Case, algorithm: string, faults: number, bound: number): string {
  return [
    `FAILED PROPERTY for seed ${case_.seed}`,
    `algorithm: ${algorithm}`,
    `frameCount: ${case_.frameCount}`,
    `faults: ${faults}`,
    `bound: ${bound}`,
    `referenceString: [${case_.referenceString.join(", ")}]`,
  ].join(" | ");
}

describe("replacement properties (generated, seeded)", () => {
  it("Optimal never faults more than FIFO, for every generated case", () => {
    const seed = 20260920; // fixed on purpose: a failure must be reproducible
    for (let index = 0; index < CASES_PER_PROPERTY; index += 1) {
      const case_ = caseAt(seed, index);
      const runs = runsFor(case_.referenceString, case_.frameCount);
      expect(
        runs.OPTIMAL.pageFaults,
        repro(case_, "OPTIMAL<=FIFO", runs.OPTIMAL.pageFaults, runs.FIFO.pageFaults),
      ).toBeLessThanOrEqual(runs.FIFO.pageFaults);
    }
  });

  it("Optimal never faults more than LRU, for every generated case", () => {
    const seed = 20260921;
    for (let index = 0; index < CASES_PER_PROPERTY; index += 1) {
      const case_ = caseAt(seed, index);
      const runs = runsFor(case_.referenceString, case_.frameCount);
      expect(
        runs.OPTIMAL.pageFaults,
        repro(case_, "OPTIMAL<=LRU", runs.OPTIMAL.pageFaults, runs.LRU.pageFaults),
      ).toBeLessThanOrEqual(runs.LRU.pageFaults);
    }
  });

  it("LRU is monotone in frame count: more frames never mean more faults", () => {
    const seed = 20260922;
    for (let index = 0; index < CASES_PER_PROPERTY; index += 1) {
      const case_ = caseAt(seed, index);
      const fewer = runReferenceString("LRU", case_.referenceString, case_.frameCount);
      const more = runReferenceString("LRU", case_.referenceString, case_.frameCount + 1);
      expect(
        more.pageFaults,
        repro(case_, "LRU monotone", more.pageFaults, fewer.pageFaults),
      ).toBeLessThanOrEqual(fewer.pageFaults);
    }
  });

  it("Optimal is monotone in frame count: more frames never mean more faults", () => {
    const seed = 20260923;
    for (let index = 0; index < CASES_PER_PROPERTY; index += 1) {
      const case_ = caseAt(seed, index);
      const fewer = runReferenceString("OPTIMAL", case_.referenceString, case_.frameCount);
      const more = runReferenceString("OPTIMAL", case_.referenceString, case_.frameCount + 1);
      expect(
        more.pageFaults,
        repro(case_, "OPTIMAL monotone", more.pageFaults, fewer.pageFaults),
      ).toBeLessThanOrEqual(fewer.pageFaults);
    }
  });
});

describe("accounting invariants (generated)", () => {
  it("stays exact for every generated case and every algorithm", () => {
    const seed = 20260924;
    for (let index = 0; index < CASES_PER_PROPERTY; index += 1) {
      const case_ = caseAt(seed, index);
      for (const algorithm of REPLACEMENT_ALGORITHMS) {
        const run = runReferenceString(algorithm, case_.referenceString, case_.frameCount);

        expect(
          run.accesses,
          repro(case_, `${algorithm} accesses`, run.accesses, case_.referenceString.length),
        ).toBe(case_.referenceString.length);
        // Every access is exactly one of the two outcomes, so no access is counted
        // twice and none is dropped: the numbers a Compare screen shows must add up.
        expect(
          run.hits + run.pageFaults,
          repro(case_, `${algorithm} hits+faults`, run.hits + run.pageFaults, run.accesses),
        ).toBe(run.accesses);
        // A fault always loads exactly one page - never zero, never two.
        expect(
          run.loads,
          repro(case_, `${algorithm} loads==faults`, run.loads, run.pageFaults),
        ).toBe(run.pageFaults);
        // An eviction needs a full RAM, so it can never outnumber the faults that forced it.
        expect(
          run.evictions,
          repro(case_, `${algorithm} evictions<=faults`, run.evictions, run.pageFaults),
        ).toBeLessThanOrEqual(run.pageFaults);
        expect(run.evictions).toBeGreaterThanOrEqual(0);
        expect(run.pageFaults).toBeGreaterThanOrEqual(0);

        // No page may occupy two frames at once, at any step of the run.
        for (const entry of run.trace) {
          const resident = entry.frames
            .map((frame) => frame.pageNumber)
            .filter((page) => page !== null);
          expect(
            new Set(resident).size,
            repro(case_, `${algorithm} distinct pages`, resident.length, entry.frames.length),
          ).toBe(resident.length);
        }
      }
    }
  });

  it("is deterministic: the same inputs always produce the same fault counts", () => {
    const seed = 20260925;
    const first = caseAt(seed, 0);
    const second = caseAt(seed, 0);

    for (const algorithm of REPLACEMENT_ALGORITHMS) {
      const one = runReferenceString(algorithm, first.referenceString, first.frameCount);
      const two = runReferenceString(algorithm, second.referenceString, second.frameCount);
      expect(one.pageFaults).toBe(two.pageFaults);
      expect(one.trace.map((entry) => entry.outcome)).toEqual(
        two.trace.map((entry) => entry.outcome),
      );
    }
  });
});

describe("Belady's anomaly (the property FIFO is allowed to break)", () => {
  it("shows the anomaly on the textbook string: 3 frames, 9 faults; 4 frames, 10", () => {
    // Pinned positively, not inferred: FIFO genuinely is not monotone, so the honest
    // test is the documented counter-example itself, not an absence of a guarantee.
    expect(runReferenceString("FIFO", BELADY_REFERENCE_STRING, 3).pageFaults).toBe(9);
    expect(runReferenceString("FIFO", BELADY_REFERENCE_STRING, 4).pageFaults).toBe(10);
  });

  it("never shows the anomaly on a stack algorithm, for every generated case", () => {
    // LRU and Optimal ARE monotone, and that is asserted over the generated cases
    // above; this pins it for the anomaly string specifically, so the two facts the
    // textbook contrasts are both in the suite.
    expect(runReferenceString("LRU", BELADY_REFERENCE_STRING, 3).pageFaults).toBe(10);
    expect(runReferenceString("LRU", BELADY_REFERENCE_STRING, 4).pageFaults).toBe(8);
    expect(runReferenceString("OPTIMAL", BELADY_REFERENCE_STRING, 3).pageFaults).toBe(7);
    expect(runReferenceString("OPTIMAL", BELADY_REFERENCE_STRING, 4).pageFaults).toBe(6);
  });
});

describe("the documented reference values still hold", () => {
  it("classic string, 3 frames: FIFO 15, LRU 12, Optimal 9", () => {
    // This is the triple the Compare screen opens with, so it is asserted at the
    // engine level as well as at the UI level - a wrong column cannot hide between
    // the two.
    const runs = runsFor(CLASSIC_REFERENCE_STRING, 3);
    expect(runs.FIFO.pageFaults).toBe(15);
    expect(runs.FIFO.hits).toBe(5);
    expect(runs.LRU.pageFaults).toBe(12);
    expect(runs.LRU.hits).toBe(8);
    expect(runs.OPTIMAL.pageFaults).toBe(9);
    expect(runs.OPTIMAL.hits).toBe(11);
  });
});

