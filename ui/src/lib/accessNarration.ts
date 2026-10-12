/**
 * The access narration: what one memory access did, as a short journey.
 *
 * THE PROBLEM THIS SOLVES. The Lab's right column explains the single event
 * under the Step cursor via `presentEvent()`. That is right for scrubbing, but
 * wrong for the moment right after an access: the cursor lands on the first
 * event (`CPU_MEMORY_ACCESS` - "the CPU issued a read..."), which says nothing
 * about the outcome. A newcomer who pressed Access learns that the CPU asked
 * for an address - which they already knew - and never sees that the TLB hit,
 * the page table filled the cache, or the access faulted, unless they discover
 * Step on their own. This module summarizes the WHOLE record instead: outcome
 * first (hit / miss-then-RAM / fault), then the engine steps that occurred.
 *
 * THE RULE. Same boundary as `labView.ts`: this function READS whole engine
 * events and formats them. It never divides an address, never decides hit or
 * miss, never derives a frame or a physical address. Every value is quoted
 * from an event payload; the terse labels ("TLB miss", "Page table hit") are
 * the only vocabulary added, and they name event types, not new facts. The
 * longer "why" text is quoted verbatim from `presentEvent()` for the same
 * events, so the narration can never disagree with the per-event panel.
 */

import type { Event } from "../../../engine";
import { presentEvent } from "./eventPresentation";

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

/** One step of the journey: an icon-word label plus one sourced sentence. */
export interface NarrationStep {
  /** Short label naming the engine step, e.g. "TLB miss". */
  readonly label: string;
  /** One sentence quoted or paraphrased from the event's own payload/phrasing. */
  readonly detail: string;
  /** Mirrors the tone of the underlying event: progress, success, or failure. */
  readonly tone: "primary" | "hit" | "fault";
}

/** The whole access in one value: outcome badge + ordered journey. */
export interface AccessNarration {
  /** What to announce first: the access's actual outcome. */
  readonly outcome:
    | { readonly kind: "ram"; readonly physicalAddress: number }
    | { readonly kind: "fault"; readonly pageNumber: number };
  readonly tone: "hit" | "fault";
  readonly icon: "check" | "alert";
  /** The journey in hardware order: only steps whose events actually occurred. */
  readonly steps: readonly NarrationStep[];
}

function firstOfType<T extends Event["type"]>(
  events: readonly Event[],
  type: T,
): Extract<Event, { readonly type: T }> | null {
  const found = events.find((event) => event.type === type);
  return (found ?? null) as Extract<Event, { readonly type: T }> | null;
}

/**
 * Summarize one access record's events as an outcome plus journey steps.
 *
 * Returns `null` for records with no events (nothing to narrate) or for a
 * fault-free access that never reached RAM (no such engine record exists
 * today, but a narration must not invent an outcome for one).
 *
 * Maintenance and invalidation records have no translation to narrate; the
 * caller keeps rendering those through `EventExplanation` directly.
 */
export function summarizeAccess(events: readonly Event[]): AccessNarration | null {
  if (events.length === 0) {
    return null;
  }
  const access = firstOfType(events, "CPU_MEMORY_ACCESS");
  const split = firstOfType(events, "ADDRESS_SPLIT");
  const tlbHit = firstOfType(events, "TLB_HIT");
  const tlbMiss = firstOfType(events, "TLB_MISS");
  const pageTableHit = firstOfType(events, "PAGE_TABLE_HIT");
  const fault = firstOfType(events, "PAGE_FAULT");
  const physical = firstOfType(events, "PHYSICAL_ADDRESS_GENERATED");
  const ram = firstOfType(events, "RAM_ACCESS");

  const steps: NarrationStep[] = [];

  if (access !== null) {
    steps.push({
      label: "CPU request",
      detail: `The CPU issued a ${access.access} for virtual address ${hex(access.virtualAddress)}.`,
      tone: "primary",
    });
  }
  if (split !== null) {
    steps.push({
      label: "Address split",
      detail: `The MMU split ${hex(split.virtualAddress)} into page ${split.pageNumber} and offset ${split.offset}.`,
      tone: "primary",
    });
  }
  if (tlbHit !== null) {
    steps.push({
      label: "TLB hit",
      detail: `Page ${tlbHit.pageNumber} was already cached, mapping to frame ${tlbHit.frameNumber} - so the page table was skipped.`,
      tone: "hit",
    });
  } else if (tlbMiss !== null) {
    // A miss is neutral, not a failure: the translation simply wasn't cached.
    // The "why" is the TLB_MISS event's own reasoning, quoted verbatim.
    steps.push({
      label: "TLB miss",
      detail: presentEvent(tlbMiss).why,
      tone: "primary",
    });
  }
  if (pageTableHit !== null) {
    steps.push({
      label: "Page table hit",
      detail: `The page table maps page ${pageTableHit.pageNumber} to frame ${pageTableHit.frameNumber}.`,
      tone: "primary",
    });
  }
  // A fault is terminal: the engine emits no frame, physical address, or RAM
  // access after it, so the narration stops here too.
  if (fault !== null) {
    steps.push({
      label: "Page fault",
      detail: `Page ${fault.pageNumber} is not resident, so the translation stops with no frame, no physical address, and no RAM access.`,
      tone: "fault",
    });
    return {
      outcome: { kind: "fault", pageNumber: fault.pageNumber },
      tone: "fault",
      icon: "alert",
      steps,
    };
  }
  if (physical !== null && ram !== null) {
    steps.push({
      label: "Translated to RAM",
      detail: `Frame ${physical.frameNumber} plus offset ${physical.offset} gives physical address ${hex(physical.physicalAddress)}, and the CPU ${ram.access === "read" ? "read" : "wrote"} it.`,
      tone: "hit",
    });
    return {
      outcome: { kind: "ram", physicalAddress: physical.physicalAddress },
      tone: "hit",
      icon: "check",
      steps,
    };
  }
  return null;
}

