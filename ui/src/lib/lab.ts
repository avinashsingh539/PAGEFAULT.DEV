/**
 * The lab's starting machine: six mapped pages, one absent page and one page with no
 * entry at all - enough to miss, hit, fill, evict, invalidate and fault with.
 *
 * The page table shown here is DATA handed to the engine (`createMachineState`), not
 * something the UI decides: this file names the entries the demo uses, and the engine
 * stays the only thing that ever consults them.
 */

import type { MachineState } from "../../../engine";
import { createMachineState } from "../../../engine";
import { DEMO_PAGE_SIZE } from "./session";

/** Pages 0..5 resident (frames 3, 7, 1, 5, 9, 11); 6 absent; 7 missing entirely. */
export const LAB_ENTRIES = [
  { pageNumber: 0, present: true, frameNumber: 3 },
  { pageNumber: 1, present: true, frameNumber: 7 },
  { pageNumber: 2, present: true, frameNumber: 1 },
  { pageNumber: 3, present: true, frameNumber: 5 },
  { pageNumber: 4, present: true, frameNumber: 9 },
  { pageNumber: 5, present: true, frameNumber: 11 },
  { pageNumber: 6, present: false, frameNumber: null },
] as const;

/** Sixteen frames of RAM, like the engine's own example machine. */
export const LAB_FRAME_COUNT = 16;

/** Four TLB slots is tight enough to evict after six touches - see the capacity story. */
export const LAB_TLB_CAPACITY = 4;

export interface LabMachineOptions {
  readonly pageSize?: number;
  /** `null` builds a machine without a TLB at all. */
  readonly tlbCapacity?: number | null;
  readonly processName?: string;
}

/** Build the lab machine the UI (and every address preset) starts a session on. */
export function createUiLabMachine(options: LabMachineOptions = {}): MachineState {
  return createMachineState({
    pageSize: options.pageSize ?? DEMO_PAGE_SIZE,
    frameCount: LAB_FRAME_COUNT,
    pid: 1,
    processName: options.processName ?? "memorylab-demo",
    pageTableEntries: LAB_ENTRIES.map((entry) => ({ ...entry })),
    ...(options.tlbCapacity === null ? {} : { tlbCapacity: options.tlbCapacity ?? LAB_TLB_CAPACITY }),
  });
}

/** An address preset turned into the virtual address it names. */
export function addressForPreset(page: number, offset: number, pageSize: number): number {
  return page * pageSize + offset;
}
