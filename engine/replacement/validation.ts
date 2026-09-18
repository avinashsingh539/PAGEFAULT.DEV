/**
 * Input validation for the replacement subsystem.
 *
 * Same contract as `memory/validation.ts`: reject nonsense with an `EngineError`
 * carrying a stable code, instead of computing a NaN index or silently ignoring a
 * bogus algorithm name.
 */

import { EngineError } from "../errors";
import { isReplacementAlgorithm } from "./algorithms";
import type { PageNumber } from "../types/memory";
import type { ReplacementAlgorithm } from "../types/replacement";

export function assertValidReplacementAlgorithm(algorithm: ReplacementAlgorithm): void {
  if (!isReplacementAlgorithm(algorithm)) {
    throw new EngineError(
      "INVALID_REPLACEMENT_ALGORITHM",
      `unknown replacement algorithm ${JSON.stringify(
        algorithm,
      )}, expected one of "FIFO", "LRU", "OPTIMAL"`,
    );
  }
}

/** A simulation without frames can never hold a page, so this must be at least 1. */
export function assertValidFrameCount(frameCount: number): void {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    throw new EngineError(
      "INVALID_FRAME_COUNT",
      `frame count must be a positive integer, received ${String(frameCount)}`,
    );
  }
}

/** One entry of a reference string: the page number the CPU touches. */
export function assertValidPageReference(pageNumber: PageNumber, position: number): void {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) {
    throw new EngineError(
      "INVALID_REFERENCE_STRING",
      `reference ${position} must be a non-negative integer page number, received ${String(pageNumber)}`,
    );
  }
}

/**
 * A reference string is a dense array of page numbers.
 *
 * The loop is index-based on purpose: `Array.prototype.every` SKIPS holes, so a
 * sparse array such as `[1, , 2]` would sail through a `every()` check and only
 * explode later, deep inside the simulation.
 */
export function assertValidReferenceString(referenceString: readonly PageNumber[]): void {
  if (!Array.isArray(referenceString)) {
    throw new EngineError(
      "INVALID_REFERENCE_STRING",
      `reference string must be an array of page numbers, received ${typeof referenceString}`,
    );
  }

  for (let index = 0; index < referenceString.length; index += 1) {
    assertValidPageReference(referenceString[index], index);
  }
}