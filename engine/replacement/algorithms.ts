/**
 * The replacement policies, as pure victim-choosers.
 *
 * Each policy answers one question and nothing else: *given these frames, which
 * page must leave RAM?* No state is touched here, which is why the policies can be
 * tested directly, one hand-built frame set at a time, without running a whole
 * reference string.
 *
 * The policies differ only in the VALUE they compare:
 *
 *   FIFO     -> `loadedAt`    (when the page entered memory; hits do not matter)
 *   LRU      -> `lastUsedAt`  (when the page was last touched; hits matter)
 *   OPTIMAL  -> next use in the future reference string (needs lookahead)
 *
 * Tie-breaking is deterministic and documented: the first candidate in frame-number
 * order wins, and `frames` is always kept in ascending frame-number order by
 * `createReplacementState()`. Ties are impossible for FIFO and LRU when the frames
 * come from a run (access indices are distinct); they are real for OPTIMAL, where
 * several pages may share "never used again".
 */

import { EngineError, assertUnreachable } from "../errors";
import type { PageNumber } from "../types/memory";
import type {
  FreeFrame,
  ReplacementAlgorithm,
  ReplacementDecision,
  ReplacementFrame,
  ResidentFrame,
} from "../types/replacement";

/** The algorithms the engine implements, in a stable order for menus and tests. */
export const REPLACEMENT_ALGORITHMS: readonly ReplacementAlgorithm[] = ["FIFO", "LRU", "OPTIMAL"];

/** Runtime guard: callers from plain JavaScript can send anything, we do not guess. */
export function isReplacementAlgorithm(value: unknown): value is ReplacementAlgorithm {
  return typeof value === "string" && (REPLACEMENT_ALGORITHMS as readonly string[]).includes(value);
}

function isResident(frame: ReplacementFrame): frame is ResidentFrame {
  return frame.pageNumber !== null && frame.loadedAt !== null && frame.lastUsedAt !== null;
}

function isFree(frame: ReplacementFrame): frame is FreeFrame {
  return frame.pageNumber === null && frame.loadedAt === null && frame.lastUsedAt === null;
}

/** Frames that currently hold a page, in frame-number order. */
export function occupiedFrames(frames: readonly ReplacementFrame[]): readonly ResidentFrame[] {
  return frames.filter(isResident);
}

/** Frames that hold nothing, in frame-number order. */
export function freeFrames(frames: readonly ReplacementFrame[]): readonly FreeFrame[] {
  return frames.filter(isFree);
}

/** A victim can only be chosen when at least one frame actually holds a page. */
function assertHasCandidate(candidates: readonly ResidentFrame[]): void {
  if (candidates.length === 0) {
    throw new EngineError(
      "NO_EVICTION_CANDIDATE",
      "cannot choose a victim: no frame holds a page, so nothing can be evicted",
    );
  }
}

/** Smallest value wins. Equal values keep the earliest frame, which is the tie-break. */
function pickEarliest(
  candidates: readonly ResidentFrame[],
  value: (frame: ResidentFrame) => number,
): ResidentFrame {
  assertHasCandidate(candidates);
  return candidates.reduce((best, frame) => (value(frame) < value(best) ? frame : best));
}
/** Largest value wins. Equal values keep the earliest frame, which is the tie-break. */
function pickFarthest(
  candidates: readonly ResidentFrame[],
  value: (frame: ResidentFrame) => number,
): ResidentFrame {
  assertHasCandidate(candidates);
  return candidates.reduce((worst, frame) => (value(frame) > value(worst) ? frame : worst));
}


/**
 * FIFO: evict the page that entered memory first.
 *
 * A hit on a page does NOT reset its position, so this reads `loadedAt` only -
 * never `lastUsedAt`.
 */
export function chooseFifoVictim(frames: readonly ReplacementFrame[]): ReplacementDecision {
  const candidates = occupiedFrames(frames);
  const victim = pickEarliest(candidates, (frame) => frame.loadedAt);

  return {
    algorithm: "FIFO",
    victimFrameNumber: victim.frameNumber,
    victimPageNumber: victim.pageNumber,
    evidence: {
      rule: "FIFO_EARLIEST_LOADED",
      victimLoadedAt: victim.loadedAt,
      candidateFrameNumbers: candidates.map((frame) => frame.frameNumber),
    },
    reason: `FIFO: evict page ${victim.pageNumber} from frame ${victim.frameNumber} - loaded at access ${victim.loadedAt}, before every other resident page`,
  };
}

/**
 * LRU: evict the page that was used longest ago.
 *
 * A hit refreshes `lastUsedAt`, so a recently touched page is protected.
 */
export function chooseLruVictim(frames: readonly ReplacementFrame[]): ReplacementDecision {
  const candidates = occupiedFrames(frames);
  const victim = pickEarliest(candidates, (frame) => frame.lastUsedAt);

  return {
    algorithm: "LRU",
    victimFrameNumber: victim.frameNumber,
    victimPageNumber: victim.pageNumber,
    evidence: {
      rule: "LRU_LEAST_RECENTLY_USED",
      victimLastUsedAt: victim.lastUsedAt,
      candidateFrameNumbers: candidates.map((frame) => frame.frameNumber),
    },
    reason: `LRU: evict page ${victim.pageNumber} from frame ${victim.frameNumber} - last used at access ${victim.lastUsedAt}, longer ago than every other resident page`,
  };
}

/**
 * Where `pageNumber` is used inside the remaining references, or `null` if it never
 * is again. `0` means "used again on the very next access".
 */
function nextUseIndex(pageNumber: PageNumber, futureUses: readonly PageNumber[]): number | null {
  const index = futureUses.indexOf(pageNumber);
  return index === -1 ? null : index;
}

/**
 * Optimal (Belady's MIN): evict the page whose next use is farthest away.
 *
 * A page that is never used again is the farthest possible case, so it always
 * beats a page that is used again - expressed here as an infinite distance.
 */
export function chooseOptimalVictim(
  frames: readonly ReplacementFrame[],
  futureUses: readonly PageNumber[] = [],
): ReplacementDecision {
  const candidates = occupiedFrames(frames);
  const victim = pickFarthest(
    candidates,
    (frame) => nextUseIndex(frame.pageNumber, futureUses) ?? Number.POSITIVE_INFINITY,
  );
  const victimNextUseIndex = nextUseIndex(victim.pageNumber, futureUses);

  return {
    algorithm: "OPTIMAL",
    victimFrameNumber: victim.frameNumber,
    victimPageNumber: victim.pageNumber,
    evidence: {
      rule: "OPTIMAL_FARTHEST_NEXT_USE",
      victimNextUseIndex,
      candidateFrameNumbers: candidates.map((frame) => frame.frameNumber),
    },
    reason:
      victimNextUseIndex === null
        ? `Optimal: evict page ${victim.pageNumber} from frame ${victim.frameNumber} - it is never referenced again`
        : `Optimal: evict page ${victim.pageNumber} from frame ${victim.frameNumber} - next referenced ${victimNextUseIndex + 1} access(es) from now, later than every other resident page`,
  };
}

/** Dispatch to the policy named by `algorithm`. */
export function chooseVictim(
  algorithm: ReplacementAlgorithm,
  frames: readonly ReplacementFrame[],
  futureUses: readonly PageNumber[] = [],
): ReplacementDecision {
  switch (algorithm) {
    case "FIFO":
      return chooseFifoVictim(frames);
    case "LRU":
      return chooseLruVictim(frames);
    case "OPTIMAL":
      return chooseOptimalVictim(frames, futureUses);
    default:
      return assertUnreachable(algorithm, "chooseVictim");
  }
}