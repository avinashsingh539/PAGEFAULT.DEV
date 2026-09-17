/**
 * Presets: small, documented machines that the CLI demo and the tests share.
 *
 * These are DEMO DATA, not engine logic - they simply describe a plausible small
 * page table and keep every example in the docs reproducible.
 *
 *   page 0 -> frame 3   (present)
 *   page 1 -> frame 7   (present)
 *   page 2 -> frame 1   (present)
 *   page 3 -> absent    (accessing it must page-fault)
 */

import { createMachineState, DEFAULT_FRAME_COUNT, DEFAULT_PAGE_SIZE } from "./machine";
import { absentEntry, presentEntry } from "./memory/pageTable";
import type { MachineConfig } from "./machine";
import type { MachineState } from "./types/machine";
import type { PageTableEntry } from "./types/memory";

export const EXAMPLE_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const EXAMPLE_FRAME_COUNT = DEFAULT_FRAME_COUNT;

/** The textbook page table above, as exportable data so tests can assert on it. */
export const EXAMPLE_PAGE_TABLE: readonly PageTableEntry[] = [
  presentEntry(0, 3),
  presentEntry(1, 7),
  presentEntry(2, 1),
  absentEntry(3),
];

/** Build the preset machine, optionally tweaking parts of its configuration. */
export function createExampleMachine(overrides: Partial<MachineConfig> = {}): MachineState {
  return createMachineState({
    pageSize: EXAMPLE_PAGE_SIZE,
    frameCount: EXAMPLE_FRAME_COUNT,
    pid: 1,
    processName: "example-process",
    pageTableEntries: EXAMPLE_PAGE_TABLE,
    ...overrides,
  });
}