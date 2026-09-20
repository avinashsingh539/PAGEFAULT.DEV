/**
 * Compare Mode: the SAME reference string through FIFO, LRU and Optimal, side by side.
 *
 * The single most important thing about this file is what it does NOT contain: any
 * replacement logic. Every column below is produced by calling the engine's one shared
 * harness, `runReferenceString`, once per algorithm. There is no second FIFO anywhere
 * in the frontend, because a second implementation is a second answer, and the whole
 * point of the screen is that the numbers agree with the textbook.
 *
 * Everything the screen draws - the fault count, the eviction, the frame contents at
 * each access - is read straight out of the engine's `ReferenceStringRun`. The only
 * additions here are presentational: a fault RATE (arithmetic on two engine numbers),
 * and a diff that names which frame changed at an access (a comparison of two engine
 * snapshots). Neither changes what happened.
 */

import {
  CLASSIC_REFERENCE_STRING,
  REPLACEMENT_ALGORITHMS,
  runReferenceString,
} from "../../../engine";
import type {
  PageNumber,
  ReferenceStringRun,
  ReplacementAlgorithm,
  ReplacementFrame,
} from "../../../engine";
import { accepted, parsePositiveIntegerText, rejected } from "./fields";
import type { FieldResult } from "./fields";

/**
 * The reference string Compare Mode opens with, and the frame count that goes with it.
 *
 * The classic 20-access textbook string with 3 frames is the documented reference
 * value of this project: FIFO 15 faults, LRU 12, Optimal 9. Hiding it behind a preset
 * would make the screen's headline numbers unreproducible, so it is the default and
 * the Playwright test asserts exactly those three numbers against the built app.
 */
export const DEFAULT_COMPARE_REFERENCE_TEXT = CLASSIC_REFERENCE_STRING.join(" ");
export const DEFAULT_COMPARE_FRAME_COUNT = 3;

/** One access, as one column of the comparison saw it. */
export interface CompareStep {
  readonly accessIndex: number;
  readonly pageNumber: PageNumber;
  readonly outcome: "HIT" | "FAULT";
  /** Frame that served the access or received the loaded page. */
  readonly frameNumber: number;
  /** Page that had to leave to make room, or `null` when nothing was evicted. */
  readonly evictedPageNumber: number | null;
  /** Frame contents AFTER this access, frame 0 first. */
  readonly frames: readonly (number | null)[];
}

/** One algorithm's whole run, flattened into what the screen shows. */
export interface CompareColumn {
  readonly algorithm: ReplacementAlgorithm;
  readonly accesses: number;
  readonly pageFaults: number;
  readonly hits: number;
  readonly evictions: number;
  /** Faults per access, in [0, 1]. Zero accesses means zero, never `NaN`. */
  readonly faultRate: number;
  /** Frame contents at the end of the run, frame 0 first. */
  readonly finalFrames: readonly (number | null)[];
  readonly steps: readonly CompareStep[];
}

/** All three runs over one reference string. */
export interface CompareResult {
  readonly referenceString: readonly number[];
  readonly frameCount: number;
  /** One column per algorithm, in `REPLACEMENT_ALGORITHMS` order (FIFO, LRU, Optimal). */
  readonly columns: readonly CompareColumn[];
}


function framesToPages(frames: readonly ReplacementFrame[]): readonly (number | null)[] {
  return frames.map((frame) => frame.pageNumber);
}

/** Flatten one engine run into the column the screen draws. */
function columnFor(run: ReferenceStringRun): CompareColumn {
  return {
    algorithm: run.algorithm,
    accesses: run.accesses,
    pageFaults: run.pageFaults,
    hits: run.hits,
    evictions: run.evictions,
    // A run of zero accesses has no rate. Reporting 0 is honest; NaN is not.
    faultRate: run.accesses === 0 ? 0 : run.pageFaults / run.accesses,
    finalFrames: framesToPages(run.finalFrames),
    steps: run.trace.map((entry) => ({
      accessIndex: entry.accessIndex,
      pageNumber: entry.pageNumber,
      outcome: entry.outcome,
      frameNumber: entry.frameNumber,
      evictedPageNumber: entry.evicted === null ? null : entry.evicted.pageNumber,
      frames: framesToPages(entry.frames),
    })),
  };
}

/**
 * Run one reference string through all three algorithms.
 *
 * The engine validates the string and the frame count. When it refuses - a negative
 * page number, a fractional one, a frame count of zero - the refusal is returned as a
 * message, so the screen can show it instead of crashing mid-render.
 */
export function compare(
  referenceString: readonly PageNumber[],
  frameCount: number,
): FieldResult<CompareResult> {
  try {
    const columns = REPLACEMENT_ALGORITHMS.map((algorithm) =>
      columnFor(runReferenceString(algorithm, referenceString, frameCount)),
    );

    return accepted({
      referenceString: [...referenceString],
      frameCount,
      columns,
    });
  } catch (caught) {
    return rejected(caught instanceof Error ? caught.message : String(caught));
  }
}

/**
 * Read the frame count for a comparison.
 *
 * Compare Mode allows any positive frame count: the textbook exercises have no upper
 * bound worth imposing, and a big frame count is a legitimate way to show that "more
 * memory, same string" stops faulting.
 */
export function parseCompareFrameCount(text: string): FieldResult<number> {
  const parsed = parsePositiveIntegerText(text, null);

  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value === null) {
    return rejected("Frame count must be at least 1.");
  }

  return accepted(parsed.value);
}

/**
 * Which frame changed between two consecutive accesses, or `null` when none did.
 *
 * This is a diff of two engine snapshots, used to highlight a row - it decides nothing
 * about the simulation. `previous` is the frame contents BEFORE the access; `null`
 * means "no previous access", so the first frame to HOLD A PAGE counts as changed and
 * a strip that is still completely free reports no change at all.
 */
export function changedFrame(
  previous: readonly (number | null)[] | null,
  current: readonly (number | null)[],
): number | null {
  for (const [frameNumber, page] of current.entries()) {
    const wasDifferent =
      previous === null ? page !== null : previous[frameNumber] !== page;

    if (wasDifferent) {
      return frameNumber;
    }
  }
  return null;
}
