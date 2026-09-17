/**
 * Memory model types for the PAGEFAULT.DEV simulation engine.
 *
 * This file is pure TypeScript: no React, no DOM, no framework, no runtime state.
 *
 * Conceptual model used throughout the engine:
 *
 *   Virtual Address  = Page Number + Offset
 *   Page Table       = Virtual Page -> Physical Frame
 *   Physical Address = Frame Number + Offset
 *
 * All numeric aliases below are deliberately just `number`, but they are named so
 * that a reader (and the compiler's intent) can tell a page number apart from a
 * frame number or an offset.
 */

/** A virtual address, expressed as an integer byte offset from 0 in the process' address space. */
export type VirtualAddress = number;

/** A physical address, expressed as an integer byte offset from 0 in physical RAM. */
export type PhysicalAddress = number;

/** Size of one page / one frame, in bytes (commonly 4096). */
export type PageSize = number;

/** Index of a page inside a virtual address space (page number = VPN). */
export type PageNumber = number;

/** Index of a frame inside physical memory (frame number = PFN). */
export type FrameNumber = number;

/** Byte offset inside a page or frame. Always `0 <= offset < pageSize`. */
export type Offset = number;

/** Kind of memory access performed by the CPU. */
export type AccessKind = "read" | "write";

/** Result of splitting an address into its two architectural halves. */
export interface AddressSplit {
  /** The address that was split (kept so an event/result is self-describing). */
  readonly virtualAddress: VirtualAddress;
  /** The page size that was used for the split. */
  readonly pageSize: PageSize;
  /** High bits: which page the address belongs to. */
  readonly pageNumber: PageNumber;
  /** Low bits: where inside that page the address points. */
  readonly offset: Offset;
}

/**
 * One row of a page table.
 *
 * A present entry points at the frame that currently holds the page.
 * A non-present entry has no frame (`frameNumber === null`) and is the sole
 * cause of a page fault in today's engine.
 */
export interface PageTableEntry {
  readonly pageNumber: PageNumber;
  readonly present: boolean;
  /** The frame holding this page, or `null` when the page is not resident. */
  readonly frameNumber: FrameNumber | null;
}

/**
 * A process' page table. Stored as a plain record so it stays serialisable,
 * deterministic and easy to construct in tests. Missing keys mean "no entry
 * exists for that page" (also a page fault).
 */
export interface PageTable {
  readonly pageSize: PageSize;
  readonly entries: Readonly<Record<PageNumber, PageTableEntry>>;
}

/** Why a page fault was raised. Only the "page is not in RAM" case exists today. */
export type PageFaultReason = "PAGE_NOT_PRESENT";

/**
 * Result of a page table lookup: either a hit with a frame, or a miss that
 * describes the fault. Modelled as a discriminated union so callers must handle
 * both cases before they can build a physical address.
 */
export type PageTableLookup =
  | {
      readonly present: true;
      readonly pageNumber: PageNumber;
      readonly frameNumber: FrameNumber;
      readonly entry: PageTableEntry;
    }
  | {
      readonly present: false;
      readonly pageNumber: PageNumber;
      readonly reason: PageFaultReason;
      /** The entry that was found, when the page exists but is not resident. */
      readonly entry: PageTableEntry | null;
    };

/** Metadata for one frame of physical RAM. */
export interface PhysicalFrame {
  readonly frameNumber: FrameNumber;
  /** Process that owns the page currently mapped into this frame, if any. */
  readonly ownerPid: number | null;
  /** Page currently mapped into this frame, if any. */
  readonly pageNumber: PageNumber | null;
}

/** Physical RAM as a fixed array of frames. */
export interface PhysicalMemory {
  readonly pageSize: PageSize;
  readonly frameCount: number;
  readonly frames: readonly PhysicalFrame[];
}