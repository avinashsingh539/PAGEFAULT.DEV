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
import type { PageNumber, PageTableEntry } from "./types/memory";

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

/**
 * Reference strings: the DEMO DATA of the replacement algorithms, shared by the CLI
 * demo, the docs and the tests so that every published fault count is reproducible.
 *
 * The expected fault counts are NOT stored here on purpose. They live in the tests
 * and in `docs/reference-values.md` as literals, so a wrong implementation cannot
 * make a test pass by agreeing with its own constant.
 */

/** Frame count used by every textbook example in `docs/reference-values.md`. */
export const TEXTBOOK_FRAME_COUNT = 3;

/**
 * The classic 20-access example from the operating-systems textbook
 * (Silberschatz, "Operating System Concepts" - the reference string used for the
 * FIFO / Optimal / LRU walkthroughs).
 *
 * With 3 frames it produces the published counts: FIFO 15, LRU 12, Optimal 9.
 */
export const CLASSIC_REFERENCE_STRING: readonly PageNumber[] = [
  7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1,
];

/**
 * The first 13 accesses of `CLASSIC_REFERENCE_STRING`.
 *
 * This is the string as it was quoted in the Day 2 brief. It is kept as a preset
 * because its own fault counts are hand-verifiable in a few lines, and because the
 * brief's stated expectations (FIFO 15, Optimal 9) belong to the FULL string above:
 * 15 faults cannot happen in 13 accesses. See `docs/reference-values.md`.
 */
export const QUOTED_REFERENCE_STRING: readonly PageNumber[] = [
  7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2,
];

/**
 * The reference string from the textbook's Belady's-anomaly section.
 *
 * FIFO runs it in 9 faults with 3 frames and 10 faults with 4 frames: MORE memory,
 * MORE faults. LRU and Optimal are stack algorithms and never show the anomaly.
 */
export const BELADY_REFERENCE_STRING: readonly PageNumber[] = [
  1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5,
];