/**
 * Input validation for the memory subsystem.
 *
 * These helpers exist so the engine can reject nonsense instead of computing
 * `NaN` or negative addresses. Every check throws an `EngineError` with a stable
 * code, which makes both the tests and the future UI able to react precisely.
 */

import { EngineError } from "../errors";
import type { FrameNumber, Offset, PageSize, VirtualAddress } from "../types/memory";

/** True when `value` is a power of two (used to document/handle page sizes like 4096). */
export function isPowerOfTwo(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

export function assertValidPageSize(pageSize: PageSize): void {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new EngineError(
      "INVALID_PAGE_SIZE",
      `page size must be a positive integer, received ${String(pageSize)}`,
    );
  }
}

export function assertValidVirtualAddress(virtualAddress: VirtualAddress): void {
  if (!Number.isSafeInteger(virtualAddress) || virtualAddress < 0) {
    throw new EngineError(
      "INVALID_VIRTUAL_ADDRESS",
      `virtual address must be a non-negative integer, received ${String(virtualAddress)}`,
    );
  }
}

export function assertValidFrameNumber(frameNumber: FrameNumber): void {
  if (!Number.isSafeInteger(frameNumber) || frameNumber < 0) {
    throw new EngineError(
      "INVALID_FRAME_NUMBER",
      `frame number must be a non-negative integer, received ${String(frameNumber)}`,
    );
  }
}

/** An offset must point *inside* a page: `0 <= offset < pageSize`. */
export function assertValidOffset(offset: Offset, pageSize: PageSize): void {
  assertValidPageSize(pageSize);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= pageSize) {
    throw new EngineError(
      "INVALID_OFFSET",
      `offset must be an integer in [0, ${pageSize}), received ${String(offset)}`,
    );
  }
}