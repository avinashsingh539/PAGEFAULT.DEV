/**
 * Virtual address -> (page number, offset).
 *
 * This is the arithmetic half of the MMU: the high bits of an address select the
 * page, the low bits select a byte inside that page.
 *
 * Pure: the same input always yields the same output, no state, no clock, no I/O.
 * Page sizes are used by division (not bit shifts) so the function stays correct
 * for non power-of-two sizes as well; the reference values in docs/ use 4096.
 */

import type { AddressSplit, PageSize, VirtualAddress } from "../types/memory";
import { assertValidPageSize, assertValidVirtualAddress } from "./validation";

export function translateAddress(
  virtualAddress: VirtualAddress,
  pageSize: PageSize,
): AddressSplit {
  assertValidVirtualAddress(virtualAddress);
  assertValidPageSize(pageSize);

  return {
    virtualAddress,
    pageSize,
    pageNumber: Math.floor(virtualAddress / pageSize),
    offset: virtualAddress % pageSize,
  };
}