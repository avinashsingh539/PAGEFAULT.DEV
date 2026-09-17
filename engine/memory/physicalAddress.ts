/**
 * Physical address construction.
 *
 * The second half of the MMU: once the page table (or later the TLB) hands back a
 * frame number, the physical address is `frameNumber * pageSize + offset`.
 *
 * Pure and independently testable: no machine state is involved.
 */

import type { FrameNumber, Offset, PageSize, PhysicalAddress } from "../types/memory";
import {
  assertValidFrameNumber,
  assertValidOffset,
  assertValidPageSize,
} from "./validation";

export function buildPhysicalAddress(
  frameNumber: FrameNumber,
  offset: Offset,
  pageSize: PageSize,
): PhysicalAddress {
  assertValidFrameNumber(frameNumber);
  assertValidPageSize(pageSize);
  assertValidOffset(offset, pageSize);

  return frameNumber * pageSize + offset;
}