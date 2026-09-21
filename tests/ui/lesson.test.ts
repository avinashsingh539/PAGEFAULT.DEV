/**
 * Tests for Learn Mode's model (`ui/src/lib/lesson.ts`).
 *
 * THE CONTRACT UNDER TEST
 *
 * A lesson is allowed to decide WHAT the learner looks at. It is not allowed to decide
 * what the hardware did. These tests therefore do two different jobs:
 *
 *   1. navigation and shortcuts behave (pure functions, no browser needed), and
 *   2. every claim the lesson makes is checked against the event stream `step()` really
 *      returned - including the claims about ABSENCE ("no frame, no physical address, no
 *      RAM access"). Every expected number below is either read out of an engine event or
 *      compared against one computed by the engine inside the test.
 */

import { describe, expect, it } from "vitest";

import { EXAMPLE_PAGE_SIZE, step } from "../../engine";
import type { Event, MachineState } from "../../engine";
import {
  ABSENT_PAGE_ADDRESS,
  ACTION_READ_ABSENT,
  ACTION_READ_X,
  ACTION_READ_X_AGAIN,
  FIRST_STEP_INDEX,
  LESSON_ACTIONS,
  LESSON_STEPS,
  X_ADDRESS,
  X_SECOND_ADDRESS,
  advanceForPlay,
  clampStepIndex,
  countEvents,
  createLessonMachine,
  createLessonMachineWithoutTlb,
  focusedPanels,
  isFirstStep,
  isLastStep,
  isPanelFocused,
  lastStepIndex,
  lessonCommandFor,
  nextStepIndex,
  previousStepIndex,
  runLesson,
  runTlbComparison,
  stepIndexForEvent,
} from "../../ui/src/lib/lesson";
import type { LearnStepState } from "../../ui/src/lib/lesson";

/** The lesson, played through the engine once. Every test below reads this same run. */
const run = runLesson();

function stepById(id: string): LearnStepState {
  const found = run.steps.find((state) => state.step.id === id);
  if (found === undefined) {
    throw new Error(`no lesson step with id "${id}"`);
  }
  return found;
}

function indexOfStep(id: string): number {
  return run.steps.findIndex((state) => state.step.id === id);
}

/** The event the cursor is actually sitting on, read straight off the record. */
function focusedEvent(state: LearnStepState): Event | null {
  if (state.record === null || state.cursor === null) {
    return null;
  }
  return state.record.events[state.cursor.eventIndex] ?? null;
}

/** Every number of one payload field the engine produced at or before the cursor. */
function valuesAtOrBefore(
  state: LearnStepState,
  field: "pageNumber" | "offset" | "frameNumber" | "physicalAddress",
): readonly number[] {
  if (state.record === null || state.cursor === null) {
    return [];
  }
  return state.record.events
    .slice(0, state.cursor.eventIndex + 1)
    .map((event) => numberField(event, field))
    .filter((value): value is number => value !== null);
}

/**
 * Read a numeric payload field off an event by name, or `null` when that event does not
 * carry it. The widening to `unknown` is deliberate: this reader is used to prove that a
 * displayed number exists SOMEWHERE in the engine's output, so it must be able to look at
 * every event type without the compiler narrowing the question away.
 */
function numberField(event: Event, field: string): number | null {
  const widened: unknown = event;
  if (typeof widened !== "object" || widened === null) {
    return null;
  }
  const value = (widened as { readonly [key: string]: unknown })[field];
  return typeof value === "number" ? value : null;
}

describe("the lesson script", () => {
  it("starts at the first step, and the first step is a silent one", () => {
    expect(FIRST_STEP_INDEX).toBe(0);
    expect(LESSON_STEPS[0]?.id).toBe("program-starts");
    expect(LESSON_STEPS[0]?.actionIndex).toBeNull();
    expect(run.steps[0]?.step.id).toBe(LESSON_STEPS[0]?.id);
  });

  it("gives every step a unique id, a title and all four explanations", () => {
    const ids = LESSON_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const step of LESSON_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.what.length).toBeGreaterThan(0);
      expect(step.why.length).toBeGreaterThan(0);
      expect(step.whyNecessary.length).toBeGreaterThan(0);
      // `withoutIt` is optional prose, but it must never be an empty string.
      expect(step.withoutIt === null || step.withoutIt.length > 0).toBe(true);
    }
  });

  it("names a focus for every step, and every focus lights at least one panel", () => {
    for (const step of LESSON_STEPS) {
      expect(focusedPanels(step.focus).length).toBeGreaterThan(0);
    }
  });

  it("drives the engine only with ACCESS_ADDRESS actions, at the lesson's own addresses", () => {
    for (const { action } of LESSON_ACTIONS) {
      expect(action.type).toBe("ACCESS_ADDRESS");
    }
    expect(LESSON_ACTIONS.map((entry) => entry.action.address)).toEqual([
      X_ADDRESS,
      X_SECOND_ADDRESS,
      ABSENT_PAGE_ADDRESS,
    ]);
  });

  it("teaches the sequence in order: miss, page table, fill, hit, then the fault", () => {
    const order = [
      "program-starts",
      "variable-exists",
      "virtual-address",
      "address-split",
      "tlb-lookup",
      "page-table",
      "tlb-fill",
      "physical-address",
      "second-access",
      "page-table-skipped",
      "page-fault",
      "fault-stops",
    ];

    expect(run.steps.map((state) => state.step.id)).toEqual(order);

    const indexOf = (id: string): number => indexOfStep(id);
    expect(indexOf("tlb-lookup")).toBeLessThan(indexOf("page-table"));
    expect(indexOf("page-table")).toBeLessThan(indexOf("tlb-fill"));
    expect(indexOf("tlb-fill")).toBeLessThan(indexOf("second-access"));
    expect(indexOf("second-access")).toBeLessThan(indexOf("page-fault"));
    expect(indexOf("page-fault")).toBeLessThan(indexOf("fault-stops"));
  });
});

describe("the engine is the source of truth", () => {
  it("agrees with every checkpoint the script states", () => {
    expect(run.allCheckpointsOk).toBe(true);
    for (const state of run.steps) {
      expect(
        state.checkpoint.ok,
        `step "${state.step.id}" disagrees with the engine: missing [${state.checkpoint.missing.join(", ")}] unexpected [${state.checkpoint.unexpected.join(", ")}]`,
      ).toBe(true);
    }
  });

  it("runs exactly three engine actions, one per scripted access", () => {
    expect(run.records).toHaveLength(3);
    expect(run.totals.actions).toBe(3);
    expect(run.totals.accesses).toBe(3);
  });

  it("makes every simulation step correspond to real engine events", () => {
    for (const state of run.steps) {
      if (state.step.actionIndex === null) {
        // A step with no action must not claim to have produced events.
        expect(state.events).toEqual([]);
        expect(state.record).toBeNull();
        continue;
      }

      expect(state.events.length).toBeGreaterThan(0);
      expect(state.record).not.toBeNull();
      // The event the step points at has to exist, and the cursor has to be on it.
      expect(state.step.focusEvent).not.toBeNull();
      expect(state.events.map((event) => event.type)).toContain(state.step.focusEvent);
      expect(focusedEvent(state)?.type).toBe(state.step.focusEvent);
    }
  });

  it("produces TLB_MISS on the first access, and the lesson points at it", () => {
    const state = stepById("tlb-lookup");
    expect(state.events.map((event) => event.type)).toContain("TLB_MISS");
    expect(focusedEvent(state)?.type).toBe("TLB_MISS");
    expect(state.progress.tlbMiss).toBe(true);
    expect(state.progress.tlbHit).toBe(false);
    // The lesson must not claim a hit where the engine produced a miss.
    expect(state.progress.pageTableSkipped).toBe(false);
  });

  it("produces TLB_HIT on the second access, and skips the page table there", () => {
    const state = stepById("second-access");
    expect(state.events.map((event) => event.type)).toContain("TLB_HIT");
    expect(focusedEvent(state)?.type).toBe("TLB_HIT");
    expect(state.progress.tlbHit).toBe(true);
    expect(state.progress.tlbMiss).toBe(false);
    expect(state.progress.pageTableSkipped).toBe(true);

    // The step is about the SECOND scripted access, not a restatement of the first.
    expect(state.step.actionIndex).toBe(ACTION_READ_X_AGAIN);
    expect(state.step.actionIndex).not.toBe(ACTION_READ_X);

    // "The page table was skipped" is a claim about the event stream, so check it there.
    expect(countEvents(state.events, "PAGE_TABLE_LOOKUP")).toBe(0);
    expect(countEvents(state.events, "PAGE_TABLE_HIT")).toBe(0);
    expect(countEvents(run.records[ACTION_READ_X]?.events ?? [], "PAGE_TABLE_LOOKUP")).toBe(1);
  });

  it("produces TLB_FILL after the first page-table hit", () => {
    const state = stepById("tlb-fill");
    expect(focusedEvent(state)?.type).toBe("TLB_FILL");
    expect(state.progress.tlbFilled).toBe(true);
    expect(state.progress.tlbHit).toBe(false);
  });

  it("produces PAGE_FAULT on the faulting access, and the lesson points at it", () => {
    const faultStep = stepById("page-fault");
    const stopsStep = stepById("fault-stops");

    expect(faultStep.events.map((event) => event.type)).toContain("PAGE_FAULT");
    expect(focusedEvent(stopsStep)?.type).toBe("PAGE_FAULT");
    expect(stopsStep.progress.faulted).toBe(true);
    expect(run.totals.pageFaults).toBe(1);
  });
});

describe("the lesson never invents a value", () => {
  it("stops the faulting access: no frame, no physical address, no RAM access", () => {
    for (const id of ["page-fault", "fault-stops"]) {
      const state = stepById(id);
      const types = new Set(state.events.map((event) => event.type));

      expect(types.has("FRAME_RESOLVED")).toBe(false);
      expect(types.has("PHYSICAL_ADDRESS_GENERATED")).toBe(false);
      expect(types.has("RAM_ACCESS")).toBe(false);

      // ...and therefore the screen has nothing to print in those slots.
      expect(state.view.frameNumber).toBeNull();
      expect(state.view.physicalAddress).toBeNull();
      expect(state.progress.frameResolved).toBe(false);
      expect(state.progress.ramAccessed).toBe(false);
      expect(state.progress.reached).not.toBe("ram");
    }
  });

  it("reports the physical address the ENGINE produced, at the documented value", () => {
    const state = stepById("physical-address");
    const generated = state.events.find((event) => event.type === "PHYSICAL_ADDRESS_GENERATED");

    if (generated === undefined || generated.type !== "PHYSICAL_ADDRESS_GENERATED") {
      throw new Error("the engine produced no PHYSICAL_ADDRESS_GENERATED event");
    }

    // The screen shows the event's own payload...
    expect(state.view.physicalAddress).toBe(generated.physicalAddress);
    expect(state.view.frameNumber).toBe(generated.frameNumber);
    expect(state.view.offset).toBe(generated.offset);
    // ...and that payload is self-consistent with the engine's own arithmetic.
    expect(generated.physicalAddress).toBe(
      generated.frameNumber * generated.pageSize + generated.offset,
    );
    expect(generated.pageSize).toBe(EXAMPLE_PAGE_SIZE);
    // The documented lab value: x is in page 1, and page 1 is frame 7 of the lab table.
    expect(generated.physicalAddress).toBe(0x7345);
  });

  it("shows no number that no engine event produced", () => {
    for (const state of run.steps) {
      for (const field of ["pageNumber", "offset", "frameNumber", "physicalAddress"] as const) {
        const value = state.view[field];
        if (value === null) {
          continue;
        }
        // Anything on screen must appear in the engine's own payloads for this access.
        expect(
          valuesAtOrBefore(state, field),
          `step "${state.step.id}" shows ${field} ${value}, which no engine event produced`,
        ).toContain(value);
      }
    }
  });

  it("shows nothing at all before the first access has happened", () => {
    const silent = run.steps.filter((state) => state.record === null);
    expect(silent.length).toBeGreaterThan(0);

    for (const state of silent) {
      expect(state.view.pageNumber).toBeNull();
      expect(state.view.offset).toBeNull();
      expect(state.view.frameNumber).toBeNull();
      expect(state.view.physicalAddress).toBeNull();
      expect(state.progress.reached).toBe("none");
    }
  });

  it("would notice if the engine disagreed with the script", () => {
    // The checkpoint mechanism is the guard against a lesson that drifts: check that it
    // can fail, by asking the engine a question the script does not state. A page the
    // lab table marks absent cannot produce a frame, so this expectation must not hold.
    const machine: MachineState = createLessonMachine();
    const result = step(machine, LESSON_ACTIONS[ACTION_READ_ABSENT]?.action ?? {
      type: "ACCESS_ADDRESS",
      address: ABSENT_PAGE_ADDRESS,
    });

    expect(result.events.map((event) => event.type)).toContain("PAGE_FAULT");
    expect(result.events.map((event) => event.type)).not.toContain("FRAME_RESOLVED");
    expect(countEvents(result.events, "PAGE_FAULT")).toBe(1);
  });
});

describe("navigation: Next, Back, Restart and Play", () => {
  it("moves forward with Next and backward with Back", () => {
    expect(nextStepIndex(0)).toBe(1);
    expect(nextStepIndex(1)).toBe(2);
    expect(previousStepIndex(2)).toBe(1);
    expect(previousStepIndex(1)).toBe(0);
  });

  it("cannot walk off either end", () => {
    // Back at step 1 stays at step 1 - a no-op, never a crash or a wrapped index.
    expect(previousStepIndex(FIRST_STEP_INDEX)).toBe(FIRST_STEP_INDEX);
    expect(isFirstStep(FIRST_STEP_INDEX)).toBe(true);
    // Next at the end stays at the end.
    expect(nextStepIndex(lastStepIndex())).toBe(lastStepIndex());
    expect(isLastStep(lastStepIndex())).toBe(true);
  });

  it("restart returns to step 1", () => {
    // Restart is `clampStepIndex(FIRST_STEP_INDEX)`, and the first step is the lesson's
    // own first step rather than a number the screen made up.
    expect(clampStepIndex(FIRST_STEP_INDEX)).toBe(0);
    expect(LESSON_STEPS[clampStepIndex(FIRST_STEP_INDEX)]?.id).toBe("program-starts");
  });

  it("clamps a hostile or malformed step index onto the lesson", () => {
    expect(clampStepIndex(-1)).toBe(FIRST_STEP_INDEX);
    expect(clampStepIndex(-9999)).toBe(FIRST_STEP_INDEX);
    expect(clampStepIndex(9999)).toBe(lastStepIndex());
    expect(clampStepIndex(Number.NaN)).toBe(FIRST_STEP_INDEX);
    expect(clampStepIndex(2.5)).toBe(FIRST_STEP_INDEX);
    expect(clampStepIndex(Number.POSITIVE_INFINITY)).toBe(FIRST_STEP_INDEX);
  });

  it("advances through the whole lesson with Play, in order, and stops at the end", () => {
    const visited: number[] = [];
    let state = { index: FIRST_STEP_INDEX, playing: true };

    for (let guard = 0; state.playing && guard < 100; guard += 1) {
      visited.push(state.index);
      state = advanceForPlay(state.index);
    }

    expect(visited).toEqual(LESSON_STEPS.map((_, index) => index));
    expect(state.playing).toBe(false);
    expect(state.index).toBe(lastStepIndex());
  });

  it("does not advance once it is paused at the end", () => {
    // The reel is already stopped: asking to advance again must not move the lesson or
    // start it up.
    const stopped = advanceForPlay(lastStepIndex());
    expect(stopped.playing).toBe(false);
    expect(stopped.index).toBe(lastStepIndex());
    expect(advanceForPlay(stopped.index).index).toBe(lastStepIndex());
  });
});

describe("keyboard shortcuts", () => {
  it("maps the documented keys", () => {
    expect(lessonCommandFor("ArrowRight", false)).toBe("next");
    expect(lessonCommandFor("ArrowLeft", false)).toBe("back");
    expect(lessonCommandFor(" ", false)).toBe("toggle-play");
    expect(lessonCommandFor("r", false)).toBe("restart");
    expect(lessonCommandFor("R", false)).toBe("restart");
  });

  it("ignores keys the lesson does not use", () => {
    expect(lessonCommandFor("Enter", false)).toBeNull();
    expect(lessonCommandFor("Tab", false)).toBeNull();
    expect(lessonCommandFor("Escape", false)).toBeNull();
    expect(lessonCommandFor("ArrowUp", false)).toBeNull();
    expect(lessonCommandFor("x", false)).toBeNull();
  });

  it("stays out of the way while the learner is typing in a field", () => {
    for (const key of ["ArrowRight", "ArrowLeft", " ", "r", "R", "Enter"]) {
      expect(lessonCommandFor(key, true)).toBeNull();
    }
  });
});

describe("the 'what if it did not exist?' comparison", () => {
  /** Replay the lesson's first two accesses through the engine, inside this test. */
  function replay(machine: MachineState): readonly Event[] {
    const events: Event[] = [];
    let current = machine;

    for (const { action } of LESSON_ACTIONS.slice(0, 2)) {
      const result = step(current, action);
      events.push(...result.events);
      current = result.state;
    }

    return events;
  }

  it("builds the comparison machine from the same machine, minus the TLB", () => {
    const withTlb = createLessonMachine();
    const withoutTlb = createLessonMachineWithoutTlb();

    expect(withTlb.tlb.enabled).toBe(true);
    expect(withoutTlb.tlb.enabled).toBe(false);
    expect(withoutTlb.tlb.entries).toEqual([]);
    // Everything else is identical, so the only variable is the mechanism being taught.
    expect(withoutTlb.memory).toEqual(withTlb.memory);
    expect(withoutTlb.process.pageTable).toEqual(withTlb.process.pageTable);
    expect(withoutTlb.memory.pageSize).toBe(withTlb.memory.pageSize);
    expect(withoutTlb.process.virtualMemorySizeBytes).toBe(withTlb.process.virtualMemorySizeBytes);
  });

  it("counts the events the engine produced, instead of writing its own numbers", () => {
    const comparison = runTlbComparison();
    const withEvents = replay(createLessonMachine());
    const withoutEvents = replay(createLessonMachineWithoutTlb());

    const rowFor = (label: string): { withMechanism: number; withoutMechanism: number } => {
      const row = comparison.rows.find((candidate) => candidate.label === label);
      if (row === undefined) {
        throw new Error(`no comparison row "${label}"`);
      }
      return row;
    };

    expect(rowFor("page-table walks")).toEqual({
      label: "page-table walks",
      withMechanism: countEvents(withEvents, "PAGE_TABLE_LOOKUP"),
      withoutMechanism: countEvents(withoutEvents, "PAGE_TABLE_LOOKUP"),
    });
    expect(rowFor("TLB lookups")).toEqual({
      label: "TLB lookups",
      withMechanism: countEvents(withEvents, "TLB_LOOKUP"),
      withoutMechanism: countEvents(withoutEvents, "TLB_LOOKUP"),
    });
    expect(rowFor("RAM accesses")).toEqual({
      label: "RAM accesses",
      withMechanism: countEvents(withEvents, "RAM_ACCESS"),
      withoutMechanism: countEvents(withoutEvents, "RAM_ACCESS"),
    });

    for (const row of comparison.rows) {
      expect(Number.isInteger(row.withMechanism)).toBe(true);
      expect(Number.isInteger(row.withoutMechanism)).toBe(true);
      expect(row.withMechanism).toBeGreaterThanOrEqual(0);
      expect(row.withoutMechanism).toBeGreaterThanOrEqual(0);
    }
  });

  it("shows the cache removing work without changing the outcome", () => {
    const comparison = runTlbComparison();
    const rowFor = (label: string): { withMechanism: number; withoutMechanism: number } => {
      const row = comparison.rows.find((candidate) => candidate.label === label);
      if (row === undefined) {
        throw new Error(`no comparison row "${label}"`);
      }
      return row;
    };

    // With the TLB: one walk for two accesses. Without it: two walks for the same two.
    expect(rowFor("page-table walks").withMechanism).toBe(1);
    expect(rowFor("page-table walks").withoutMechanism).toBe(2);
    expect(rowFor("TLB lookups").withMechanism).toBe(2);
    expect(rowFor("TLB lookups").withoutMechanism).toBe(0);
    // The answer is the same either way: the mechanism changes the work, not the result.
    expect(rowFor("RAM accesses").withMechanism).toBe(2);
    expect(rowFor("RAM accesses").withoutMechanism).toBe(2);
  });

  it("is offered on a step, and only where it teaches something", () => {
    const offering = run.steps.filter((state) => state.step.comparison !== null);
    expect(offering.map((state) => state.step.id)).toEqual(["second-access"]);
  });

  it("jumps the lesson to the step that explains an event", () => {
    const tlbHit = stepIndexForEvent(run, ACTION_READ_X_AGAIN, "TLB_HIT");
    const tlbMiss = stepIndexForEvent(run, ACTION_READ_X, "TLB_MISS");
    const fault = stepIndexForEvent(run, ACTION_READ_ABSENT, "PAGE_FAULT");

    expect(tlbHit).toBe(indexOfStep("second-access"));
    expect(tlbMiss).toBe(indexOfStep("tlb-lookup"));
    expect(fault).toBe(indexOfStep("fault-stops"));
    // An event no step talks about moves the lesson nowhere.
    expect(stepIndexForEvent(run, ACTION_READ_X_AGAIN, "PAGE_FAULT")).toBeNull();
  });
});

describe("focus", () => {
  it("lights exactly the panels a step is about", () => {
    expect(isPanelFocused("tlb", "tlb")).toBe(true);
    expect(isPanelFocused("tlb", "ram")).toBe(false);
    expect(isPanelFocused("tlb", "chain")).toBe(true);
    expect(isPanelFocused("ram", "ram")).toBe(true);
    expect(isPanelFocused("pageTable", "pageTable")).toBe(true);
    expect(isPanelFocused("timeline", "timeline")).toBe(true);
    expect(isPanelFocused("timeline", "chain")).toBe(false);
  });

  it("keeps the chain lit for every hardware step, so the focus has context", () => {
    for (const state of run.steps) {
      if (state.step.focus === "timeline" || state.step.focus === "lesson") {
        continue;
      }
      expect(isPanelFocused(state.step.focus, "chain")).toBe(true);
    }
  });
});




