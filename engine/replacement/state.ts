/**
 * The replacement simulator: state construction and `stepReplacement()`.
 *
 * `stepReplacement(state, request)` mirrors Day 1's `step(state, action)` exactly:
 * it is PURE (never mutates the state it is given, never reads a clock or a random
 * source) and it returns the next state together with the ordered events that
 * explain the transition.
 *
 * One access produces one of two event paths:
 *
 *   hit                              fault, free frame available
 *   ---                              ---------------------------
 *   PAGE_HIT                         PAGE_FAULT
 *                                    LOAD_PAGE
 *
 *   fault, no free frame
 *   --------------------
 *   PAGE_FAULT
 *   REPLACEMENT_DECISION   <- which victim, and WHY (structured evidence)
 *   EVICT_PAGE
 *   LOAD_PAGE
 *
 * A fault is never reported as a fact on its own: unlike Day 1's address-level
 * `PAGE_FAULT` (which only DETECTS the fault), the harness always finishes the job,
 * because resolving the fault *is* what page replacement means.
 */

import { chooseVictim, freeFrames, occupiedFrames } from "./algorithms";
import {
  assertValidFrameCount,
  assertValidPageReference,
  assertValidReplacementAlgorithm,
} from "./validation";
import type { EventSequence } from "../types/events";
import type { FrameNumber, PageNumber } from "../types/memory";
import type {
  EvictedPage,
  ReplacementAlgorithm,
  ReplacementEvent,
  ReplacementFrame,
  ReplacementRequest,
  ReplacementState,
  ReplacementStepResult,
  ResidentFrame,
} from "../types/replacement";

/**
 * Every frame starts empty, and no page is ever resident by magic: the first access
 * to each distinct page must fault, which is what the textbook fault counts assume.
 */
export function createReplacementState(
  algorithm: ReplacementAlgorithm,
  frameCount: number,
): ReplacementState {
  assertValidReplacementAlgorithm(algorithm);
  assertValidFrameCount(frameCount);

  const frames: ReplacementFrame[] = [];

  for (let frameNumber: FrameNumber = 0; frameNumber < frameCount; frameNumber += 1) {
    frames.push({
      frameNumber,
      pageNumber: null,
      loadedAt: null,
      lastUsedAt: null,
      useCount: 0,
    });
  }

  return {
    algorithm,
    frames,
    stats: {
      accesses: 0,
      hits: 0,
      pageFaults: 0,
      loads: 0,
      evictions: 0,
    },
    sequence: 0,
  };
}

/** The frame currently holding `pageNumber`, or `null` when the page is not in RAM. */
export function frameHoldingPage(
  frames: readonly ReplacementFrame[],
  pageNumber: PageNumber,
): ResidentFrame | null {
  const resident = occupiedFrames(frames).find((frame) => frame.pageNumber === pageNumber);
  return resident ?? null;
}

/** A frame's contents right after a page was loaded into it. */
function loadedFrame(
  frameNumber: FrameNumber,
  pageNumber: PageNumber,
  accessIndex: number,
): ReplacementFrame {
  return {
    frameNumber,
    pageNumber,
    // Both timestamps start at the load: the page has just been used, and this is
    // the moment it entered memory.
    loadedAt: accessIndex,
    lastUsedAt: accessIndex,
    useCount: 0,
  };
}

/** Serve one page access: hit, cold miss, or miss that needs a victim. */
export function stepReplacement(
  state: ReplacementState,
  request: ReplacementRequest,
): ReplacementStepResult {
  const pageNumber = request.pageNumber;
  const accessIndex = state.stats.accesses;

  assertValidPageReference(pageNumber, accessIndex);

  const events: ReplacementEvent[] = [];
  let sequence: EventSequence = state.sequence;
  const nextSequence = (): EventSequence => sequence++;

  // 1. Hit: the page is in RAM, so the frames only record that it was used.
  //
  //    `lastUsedAt` moves (LRU depends on it). `loadedAt` deliberately does NOT
  //    move, because FIFO must not be disturbed by hits - that is the whole
  //    difference between the two policies.
  const resident = frameHoldingPage(state.frames, pageNumber);

  if (resident !== null) {
    const frameNumber = resident.frameNumber;

    events.push({
      type: "PAGE_HIT",
      sequence: nextSequence(),
      accessIndex,
      pageNumber,
      frameNumber,
    });

    return {
      state: {
        ...state,
        frames: state.frames.map((frame) =>
          frame.frameNumber === frameNumber
            ? { ...frame, lastUsedAt: accessIndex, useCount: frame.useCount + 1 }
            : frame,
        ),
        stats: {
          ...state.stats,
          accesses: accessIndex + 1,
          hits: state.stats.hits + 1,
        },
        sequence,
      },
      events,
      outcome: "HIT",
      frameNumber,
      evicted: null,
    };
  }

  // 2. Fault: the page is not in RAM. Say so before doing anything about it.
  const free = freeFrames(state.frames);

  events.push({
    type: "PAGE_FAULT",
    sequence: nextSequence(),
    accessIndex,
    pageNumber,
    reason: "PAGE_NOT_PRESENT",
    freeFramesRemaining: free.length,
  });

  const [freeFrame] = free;
  let frames: readonly ReplacementFrame[];
  let evicted: EvictedPage | null = null;
  let targetFrameNumber: FrameNumber;

  if (freeFrame !== undefined) {
    // 2a. Cold miss: an empty frame takes the page, so no page has to leave RAM.
    targetFrameNumber = freeFrame.frameNumber;
    frames = state.frames.map((frame) =>
      frame.frameNumber === targetFrameNumber
        ? loadedFrame(targetFrameNumber, pageNumber, accessIndex)
        : frame,
    );
  } else {
    // 2b. Every frame holds a page, so the active policy must name a victim.
    const decision = chooseVictim(state.algorithm, state.frames, request.futureUses ?? []);

    events.push({
      type: "REPLACEMENT_DECISION",
      sequence: nextSequence(),
      accessIndex,
      pageNumber,
      algorithm: state.algorithm,
      victimPageNumber: decision.victimPageNumber,
      victimFrameNumber: decision.victimFrameNumber,
      evidence: decision.evidence,
    });

    events.push({
      type: "EVICT_PAGE",
      sequence: nextSequence(),
      accessIndex,
      pageNumber: decision.victimPageNumber,
      frameNumber: decision.victimFrameNumber,
      algorithm: state.algorithm,
    });

    evicted = {
      pageNumber: decision.victimPageNumber,
      frameNumber: decision.victimFrameNumber,
    };
    targetFrameNumber = decision.victimFrameNumber;
    frames = state.frames.map((frame) =>
      frame.frameNumber === targetFrameNumber
        ? loadedFrame(targetFrameNumber, pageNumber, accessIndex)
        : frame,
    );
  }

  // 3. Either way, the faulting page is now resident.
  events.push({
    type: "LOAD_PAGE",
    sequence: nextSequence(),
    accessIndex,
    pageNumber,
    frameNumber: targetFrameNumber,
  });

  return {
    state: {
      ...state,
      frames,
      stats: {
        ...state.stats,
        accesses: accessIndex + 1,
        pageFaults: state.stats.pageFaults + 1,
        loads: state.stats.loads + 1,
        evictions: state.stats.evictions + (evicted === null ? 0 : 1),
      },
      sequence,
    },
    events,
    outcome: "FAULT",
    frameNumber: targetFrameNumber,
    evicted,
  };
}