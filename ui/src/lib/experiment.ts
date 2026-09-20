/**
 * Experiment Mode's configuration: what the user is allowed to change, how it is
 * validated, and the demo machine it builds.
 *
 * TWO RULES THIS FILE OBEYS
 *
 * 1. The engine is the authority. Every value validated here is ALSO validated by the
 *    engine when the machine is built (`createMachineState`) and when a replacement is
 *    run (`runReferenceString`). Nothing here re-implements the simulation: the
 *    helpers below only read text, pick demo data, and translate an engine error into
 *    a sentence a learner can act on.
 *
 * 2. A malformed configuration must never reach the engine AND must never be silently
 *    accepted. `validateExperimentConfig` returns either a complete configuration or
 *    the per-field reasons it was rejected - never a half-valid object, never `NaN`.
 */

import { EngineError, REPLACEMENT_ALGORITHMS, createMachineState } from "../../../engine";
import type { MachineState, PageTableEntry, ReplacementAlgorithm } from "../../../engine";
import { accepted, parsePositiveIntegerText, rejected } from "./fields";
import type { FieldResult } from "./fields";

/** The page sizes the Experiment screen offers as one-click choices. */
export const EXPERIMENT_PAGE_SIZE_OPTIONS: readonly number[] = [1024, 2048, 4096, 8192, 16384];

/** Frame counts worth one click: tiny, textbook-sized, and roomy. */
export const EXPERIMENT_FRAME_COUNT_OPTIONS: readonly number[] = [1, 2, 3, 4, 8, 16];

/**
 * Pages 0..7 are the mapped part of the experiment address space. Two further pages
 * exist beyond them so both flavours of page fault stay reachable at any frame count:
 * `EXPERIMENT_ABSENT_PAGE` exists in the table but is not resident, and
 * `EXPERIMENT_MISSING_PAGE` has no entry at all.
 */
export const EXPERIMENT_MAPPED_PAGES = 8;
export const EXPERIMENT_ABSENT_PAGE = 8;
export const EXPERIMENT_MISSING_PAGE = 9;

/**
 * Which frame each page PREFERS, before the frame count is taken into account.
 *
 * The first six values are exactly the lab machine's page table, so the Experiment
 * screen starts on the same picture the rest of the project documents (page 0 in
 * frame 3, page 1 in frame 7, ...). Keeping page number and frame number different is
 * the point: virtual and physical addressing are not the same thing.
 */
const FRAME_PREFERENCE: readonly number[] = [3, 7, 1, 5, 9, 11, 13, 2];

/** What the user is configuring. Every field is a value the engine accepts. */
export interface ExperimentConfig {
  readonly pageSize: number;
  /** `null` builds a machine with no TLB at all (the Day 1 machine). */
  readonly tlbCapacity: number | null;
  readonly frameCount: number;
  readonly algorithm: ReplacementAlgorithm;
}

export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  pageSize: 4096,
  tlbCapacity: 4,
  frameCount: 16,
  algorithm: "FIFO",
};

/** The text state of the configuration form, exactly as typed. */
export interface ExperimentFormText {
  readonly pageSize: string;
  readonly tlbCapacity: string;
  readonly frameCount: string;
  readonly algorithm: string;
}

/** One message per rejected field; absent keys mean that field was fine. */
export interface ExperimentFieldErrors {
  readonly pageSize?: string;
  readonly tlbCapacity?: string;
  readonly frameCount?: string;
  readonly algorithm?: string;
}

/** The outcome of validating the form: all of it, or the reasons it was refused. */
export type ExperimentValidation =
  | {
      readonly ok: true;
      readonly value: ExperimentConfig;
      readonly fieldErrors: ExperimentFieldErrors;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors: ExperimentFieldErrors;
    };

/** The text a fresh form starts with, derived from a configuration. */
export function textForConfig(config: ExperimentConfig): ExperimentFormText {
  return {
    pageSize: String(config.pageSize),
    tlbCapacity: config.tlbCapacity === null ? "none" : String(config.tlbCapacity),
    frameCount: String(config.frameCount),
    algorithm: config.algorithm,
  };
}

/** True when an algorithm name is one the engine implements. */
export function isAlgorithm(value: string): value is ReplacementAlgorithm {
  return (REPLACEMENT_ALGORITHMS as readonly string[]).includes(value);
}

/**
 * Assign a frame to each of the first `pageCount` pages, or `null` when the frame
 * count is too small to give that page one of its own.
 *
 * Deterministic and collision-free by construction: a page takes the first free frame
 * starting at its preferred one and wrapping around, so two pages can never share a
 * frame. A page that finds no free frame is left unmapped - which is a truthful
 * machine (fewer frames than pages), not an error.
 *
 * A frame count below 1 (which the engine rejects long before this runs) yields no
 * mappings at all instead of a `NaN` from a modulo by zero.
 */
export function assignFrames(
  frameCount: number,
  pageCount: number = EXPERIMENT_MAPPED_PAGES,
): readonly (number | null)[] {
  const assignment: (number | null)[] = [];

  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    for (let page = 0; page < pageCount; page += 1) {
      assignment.push(null);
    }
    return assignment;
  }

  const used = new Set<number>();

  for (let page = 0; page < pageCount; page += 1) {
    const preferred = FRAME_PREFERENCE[page % FRAME_PREFERENCE.length] ?? 0;
    let frame: number | null = null;

    for (let step = 0; step < frameCount; step += 1) {
      const candidate = (preferred + step) % frameCount;
      if (!used.has(candidate)) {
        frame = candidate;
        used.add(candidate);
        break;
      }
    }

    assignment.push(frame);
  }

  return assignment;
}

/**
 * The demo page table for a frame count: the pages that could be mapped, plus one page
 * that exists but is not resident.
 *
 * `EXPERIMENT_MISSING_PAGE` is deliberately absent from the returned list, because a
 * page with no entry at all is a different fault from a page marked not-present, and
 * the lab exists to show both.
 */
export function experimentPageTable(frameCount: number): readonly PageTableEntry[] {
  const entries: PageTableEntry[] = [];

  for (const [pageNumber, frameNumber] of assignFrames(frameCount).entries()) {
    entries.push(
      frameNumber === null
        ? { pageNumber, present: false, frameNumber: null }
        : { pageNumber, present: true, frameNumber },
    );
  }

  entries.push({ pageNumber: EXPERIMENT_ABSENT_PAGE, present: false, frameNumber: null });

  return entries;
}

/** Every frame the demo page table occupies, ascending; empty when nothing is mapped. */
export function usedFrames(frameCount: number): readonly number[] {
  return assignFrames(frameCount)
    .filter((frame): frame is number => frame !== null)
    .sort((a, b) => a - b);
}

/**
 * Build the machine for a configuration.
 *
 * The engine builds it, so the engine validates it: a frame count the engine rejects,
 * or a page table that does not fit the frame count, comes back as an error message
 * rather than an exception escaping into React.
 */
export function buildExperimentMachine(config: ExperimentConfig): FieldResult<MachineState> {
  try {
    const machine = createMachineState({
      pageSize: config.pageSize,
      frameCount: config.frameCount,
      pid: 1,
      processName: "memorylab-experiment",
      pageTableEntries: [...experimentPageTable(config.frameCount)],
      ...(config.tlbCapacity === null ? {} : { tlbCapacity: config.tlbCapacity }),
    });
    return accepted(machine);
  } catch (caught) {
    return rejected(messageForError(caught));
  }
}

/**
 * Validate the typed form.
 *
 * Returns the configuration only when EVERY field is acceptable. Otherwise it returns
 * the messages to show inline, and the caller keeps the machine it already had - a bad
 * form must not be able to half-apply itself.
 */
export function validateExperimentConfig(text: ExperimentFormText): ExperimentValidation {
  const fieldErrors: {
    pageSize?: string;
    tlbCapacity?: string;
    frameCount?: string;
    algorithm?: string;
  } = {};

  const pageSize = parsePositiveIntegerText(text.pageSize, null);
  if (!pageSize.ok) {
    fieldErrors.pageSize = pageSize.error;
  }

  const tlbCapacity = parsePositiveIntegerText(text.tlbCapacity, "none");
  if (!tlbCapacity.ok) {
    fieldErrors.tlbCapacity = tlbCapacity.error;
  }

  const frameCount = parsePositiveIntegerText(text.frameCount, null);
  if (!frameCount.ok) {
    fieldErrors.frameCount = frameCount.error;
  }

  const algorithmText = text.algorithm.trim();
  if (!isAlgorithm(algorithmText)) {
    fieldErrors.algorithm = `Choose one of ${REPLACEMENT_ALGORITHMS.join(", ")}.`;
  }

  if (
    !pageSize.ok ||
    !tlbCapacity.ok ||
    !frameCount.ok ||
    !isAlgorithm(algorithmText) ||
    pageSize.value === null ||
    frameCount.value === null
  ) {
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }

  const config: ExperimentConfig = {
    pageSize: pageSize.value,
    tlbCapacity: tlbCapacity.value,
    frameCount: frameCount.value,
    algorithm: algorithmText,
  };

  // The engine has the last word: build it once, here, so a page table that cannot
  // fit the requested frame count is reported as a form error instead of throwing
  // when the screen later tries to step the machine.
  const built = buildExperimentMachine(config);
  if (!built.ok) {
    return { ok: false, error: built.error, fieldErrors: { frameCount: built.error } };
  }

  return { ok: true, value: config, fieldErrors: {} };
}

/** One sentence for an engine error, or the raw value when it is not one. */
export function messageForError(caught: unknown): string {
  if (caught instanceof EngineError) {
    return caught.message;
  }
  return caught instanceof Error ? caught.message : String(caught);
}

