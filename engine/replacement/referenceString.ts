/**
 * The reference-string harness: run a whole access sequence and report every fact.
 *
 * A textbook exercise gives three things - an algorithm, a reference string and a
 * number of frames - and asks how many page faults occurred, which page was evicted
 * at each step, and what RAM looked like. This function answers exactly that, by
 * driving `stepReplacement()` one access at a time and collecting the trace.
 *
 * It is deliberately a thin loop:
 *
 *   - all policy logic lives in `algorithms.ts`,
 *   - all state transitions live in `state.ts`,
 *   - this file only decides which access comes next, and remembers what happened.
 *
 * The input is never mutated, and the result carries a COPY of the reference string,
 * so a caller cannot change a finished run by touching the array afterwards.
 */

import { createReplacementState, stepReplacement } from "./state";
import {
  assertValidFrameCount,
  assertValidReferenceString,
  assertValidReplacementAlgorithm,
} from "./validation";
import type { PageNumber } from "../types/memory";
import type {
  ReferenceStringRun,
  ReplacementAlgorithm,
  ReplacementEvent,
  ReplacementTraceEntry,
} from "../types/replacement";

/**
 * Run `referenceString` against `frameCount` frames using `algorithm`.
 *
 * Example: `runReferenceString("FIFO", [7, 0, 1, 2], 3)` faults on every access,
 * because three frames can hold three pages and the string touches four.
 */
export function runReferenceString(
  algorithm: ReplacementAlgorithm,
  referenceString: readonly PageNumber[],
  frameCount: number,
): ReferenceStringRun {
  assertValidReplacementAlgorithm(algorithm);
  assertValidFrameCount(frameCount);
  assertValidReferenceString(referenceString);

  let state = createReplacementState(algorithm, frameCount);
  const initialFrames = state.frames;
  const trace: ReplacementTraceEntry[] = [];
  const events: ReplacementEvent[] = [];

  for (const [accessIndex, pageNumber] of referenceString.entries()) {
    const result = stepReplacement(state, {
      pageNumber,
      // OPTIMAL looks at the references that have not happened yet. `slice` copies,
      // so the lookahead can never alias (or mutate) the caller's array.
      futureUses: referenceString.slice(accessIndex + 1),
    });

    state = result.state;
    events.push(...result.events);
    trace.push({
      accessIndex,
      pageNumber,
      outcome: result.outcome,
      frameNumber: result.frameNumber,
      evicted: result.evicted,
      frames: state.frames,
      events: result.events,
    });
  }

  return {
    algorithm,
    referenceString: [...referenceString],
    frameCount,
    accesses: state.stats.accesses,
    hits: state.stats.hits,
    pageFaults: state.stats.pageFaults,
    loads: state.stats.loads,
    evictions: state.stats.evictions,
    initialFrames,
    finalFrames: state.frames,
    trace,
    events,
  };
}