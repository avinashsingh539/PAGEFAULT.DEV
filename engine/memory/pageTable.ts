/**
 * The page table: the mapping from virtual page numbers to physical frames.
 *
 * Today's engine only ever READS the page table, and only ever needs to answer one
 * question: "is this page in RAM, and if so, in which frame?".
 *
 * Deliberately NOT implemented in this phase: loading a page from disk, evicting a
 * page (FIFO / LRU / Optimal), permission bits, dirty/referenced bits.
 */

import { EngineError } from "../errors";
import type {
  FrameNumber,
  PageNumber,
  PageSize,
  PageTable,
  PageTableEntry,
  PageTableLookup,
} from "../types/memory";
import { assertValidFrameNumber, assertValidPageSize } from "./validation";

function assertValidPageNumber(pageNumber: PageNumber): void {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) {
    throw new EngineError(
      "INVALID_PAGE_TABLE",
      `page number must be a non-negative integer, received ${String(pageNumber)}`,
    );
  }
}

/** Build an entry for a page that is resident in RAM. */
export function presentEntry(pageNumber: PageNumber, frameNumber: FrameNumber): PageTableEntry {
  assertValidPageNumber(pageNumber);
  assertValidFrameNumber(frameNumber);
  return { pageNumber, present: true, frameNumber };
}

/** Build an entry for a page that exists but is not resident in RAM (faults on access). */
export function absentEntry(pageNumber: PageNumber): PageTableEntry {
  assertValidPageNumber(pageNumber);
  return { pageNumber, present: false, frameNumber: null };
}

/**
 * Build a page table from entries, rejecting inconsistent input:
 * a present entry must name a frame, a non-present entry must not, and a page
 * number may only appear once.
 */
export function createPageTable(
  pageSize: PageSize,
  entries: readonly PageTableEntry[],
): PageTable {
  assertValidPageSize(pageSize);

  const byPageNumber: Record<PageNumber, PageTableEntry> = {};

  for (const entry of entries) {
    assertValidPageNumber(entry.pageNumber);

    if (byPageNumber[entry.pageNumber] !== undefined) {
      throw new EngineError(
        "INVALID_PAGE_TABLE",
        `duplicate page table entry for page ${entry.pageNumber}`,
      );
    }

    if (entry.present) {
      if (entry.frameNumber === null) {
        throw new EngineError(
          "INVALID_PAGE_TABLE",
          `page ${entry.pageNumber} is marked present but has no frame number`,
        );
      }
      assertValidFrameNumber(entry.frameNumber);
    } else if (entry.frameNumber !== null) {
      throw new EngineError(
        "INVALID_PAGE_TABLE",
        `page ${entry.pageNumber} is not present but names frame ${entry.frameNumber}`,
      );
    }

    byPageNumber[entry.pageNumber] = entry;
  }

  return { pageSize, entries: byPageNumber };
}

/**
 * Look up a page. A missing entry and a present-bit of 0 both mean the same thing
 * to the hardware: the page is not in RAM, so the access page-faults.
 */
export function lookupPage(table: PageTable, pageNumber: PageNumber): PageTableLookup {
  assertValidPageNumber(pageNumber);

  const entry = table.entries[pageNumber];
  if (entry === undefined || !entry.present || entry.frameNumber === null) {
    return {
      present: false,
      pageNumber,
      reason: "PAGE_NOT_PRESENT",
      entry: entry ?? null,
    };
  }

  return {
    present: true,
    pageNumber,
    frameNumber: entry.frameNumber,
    entry,
  };
}

/** Entries in ascending page order - a stable ordering for logs, tests and the future UI. */
export function pageTableEntries(table: PageTable): readonly PageTableEntry[] {
  return Object.values(table.entries).sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * The result of removing a mapping: either the page table without it, or `null` when
 * there was no mapping to remove.
 *
 * `null` is not an error. Unmapping a page that is already unmapped (or that has no
 * entry at all) changes nothing, and the engine reports nothing rather than inventing
 * an event for a change it did not make.
 */
export interface PageUnmapResult {
  readonly table: PageTable;
  /** The frame the page was released from, or `null` when nothing was mapped. */
  readonly frameNumber: FrameNumber | null;
}

/**
 * Remove a page's mapping to a frame. The page KEEPS its entry, marked not present,
 * so the page still exists in the address space - it is simply no longer in RAM.
 *
 * This is the page table's half of an unmap; freeing the physical frame and dropping
 * a stale TLB entry belong to the caller (`step()` in `machine.ts`), because only the
 * machine holds all three pieces of that one fact.
 */
export function unmapPage(table: PageTable, pageNumber: PageNumber): PageUnmapResult {
  assertValidPageNumber(pageNumber);

  const entry = table.entries[pageNumber];

  if (entry === undefined || !entry.present || entry.frameNumber === null) {
    return { table, frameNumber: null };
  }

  const entries: Record<PageNumber, PageTableEntry> = { ...table.entries };
  entries[pageNumber] = absentEntry(pageNumber);

  return { table: { pageSize: table.pageSize, entries }, frameNumber: entry.frameNumber };
}