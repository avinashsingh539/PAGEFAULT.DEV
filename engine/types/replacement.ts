/**
 * Page-replacement types: the model behind FIFO, LRU and Optimal.
 *
 * WHY THIS IS A SEPARATE TYPE FAMILY FROM `types/machine.ts`
 *
 * Day 1's `step()` works at ADDRESS level: a virtual address is split into page +
 * offset, the page table is consulted, and the access either translates or faults.
 * A reference-string simulation works one level above that: it is handed a list of
 * PAGE NUMBERS and must decide, for every fault, which resident page to evict.
 * There are no addresses, no offsets and no page table in that abstraction, which
 * is exactly why every textbook teaches it this way.
 *
 * So replacement gets its own state, its own events and its own step function, and
 * reuses everything from Day 1 that is level-independent: `PageNumber`,
 * `FrameNumber`, `PageFaultReason`, `EventSequence`, `EventBase`, `EngineError`.
 * Day 1's `Event` union is deliberately left untouched so its behaviour (and its
 * tests) stay exactly as they were.
 *
 * TIME. Both FIFO and LRU need to know WHEN something happened. The engine derives
 * that from the ACCESS INDEX (0, 1, 2, ...) - the position of the access in the
 * reference string. It never reads `Date.now()`: a clock would make replays and
 * tests nondeterministic, and simulated time is not wall-clock time anyway.
 */

import type { EventBase, EventSequence } from "./events";
import type { FrameNumber, PageFaultReason, PageNumber } from "./memory";

/** The replacement policies implemented today. */
export type ReplacementAlgorithm = "FIFO" | "LRU" | "OPTIMAL";

/** Outcome of one access: the page was already in RAM, or it was not. */
export type ReplacementOutcome = "HIT" | "FAULT";

/**
 * One frame as the replacement policy sees it.
 *
 * `loadedAt` and `lastUsedAt` are access indices (`0` is the first access of the
 * reference string), or `null` while the frame is free. A free frame has
 * `pageNumber === null` and `useCount === 0`.
 */
export interface ReplacementFrame {
  readonly frameNumber: FrameNumber;
  /** Page resident in this frame, or `null` when the frame is free. */
  readonly pageNumber: PageNumber | null;
  /**
   * Access index at which the resident page was LOADED into this frame.
   *
   * FIFO uses exactly this value, and nothing else: a hit deliberately does not
   * change it, which is what "FIFO" means.
   */
  readonly loadedAt: number | null;
  /**
   * Access index at which the resident page was most recently USED (load or hit).
   *
   * LRU uses exactly this value, so a hit must refresh it.
   */
  readonly lastUsedAt: number | null;
  /** How many hits this frame has served since its page was loaded. */
  readonly useCount: number;
}

/** A frame that currently holds a page: every timestamp is present. */
export type ResidentFrame = ReplacementFrame & {
  readonly pageNumber: PageNumber;
  readonly loadedAt: number;
  readonly lastUsedAt: number;
};

/** A frame with nothing in it. */
export type FreeFrame = ReplacementFrame & {
  readonly pageNumber: null;
  readonly loadedAt: null;
  readonly lastUsedAt: null;
};

/** Deterministic counters, derived only from the accesses that were served. */
export interface ReplacementStats {
  readonly accesses: number;
  readonly hits: number;
  readonly pageFaults: number;
  /** Pages brought into a frame. Every fault loads exactly one page. */
  readonly loads: number;
  /** Pages pushed out of a frame to make room. */
  readonly evictions: number;
}

/** The complete, serialisable state of a reference-string simulation. */
export interface ReplacementState {
  readonly algorithm: ReplacementAlgorithm;
  readonly frames: readonly ReplacementFrame[];
  readonly stats: ReplacementStats;
  /** Monotonic event counter, exactly as in Day 1's `MachineState`. */
  readonly sequence: EventSequence;
}

/** What the caller asks for: "the CPU now reads/writes page N". */
export interface ReplacementRequest {
  readonly pageNumber: PageNumber;
  /**
   * The references that come AFTER this access, used by OPTIMAL only (it has to
   * look into the future to pick the page whose next use is farthest away).
   *
   * FIFO and LRU ignore it. `[]` legitimately means "nothing is used again".
   */
  readonly futureUses?: readonly PageNumber[];
}

/** Which page left RAM, and from where. */
export interface EvictedPage {
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
}

/** What `stepReplacement()` returns: the next state plus the truthful events. */
export interface ReplacementStepResult {
  readonly state: ReplacementState;
  readonly events: readonly ReplacementEvent[];
  readonly outcome: ReplacementOutcome;
  /** The frame that served the access (hit) or received the loaded page (fault). */
  readonly frameNumber: FrameNumber;
  readonly evicted: EvictedPage | null;
}

/**
 * The FACT that justifies a victim choice: which rule was applied and what value
 * decided it. Structured (not a sentence) so tests can pin it down and a future UI
 * can highlight the exact numbers that made the decision.
 */
export type ReplacementEvidence =
  | {
      readonly rule: "FIFO_EARLIEST_LOADED";
      /** `loadedAt` of the victim: it entered memory before every other candidate. */
      readonly victimLoadedAt: number;
      readonly candidateFrameNumbers: readonly FrameNumber[];
    }
  | {
      readonly rule: "LRU_LEAST_RECENTLY_USED";
      /** `lastUsedAt` of the victim: the oldest use among the candidates. */
      readonly victimLastUsedAt: number;
      readonly candidateFrameNumbers: readonly FrameNumber[];
    }
  | {
      readonly rule: "OPTIMAL_FARTHEST_NEXT_USE";
      /**
       * Index of the victim's next use inside the `futureUses` array, or `null`
       * when the victim is never used again (which is the farthest possible use,
       * so such a page is always the optimal victim).
       *
       * `0` means "used again on the very next access". The absolute access index
       * is `currentAccessIndex + 1 + victimNextUseIndex`.
       */
      readonly victimNextUseIndex: number | null;
      readonly candidateFrameNumbers: readonly FrameNumber[];
    };

/** A decided victim, with the evidence that produced it. */
export interface ReplacementDecision {
  readonly algorithm: ReplacementAlgorithm;
  readonly victimFrameNumber: FrameNumber;
  readonly victimPageNumber: PageNumber;
  readonly evidence: ReplacementEvidence;
  /** Human-readable restatement of the evidence, for logs and the CLI demo. */
  readonly reason: string;
}

/**
 * The CPU accessed a page that is already in RAM. No frame work is needed.
 *
 * A hit still updates `lastUsedAt` in the frames (LRU needs it); it never updates
 * `loadedAt` (FIFO must not be disturbed by hits).
 */
export interface PageHitEvent extends EventBase {
  readonly type: "PAGE_HIT";
  readonly accessIndex: number;
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
}

/**
 * The page is not resident in RAM. Unlike Day 1's address-level `PAGE_FAULT`, a
 * fault in this harness is always FOLLOWED by the work that removes it: either a
 * load into a free frame, or a replacement decision, an eviction and a load.
 */
export interface ReplacementPageFaultEvent extends EventBase {
  readonly type: "PAGE_FAULT";
  readonly accessIndex: number;
  readonly pageNumber: PageNumber;
  readonly reason: PageFaultReason;
  /** Frames that were still empty before this fault was served. */
  readonly freeFramesRemaining: number;
}

/** A victim was chosen by the active algorithm. Emitted before the eviction. */
export interface ReplacementDecisionEvent extends EventBase {
  readonly type: "REPLACEMENT_DECISION";
  readonly accessIndex: number;
  /** The page being brought in (the one that faulted). */
  readonly pageNumber: PageNumber;
  readonly algorithm: ReplacementAlgorithm;
  readonly victimPageNumber: PageNumber;
  readonly victimFrameNumber: FrameNumber;
  readonly evidence: ReplacementEvidence;
}

/** The chosen page was removed from its frame. */
export interface EvictPageEvent extends EventBase {
  readonly type: "EVICT_PAGE";
  readonly accessIndex: number;
  /** The page that left RAM. */
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
  readonly algorithm: ReplacementAlgorithm;
}

/** The faulting page is now resident in a frame. */
export interface LoadPageEvent extends EventBase {
  readonly type: "LOAD_PAGE";
  readonly accessIndex: number;
  readonly pageNumber: PageNumber;
  readonly frameNumber: FrameNumber;
}

/** Every replacement event the engine can produce today. */
export type ReplacementEvent =
  | PageHitEvent
  | ReplacementPageFaultEvent
  | ReplacementDecisionEvent
  | EvictPageEvent
  | LoadPageEvent;

/** String literal union of all replacement event tags. */
export type ReplacementEventType = ReplacementEvent["type"];

/** One access of a run, with the frame contents it produced. */
export interface ReplacementTraceEntry {
  readonly accessIndex: number;
  readonly pageNumber: PageNumber;
  readonly outcome: ReplacementOutcome;
  /** Frame that served the access or received the loaded page. */
  readonly frameNumber: FrameNumber;
  /** Which page was evicted to serve this access, when one had to be. */
  readonly evicted: EvictedPage | null;
  /** Frame contents AFTER this access - what a visualization should draw. */
  readonly frames: readonly ReplacementFrame[];
  /** The events this single access produced, in order. */
  readonly events: readonly ReplacementEvent[];
}

/**
 * Everything a reference-string run produced.
 *
 * This is the value a UI can scrub through, and the value the accuracy tests
 * assert on. `hits` and `pageFaults` are the two numbers every textbook exercise
 * asks for; `loads` and `evictions` explain where the faults went.
 */
export interface ReferenceStringRun {
  readonly algorithm: ReplacementAlgorithm;
  /** A copy of the reference string, so the result cannot be changed by its caller. */
  readonly referenceString: readonly PageNumber[];
  readonly frameCount: number;
  readonly accesses: number;
  readonly hits: number;
  readonly pageFaults: number;
  /** Invariant: `loads === pageFaults` (every fault loads exactly one page). */
  readonly loads: number;
  readonly evictions: number;
  /** Frame contents before the first access (all free). */
  readonly initialFrames: readonly ReplacementFrame[];
  /** Frame contents after the last access. */
  readonly finalFrames: readonly ReplacementFrame[];
  /** One entry per access, in order. */
  readonly trace: readonly ReplacementTraceEntry[];
  /** Every event of the whole run, in order, numbered from 0. */
  readonly events: readonly ReplacementEvent[];
}