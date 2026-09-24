/**
 * Tests for the event presentation layer.
 *
 * Driven by REAL engine output rather than hand-written event literals, for two
 * reasons. It proves the events the product actually produces are the ones that
 * can be explained. And it makes the suite fail by itself if the engine ever grows
 * a new event: the loop presents every event the engine emitted, so an unhandled
 * one throws `assertUnreachable` and the test goes red instead of a user meeting
 * a blank explanation panel.
 */

import { describe, expect, it } from "vitest";

import {
  CLASSIC_REFERENCE_STRING,
  createLabMachine,
  runReferenceString,
  step,
} from "../../engine";
import type { Action, Event, MachineState, ReplacementEvent } from "../../engine";

import { presentEvent } from "../../ui/src/lib/eventPresentation";
import type { AnyEngineEvent } from "../../ui/src/lib/eventPresentation";

const PAGE_SIZE = 4096;

/** Run a list of actions on one machine, keeping every event they produce. */
function collectTranslationEvents(actions: readonly Action[]): Event[] {
  const collected: Event[] = [];
  let state: MachineState = createLabMachine();

  for (const action of actions) {
    const result = step(state, action);
    state = result.state;
    collected.push(...result.events);
  }
  return collected;
}

const access = (page: number): Action => ({
  type: "ACCESS_ADDRESS",
  address: page * PAGE_SIZE,
  access: "read",
});

/**
 * Every translation event, provoked by actually doing the things that cause them.
 * Page 1 is resident and page 6 is not in the engine's own lab preset, so this
 * list walks the whole chain, hits the cache, exhausts it, faults, unmaps, flushes.
 */
const TRANSLATION_EVENTS: Event[] = collectTranslationEvents([
  access(1), // miss -> page table hit -> fill -> RAM
  access(1), // TLB hit
  access(6), // page fault: the page is not in RAM
  access(0),
  access(2),
  access(3),
  access(4),
  access(5), // more distinct pages than the TLB has slots -> evict
  { type: "UNMAP_PAGE", pageNumber: 0 }, // PAGE_UNMAPPED + TLB_INVALIDATE
  { type: "CLEAR_TLB" }, // TLB_INVALIDATE by flush
]);

/** The replacement harness's own events, also provoked rather than faked. */
const REPLACEMENT_EVENTS: readonly ReplacementEvent[] =
  runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 3).events;

const ALL_EVENTS: readonly AnyEngineEvent[] = [...TRANSLATION_EVENTS, ...REPLACEMENT_EVENTS];

describe("presentEvent", () => {
  it("provokes a broad set of real engine events", () => {
    // A guard on the guard: if the scenarios above stopped provoking something,
    // the "every event is explained" test below would quietly become vacuous,
    // which is worse than no test at all.
    const tags = new Set(ALL_EVENTS.map((event) => event.type));
    expect(tags.size).toBeGreaterThanOrEqual(18);
  });

  it("explains EVERY event the engine produced, with no gaps", () => {
    for (const event of ALL_EVENTS) {
      // An unhandled event throws here, which is exactly the signal we want.
      const presented = presentEvent(event);

      expect(presented.title.length, `title for ${event.type}`).toBeGreaterThan(0);
      expect(presented.state.length, `state for ${event.type}`).toBeGreaterThan(0);
      expect(presented.what.length, `what for ${event.type}`).toBeGreaterThan(0);
      expect(presented.why.length, `why for ${event.type}`).toBeGreaterThan(0);
      expect(presented.next.length, `next for ${event.type}`).toBeGreaterThan(0);
      expect(presented.facts.length, `facts for ${event.type}`).toBeGreaterThan(0);
    }
  });

  it("never leaks a formatting failure into learner-visible text", () => {
    for (const event of ALL_EVENTS) {
      const presented = presentEvent(event);
      const everything = [
        presented.title,
        presented.state,
        presented.what,
        presented.why,
        presented.next,
        ...presented.facts.map((entry) => entry.value),
      ].join(" ");

      expect(everything).not.toContain("NaN");
      expect(everything).not.toContain("undefined");
      expect(everything).not.toContain("[object Object]");
    }
  });

  it("phrases a TLB miss the way the product promises", () => {
    const miss = ALL_EVENTS.find((event) => event.type === "TLB_MISS");
    expect(miss).toBeDefined();

    const presented = presentEvent(miss as AnyEngineEvent);
    expect(presented.title).toBe("TLB MISS");
    expect(presented.what).toContain("wasn't cached");
    expect(presented.next).toBe("Check the page table.");
  });

  it("tells the two different PAGE_FAULT events apart", () => {
    // Both tags appear many times over, so the assertion is about the two SHAPES
    // being distinguished, not about how many faults a run happens to produce.
    const faults = ALL_EVENTS.filter((event) => event.type === "PAGE_FAULT");
    const translationFaults = faults.filter((event) => !("accessIndex" in event));
    const replacementFaults = faults.filter((event) => "accessIndex" in event);

    expect(translationFaults.length).toBeGreaterThan(0);
    expect(replacementFaults.length).toBeGreaterThan(0);

    const translation = presentEvent(translationFaults[0] as AnyEngineEvent);
    const replacement = presentEvent(replacementFaults[0] as AnyEngineEvent);

    // Same tag, genuinely different meanings: one translation stops dead, the
    // other is the start of load-or-replace work.
    expect(translation.next).toContain("stops here");
    expect(replacement.next).toMatch(/Load the page|Choose a victim/);
    expect(translation.next).not.toBe(replacement.next);

    // And the wording distinguishes them in the other direction too, so neither
    // can be mistaken for the other by a learner reading the panel.
    expect(translation.why).toContain("cannot finish this memory access");
    expect(replacement.why).toContain("START of the work");
  });

  it("states that a TLB hit skips the page table", () => {
    const hit = ALL_EVENTS.find((event) => event.type === "TLB_HIT");
    expect(hit).toBeDefined();

    const presented = presentEvent(hit as AnyEngineEvent);
    expect(presented.title).toBe("TLB HIT");
    expect(presented.why).toContain("page table does not need to be checked");
    expect(presented.next).toBe("The physical frame can be resolved directly.");
    expect(presented.tone).toBe("hit");
  });

  it("is a pure read of the event", () => {
    const event = ALL_EVENTS.find((candidate) => candidate.type === "RAM_ACCESS");
    expect(event).toBeDefined();

    const before = JSON.stringify(event);
    presentEvent(event as AnyEngineEvent);
    presentEvent(event as AnyEngineEvent);
    expect(JSON.stringify(event)).toBe(before);
  });
});
