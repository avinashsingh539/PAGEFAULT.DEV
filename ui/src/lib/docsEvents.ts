/**
 * The Docs event reference, GENERATED rather than retyped.
 *
 * Every row is a real engine event object (typed against the engine's own union)
 * passed through the same `presentEvent()` the Lab uses. If the Lab ever rewords
 * "TLB MISS", this page changes with it - documentation and simulation cannot
 * drift apart, which is the whole reason this module exists.
 *
 * The samples use the documented default lab numbers (page size 4096, page 1 in
 * frame 7, offset 837 -> physical 0x7345) so the facts shown are internally
 * consistent across rows.
 */

import type { AnyEngineEvent } from "./eventPresentation";
import { eventTag, presentEvent } from "./eventPresentation";
import type { PresentedEvent } from "../design/viz/EventExplanation";

const PAGE_SIZE = 4096;

/** One row of the reference: the raw event, plus how the product explains it. */
export interface DocsEventRow {
  readonly tag: string;
  readonly presented: PresentedEvent;
}

/**
 * One sample per event type the machine can emit, in the order a successful
 * access produces them, then the fault path, then the maintenance events.
 */
const SAMPLES: readonly AnyEngineEvent[] = [
  {
    type: "CPU_MEMORY_ACCESS",
    sequence: 1,
    access: "read",
    virtualAddress: 0x1345,
    pid: 1,
  },
  {
    type: "VIRTUAL_ADDRESS_GENERATED",
    sequence: 2,
    virtualAddress: 0x1345,
    pid: 1,
  },
  {
    type: "ADDRESS_SPLIT",
    sequence: 3,
    virtualAddress: 0x1345,
    pageSize: PAGE_SIZE,
    pageNumber: 1,
    offset: 837,
  },
  {
    type: "TLB_LOOKUP",
    sequence: 4,
    virtualAddress: 0x1345,
    pageNumber: 1,
    pid: 1,
    entriesSearched: 4,
  },
  {
    type: "TLB_MISS",
    sequence: 5,
    pageNumber: 1,
    reason: "NOT_CACHED",
    entriesSearched: 4,
  },
  {
    type: "PAGE_TABLE_LOOKUP",
    sequence: 6,
    virtualAddress: 0x1345,
    pageNumber: 1,
    pid: 1,
  },
  {
    type: "PAGE_TABLE_HIT",
    sequence: 7,
    pageNumber: 1,
    frameNumber: 7,
  },
  {
    type: "TLB_FILL",
    sequence: 8,
    pageNumber: 1,
    frameNumber: 7,
    slotIndex: 0,
    occupancy: 1,
    capacity: 4,
    evicted: false,
  },
  { type: "FRAME_RESOLVED", sequence: 9, pageNumber: 1, frameNumber: 7 },
  {
    type: "PHYSICAL_ADDRESS_GENERATED",
    sequence: 10,
    virtualAddress: 0x1345,
    physicalAddress: 0x7345,
    pageNumber: 1,
    frameNumber: 7,
    offset: 837,
    pageSize: PAGE_SIZE,
  },
  {
    type: "RAM_ACCESS",
    sequence: 11,
    physicalAddress: 0x7345,
    frameNumber: 7,
    offset: 837,
    access: "read",
  },
  {
    type: "TLB_HIT",
    sequence: 12,
    pageNumber: 1,
    frameNumber: 7,
    slotIndex: 0,
  },
  {
    type: "TLB_EVICT",
    sequence: 13,
    pageNumber: 3,
    frameNumber: 2,
    slotIndex: 1,
    policy: "FIFO",
  },
  {
    type: "TLB_INVALIDATE",
    sequence: 14,
    pageNumber: 2,
    frameNumber: 4,
    reason: "EXPLICIT_FLUSH",
  },
  {
    type: "PAGE_FAULT",
    sequence: 15,
    virtualAddress: 0x6000,
    pageNumber: 6,
    offset: 0,
    access: "read",
    pid: 1,
    reason: "PAGE_NOT_PRESENT",
  },
  {
    type: "PAGE_UNMAPPED",
    sequence: 16,
    pageNumber: 4,
    frameNumber: 1,
    pid: 1,
  },
];

/** The reference table the Docs screen renders. */
export const DOCS_EVENT_REFERENCE: readonly DocsEventRow[] = SAMPLES.map((event) => ({
  tag: eventTag(event),
  presented: presentEvent(event),
}));
