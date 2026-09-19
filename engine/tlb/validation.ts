/**
 * Input validation for the TLB.
 *
 * A TLB is either absent from a machine, or present with a capacity of at least one
 * entry. `0` is rejected rather than treated as "disabled": a TLB that can hold
 * nothing is a configuration mistake, not a machine design.
 */

import { EngineError } from "../errors";

export function assertValidTlbCapacity(capacity: number): void {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new EngineError(
      "INVALID_TLB_CAPACITY",
      `TLB capacity must be a positive integer, received ${String(capacity)}`,
    );
  }
}