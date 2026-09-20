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

/**
 * Drop EVERY cached translation, keeping the TLB itself.
 *
 * The TLB is still there, still the same size - it is simply empty again, so the next
 * access to any page misses and walks the page table. Modelled separately from
 * `INVALIDATE_TLB` because it is one hardware operation, not a loop the caller has to
 * guess at: the engine decides what "flush" means and reports each dropped entry.
 */
export interface ClearTlbAction {
  readonly type: "CLEAR_TLB";
}

/**
 * Remove a page's mapping to a frame, releasing that frame.
 *
 * The page stays in the address space but is no longer resident: accessing it after
 * this faults. If the translation was cached, the stale copy is dropped in the same
 * step - a mapping that no longer exists must never stay usable through the TLB.
 */
export interface UnmapPageAction {
  readonly type: "UNMAP_PAGE";
  readonly pageNumber: PageNumber;
}

/** Every action the engine accepts today. */
export type Action = AccessAddressAction | InvalidateTlbAction | ClearTlbAction | UnmapPageAction;

/** String literal union of all action tags. */
export type ActionType = Action["type"];