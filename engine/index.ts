/**
 * PAGEFAULT.DEV - simulation engine public API.
 *
 * The engine is pure TypeScript and framework independent. Nothing under `engine/`
 * may import React, Zustand, DOM APIs, animation libraries or CSS. Consumers (CLI,
 * tests, and later the UI) talk to the machine through `step()` and read the events
 * it returns.
 *
 *   step(state, action) -> { state, events }
 */

export { EngineError, assertUnreachable, isEngineError } from "./errors";
export type { EngineErrorCode } from "./errors";

export type * from "./types/memory";
export type * from "./types/events";
export type * from "./types/actions";
export type * from "./types/machine";

// Address arithmetic.
export { translateAddress } from "./memory/translateAddress";
export { buildPhysicalAddress } from "./memory/physicalAddress";
export { isPowerOfTwo } from "./memory/validation";

// Page table.
export {
  absentEntry,
  createPageTable,
  lookupPage,
  pageTableEntries,
  presentEntry,
} from "./memory/pageTable";

// The machine.
export {
  createMachineState,
  step,
  DEFAULT_FRAME_COUNT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TLB_CAPACITY,
} from "./machine";
export type { MachineConfig } from "./machine";

// Demo data shared by the CLI and the tests.
export {
  createExampleMachine,
  EXAMPLE_FRAME_COUNT,
  EXAMPLE_PAGE_SIZE,
  EXAMPLE_PAGE_TABLE,
} from "./presets";