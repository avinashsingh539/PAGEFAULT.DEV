/**
 * The event presentation layer: engine event -> human explanation -> UI.
 *
 *   Engine Event  ->  presentEvent()  ->  PresentedEvent  ->  EventExplanation
 *
 * THE ONE RULE: this file READS events and returns strings. It never constructs
 * one, never mutates one, and never imports anything that computes an OS fact. The
 * engine's events are deliberately low-level and factual ("ADDRESS_SPLIT, page 1,
 * offset 837"); the job of this file is to turn each one into the four answers a
 * learner needs - what the state was, what happened, why, and what comes next.
 *
 * WHY IT IS ITS OWN MODULE: three screens show explanations (the Lab, the lesson
 * and Compare), and Task 13's documentation describes the same events. If each of
 * those phrased an event for itself, the product would teach three slightly
 * different things about the same hardware event. One table, one wording,
 * everywhere - including the docs, which read from here rather than being retyped.
 *
 * A NOTE ON `PAGE_FAULT`, WHICH EXISTS TWICE: the engine has a page fault in the
 * address-translation stream and another in the page-replacement harness. They
 * share a tag and mean different things - the second is always followed by the
 * work that resolves it. They are told apart by `accessIndex`, which only the
 * replacement event carries, so the two are never confused for one another.
 */

import type { Event, ReplacementEvent } from "../../../engine";

import type { PresentedEvent } from "../design/viz/EventExplanation";

/** Anything the engine can hand us that a learner might be shown. */
export type AnyEngineEvent = Event | ReplacementEvent;

/** Lowercase hex, matching the address format the E2E suite already asserts on. */
function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

function fact(label: string, value: string | number): { label: string; value: string } {
  return { label, value: String(value) };
}

/**
 * The replacement harness's events are the ones carrying `accessIndex`.
 *
 * Used to route them, and to tell the two `PAGE_FAULT` events apart.
 */
function isReplacementEvent(event: AnyEngineEvent): event is ReplacementEvent {
  return "accessIndex" in event;
}

/** The raw tag of an event, for the technical-mode event list. */
export function eventTag(event: AnyEngineEvent): string {
  return event.type;
}

/**
 * Turn one engine event into a four-part explanation.
 *
 * Exhaustive by construction: the switch returns from every branch, so adding an
 * event to the engine becomes a TYPE ERROR naming the missing case rather than a
 * blank explanation panel discovered by a user. That is why there is no silent
 * fallback branch here.
 */
export function presentEvent(event: AnyEngineEvent): PresentedEvent {
  switch (event.type) {
    case "CPU_MEMORY_ACCESS": {
      const read = event.access === "read";
      return {
        title: "CPU REQUESTS MEMORY",
        state: `The CPU wants to ${read ? "read from" : "write to"} address ${hex(event.virtualAddress)}.`,
        what: `The CPU issued a ${event.access} for virtual address ${hex(event.virtualAddress)}.`,
        why: "A program only ever names virtual addresses. It has no idea which physical frame will hold the data.",
        next: "The address goes to the memory-management unit, which has to translate it.",
        tone: "primary",
        icon: "cpu",
        facts: [
          fact("access", event.access),
          fact("virtual address", hex(event.virtualAddress)),
          fact("pid", event.pid),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "VIRTUAL_ADDRESS_GENERATED": {
      return {
        title: "VIRTUAL ADDRESS",
        state: `The memory unit now holds address ${hex(event.virtualAddress)} for process ${event.pid}.`,
        what: `The memory-management unit received virtual address ${hex(event.virtualAddress)}.`,
        why: "Translation has to start from the address the program asked for, not from a guessed physical location.",
        next: "Split the address into a page number and an offset.",
        tone: "info",
        icon: "route",
        facts: [
          fact("virtual address", hex(event.virtualAddress)),
          fact("pid", event.pid),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "ADDRESS_SPLIT": {
      return {
        title: "ADDRESS SPLIT",
        state: `The address is ${hex(event.virtualAddress)} and a page holds ${event.pageSize} bytes.`,
        what: `Page number ${event.pageNumber}, offset ${event.offset}.`,
        why: "Paging only works because an address can be cut into \"which page\" and \"how far into it\".",
        next: "Look the page number up in the cache first: the TLB.",
        tone: "info",
        icon: "route",
        facts: [
          fact("virtual address", hex(event.virtualAddress)),
          fact("page size", `${event.pageSize} B`),
          fact("page number", event.pageNumber),
          fact("offset", event.offset),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_LOOKUP": {
      return {
        title: "TLB LOOKUP",
        state: `The TLB is being searched for a translation of page ${event.pageNumber}.`,
        what: `The memory unit checked ${event.entriesSearched} cache slot${event.entriesSearched === 1 ? "" : "s"} for page ${event.pageNumber}.`,
        why: "If the translation is cached, the page table never has to be touched. That is the whole point of a TLB.",
        next: "Either the TLB answers, or the page table is consulted.",
        tone: "info",
        icon: "layers",
        facts: [
          fact("page number", event.pageNumber),
          fact("entries searched", event.entriesSearched),
          fact("virtual address", hex(event.virtualAddress)),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_HIT": {
      return {
        title: "TLB HIT",
        state: `Page ${event.pageNumber} was already cached, in slot ${event.slotIndex}.`,
        what: `The TLB answered at once: page ${event.pageNumber} lives in frame ${event.frameNumber}.`,
        why: "The translation was already cached, so the page table does not need to be checked.",
        next: "The physical frame can be resolved directly.",
        tone: "hit",
        icon: "check",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("slot", event.slotIndex),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_MISS": {
      return {
        title: "TLB MISS",
        state: `Page ${event.pageNumber} is not in the TLB (${event.reason}).`,
        what: "The translation wasn't cached in the TLB.",
        why: "A cache cannot answer every request. A miss is normal, not a failure.",
        next: "Check the page table.",
        tone: "info",
        icon: "info",
        facts: [
          fact("page number", event.pageNumber),
          fact("reason", event.reason),
          fact("entries searched", event.entriesSearched),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_FILL": {
      return {
        title: "TLB FILL",
        state: `The TLB now holds ${event.occupancy} of ${event.capacity} cached translations.`,
        what: `Page ${event.pageNumber} -> frame ${event.frameNumber} was cached in slot ${event.slotIndex}.`,
        why: "Caching this translation is what makes the NEXT access to this page cheap.",
        next: event.evicted
          ? "The page table is consulted for the evicted page on a future access."
          : "Translation continues with the page-table result just found.",
        tone: "primary",
        icon: "layers",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("slot", event.slotIndex),
          fact("occupancy", `${event.occupancy}/${event.capacity}`),
          fact("evicted", event.evicted ? "yes" : "no"),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_EVICT": {
      return {
        title: "TLB EVICT",
        state: `Slot ${event.slotIndex} was needed for a new translation.`,
        what: `The cached translation for page ${event.pageNumber} (frame ${event.frameNumber}) was dropped.`,
        why: `The TLB has fixed room and its policy is ${event.policy}, so the oldest cached translation leaves first.`,
        next: "The new translation takes the freed slot. The page itself is untouched - only the cache lost it.",
        tone: "fault",
        icon: "alert",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("slot", event.slotIndex),
          fact("policy", event.policy),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "TLB_INVALIDATE": {
      return {
        title: "TLB INVALIDATE",
        state: `The TLB was holding a translation for page ${event.pageNumber} in frame ${event.frameNumber}.`,
        what: `The cached translation for page ${event.pageNumber} was dropped (${event.reason}).`,
        why: "The translation it cached no longer describes reality. A stale entry must never stay usable.",
        next: "The next access to this page will miss the TLB and go to the page table.",
        tone: "fault",
        icon: "alert",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("reason", event.reason),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "PAGE_TABLE_LOOKUP": {
      return {
        title: "PAGE TABLE LOOKUP",
        state: `The TLB could not answer, so the page table is being searched for page ${event.pageNumber}.`,
        what: `The memory unit read the page-table entry for page ${event.pageNumber}.`,
        why: "The page table is the authority on where a page lives. The TLB is only a shortcut to it.",
        next: "The entry says whether the page is in RAM, or whether this access faults.",
        tone: "info",
        icon: "table",
        facts: [
          fact("page number", event.pageNumber),
          fact("virtual address", hex(event.virtualAddress)),
          fact("pid", event.pid),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "PAGE_TABLE_HIT": {
      return {
        title: "PAGE TABLE HIT",
        state: `Page ${event.pageNumber} has a valid entry.`,
        what: `The page table says page ${event.pageNumber} lives in frame ${event.frameNumber}.`,
        why: "The page is in RAM, so the access can be completed instead of faulting.",
        next: "Resolve the physical frame.",
        tone: "hit",
        icon: "check",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("sequence", event.sequence),
        ],
      };
    }

    // Two different events share this tag. `accessIndex` exists only on the
    // replacement-harness one, which is also the only one that gets resolved.
    case "PAGE_FAULT": {
      if (isReplacementEvent(event)) {
        return {
          title: "PAGE FAULT",
          state: `Page ${event.pageNumber} is not in RAM, and ${event.freeFramesRemaining} frame${event.freeFramesRemaining === 1 ? " is" : "s are"} still free.`,
          what: `Access ${event.accessIndex + 1} wanted page ${event.pageNumber}, which is not resident.`,
          why: "RAM is full, or the page was never loaded. A fault here is the START of the work, not the end.",
          next:
            event.freeFramesRemaining > 0
              ? "Load the page into a free frame."
              : "Choose a victim, evict it, then load the page.",
          tone: "fault",
          icon: "alert",
          facts: [
            fact("access", event.accessIndex + 1),
            fact("page number", event.pageNumber),
            fact("reason", event.reason),
            fact("free frames", event.freeFramesRemaining),
            fact("sequence", event.sequence),
          ],
        };
      }
      return {
        title: "PAGE FAULT",
        state: `Page ${event.pageNumber} is not currently in RAM.`,
        what: `The page table has no frame for page ${event.pageNumber}, so the access cannot be completed.`,
        why: "The CPU cannot finish this memory access: the data it asked for is not in physical memory.",
        next: "The simulated translation stops here. Resolving a fault is a later step, not part of this access.",
        tone: "fault",
        icon: "alert",
        facts: [
          fact("virtual address", hex(event.virtualAddress)),
          fact("page number", event.pageNumber),
          fact("offset", event.offset),
          fact("access", event.access),
          fact("reason", event.reason),
          fact("pid", event.pid),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "PAGE_UNMAPPED": {
      return {
        title: "PAGE UNMAPPED",
        state: `Page ${event.pageNumber} was using frame ${event.frameNumber}.`,
        what: `The mapping for page ${event.pageNumber} was removed and frame ${event.frameNumber} was released.`,
        why: "Removing a mapping is what makes a stale TLB entry dangerous: the translation it cached no longer exists.",
        next: "Any cached translation for this page is dropped from the TLB.",
        tone: "fault",
        icon: "alert",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("pid", event.pid),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "FRAME_RESOLVED": {
      return {
        title: "FRAME RESOLVED",
        state: `Page ${event.pageNumber} has been translated to a concrete frame.`,
        what: `The translation succeeded: page ${event.pageNumber} is in frame ${event.frameNumber}.`,
        why: "Translation is finished. What is left is only address arithmetic to reach the exact byte.",
        next: "Combine the frame number with the offset to get the physical address.",
        tone: "hit",
        icon: "table",
        facts: [
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "PHYSICAL_ADDRESS_GENERATED": {
      return {
        title: "PHYSICAL ADDRESS",
        state: `The page is in frame ${event.frameNumber} and the offset is ${event.offset}.`,
        what: `Virtual ${hex(event.virtualAddress)} became physical ${hex(event.physicalAddress)}.`,
        why: `Frame number x page size (${event.pageSize} B) plus the offset gives the byte's real location.`,
        next: "The CPU can now touch that byte in RAM.",
        tone: "hit",
        icon: "bolt",
        facts: [
          fact("virtual address", hex(event.virtualAddress)),
          fact("physical address", hex(event.physicalAddress)),
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("offset", event.offset),
          fact("page size", `${event.pageSize} B`),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "RAM_ACCESS": {
      return {
        title: event.access === "write" ? "RAM WRITE" : "RAM READ",
        state: `The translation succeeded and the access reached physical memory.`,
        what: `The CPU ${event.access === "write" ? "wrote to" : "read from"} ${hex(event.physicalAddress)} in frame ${event.frameNumber}.`,
        why: "This is the end of the chain: the only event that means the byte was actually touched.",
        next: "The access is complete.",
        tone: "hit",
        icon: "memory",
        facts: [
          fact("physical address", hex(event.physicalAddress)),
          fact("frame number", event.frameNumber),
          fact("offset", event.offset),
          fact("access", event.access),
          fact("sequence", event.sequence),
        ],
      };
    }

    // ---- Page replacement harness -----------------------------------------

    case "PAGE_HIT": {
      return {
        title: "PAGE HIT",
        state: `Page ${event.pageNumber} is already resident in frame ${event.frameNumber}.`,
        what: `Access ${event.accessIndex + 1} found page ${event.pageNumber} in frame ${event.frameNumber}.`,
        why: "No frame work is needed. The hit still records the use, which is what LRU relies on.",
        next: "The next page in the reference string is tried.",
        tone: "hit",
        icon: "check",
        facts: [
          fact("access", event.accessIndex + 1),
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "REPLACEMENT_DECISION": {
      return {
        title: "SELECT VICTIM",
        state: `RAM is full, and page ${event.pageNumber} needs a frame.`,
        what: `${event.algorithm} chose page ${event.victimPageNumber} in frame ${event.victimFrameNumber} as the victim.`,
        why: "The page table is full, so exactly one resident page has to leave to make room for the new one.",
        next: `Evict page ${event.victimPageNumber}, then load page ${event.pageNumber}.`,
        tone: "fault",
        icon: "alert",
        facts: [
          fact("access", event.accessIndex + 1),
          fact("algorithm", event.algorithm),
          fact("incoming page", event.pageNumber),
          fact("victim page", event.victimPageNumber),
          fact("victim frame", event.victimFrameNumber),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "EVICT_PAGE": {
      return {
        title: "EVICT",
        state: `Page ${event.pageNumber} was resident in frame ${event.frameNumber}.`,
        what: `Page ${event.pageNumber} was removed from frame ${event.frameNumber} by ${event.algorithm}.`,
        why: "The frame it occupied is about to be handed to a different page.",
        next: "The freed frame is now empty and available for the incoming page.",
        tone: "fault",
        icon: "close",
        facts: [
          fact("access", event.accessIndex + 1),
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("algorithm", event.algorithm),
          fact("sequence", event.sequence),
        ],
      };
    }

    case "LOAD_PAGE": {
      return {
        title: "LOAD",
        state: `Frame ${event.frameNumber} was empty and waiting.`,
        what: `Page ${event.pageNumber} was loaded into frame ${event.frameNumber}.`,
        why: "This is what resolves a page fault: the data the CPU wanted is now in RAM.",
        next: "The access completes. The next page in the reference string is tried.",
        tone: "hit",
        icon: "check",
        facts: [
          fact("access", event.accessIndex + 1),
          fact("page number", event.pageNumber),
          fact("frame number", event.frameNumber),
          fact("sequence", event.sequence),
        ],
      };
    }
    default: {
      // Unreachable while the switch stays exhaustive - see `assertUnreachable`.
      return assertUnreachable(event);
    }
  }
}

/**
 * Compile-time exhaustiveness.
 *
 * If an event type is added to the engine and not handled above, TypeScript makes
 * `event` `never` here and the call stops compiling - which is the outcome we
 * want, and the reason this file has no silent fallback branch.
 */
function assertUnreachable(event: never): PresentedEvent {
  throw new Error(`eventPresentation: unhandled event ${JSON.stringify(event)}`);
}
