/**
 * Actions the outside world (UI, CLI, tests, future Trace My Code) can ask the
 * machine to perform. `step(state, action)` is a pure function of these.
 *
 * A discriminated union keeps this extensible: later phases add actions such as
 * clocks/context switches, but today the machine understands exactly one thing.
 */

import type { AccessKind, PageNumber, VirtualAddress } from "./memory";

/** Ask the CPU to access one virtual address. */
export interface AccessAddressAction {
  readonly type: "ACCESS_ADDRESS";
  readonly address: VirtualAddress;
  /** Defaults to "read" when omitted. */
  readonly access?: AccessKind;
}

/**
 * Drop one cached translation from the TLB.
 *
 * This is the hardware's invalidation step, modelled as an explicit action because
 * nothing in today's engine changes a page table on its own: a page that is evicted
 * or unmapped must not remain usable through a stale TLB entry, and asking for that
 * must be a fact in the event log rather than an implicit side effect.
 */
export interface InvalidateTlbAction {
  readonly type: "INVALIDATE_TLB";
  readonly pageNumber: PageNumber;
}

/** Every action the engine accepts today. */
export type Action = AccessAddressAction | InvalidateTlbAction;

/** String literal union of all action tags. */
export type ActionType = Action["type"];