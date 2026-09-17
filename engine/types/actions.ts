/**
 * Actions the outside world (UI, CLI, tests, future Trace My Code) can ask the
 * machine to perform. `step(state, action)` is a pure function of these.
 *
 * A discriminated union keeps this extensible: later phases add actions such as
 * clocks/context switches, but today the machine understands exactly one thing.
 */

import type { AccessKind, VirtualAddress } from "./memory";

/** Ask the CPU to access one virtual address. */
export interface AccessAddressAction {
  readonly type: "ACCESS_ADDRESS";
  readonly address: VirtualAddress;
  /** Defaults to "read" when omitted. */
  readonly access?: AccessKind;
}

/** Every action the engine accepts today. */
export type Action = AccessAddressAction;

/** String literal union of all action tags. */
export type ActionType = Action["type"];