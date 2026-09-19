/**
 * What the hardware did, in one verdict line plus the numbers the UI paints.
 *
 * Every value below is read off the engine's events or handed over whole in engine
 * state - never derived here. See `session.ts` for the exact boundary.
 */

import type { Event, PhysicalAddress } from "../../../engine";

/** A human sentence for the event under the cursor, built from its own payload. */
export function eventDrilldown(event: Event | null): string {
  if (event === null) {
    return "No event under the cursor yet.";
  }
  switch (event.type) {
    case "CPU_MEMORY_ACCESS":
    case "VIRTUAL_ADDRESS_GENERATED":
      return `${friendlyType(event.type)} — ${hexOf(event)}`;
    case "ADDRESS_SPLIT":
      return `Page ${event.pageNumber}, offset ${event.offset} (page size ${event.pageSize}).`;
    case "TLB_LOOKUP":
      return `The MMU compares page ${event.pageNumber} against ${event.entriesSearched} cached slot(s).`;
    case "TLB_HIT":
      return `Cached: page ${event.pageNumber} → frame ${event.frameNumber} (slot ${event.slotIndex}). The page table stays dark.`;
    case "TLB_MISS":
      return `Not cached (${event.reason}). The page table decides next.`;
    case "PAGE_TABLE_LOOKUP":
      return `Walking the table for page ${event.pageNumber}.`;
    case "PAGE_TABLE_HIT":
      return `Page ${event.pageNumber} lives in frame ${event.frameNumber}.`;
    case "PAGE_FAULT":
      return `Page ${event.pageNumber} is not resident (${event.reason}). Translation stops — no frame, no address, no RAM.`;
    case "TLB_FILL":
      return `Caching page ${event.pageNumber} → frame ${event.frameNumber} in slot ${event.slotIndex} (${event.occupancy}/${event.capacity}${event.evicted ? ", evicted one" : ", free slot"}).`;
    case "TLB_EVICT":
      return `FIFO removed page ${event.pageNumber} from slot ${event.slotIndex} to make room.`;
    case "TLB_INVALIDATE":
      return `Dropped the stale copy of page ${event.pageNumber} (${event.reason}).`;
    case "FRAME_RESOLVED":
      return `Page ${event.pageNumber} resolved to frame ${event.frameNumber}.`;
    case "PHYSICAL_ADDRESS_GENERATED":
      return `Frame ${event.frameNumber} × page size + offset ${event.offset} = ${hexOfPhysical(event.physicalAddress)}.`;
    case "RAM_ACCESS":
      return `${event.access.toUpperCase()} at ${hexOfPhysical(event.physicalAddress)} (frame ${event.frameNumber}, offset ${event.offset}).`;
  }
}

function friendlyType(type: Event["type"]): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function hexOf(event: Extract<Event, { type: "CPU_MEMORY_ACCESS" | "VIRTUAL_ADDRESS_GENERATED" }>): string {
  return `0x${event.virtualAddress.toString(16)}`;
}

function hexOfPhysical(physicalAddress: PhysicalAddress): string {
  return `0x${physicalAddress.toString(16)}`;
}