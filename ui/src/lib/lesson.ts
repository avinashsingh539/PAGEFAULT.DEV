/**
 * Learn Mode: a scripted lesson that runs the REAL engine, one action at a time.
 *
 * THE SEPARATION THIS FILE PROTECTS
 *
 *     lesson content   !=   simulation logic
 *
 * The script below says things like "explain the TLB miss here" and "ask the learner
 * whether a TLB miss means the page is missing". It never says what the hardware's
 * answer is. Every number the learner sees - the page number, the offset, the frame,
 * the physical address, whether the TLB hit, whether the page faulted - is read off
 * the events `step()` returned for the action the step asked for.
 *
 * A step MAY state a checkpoint ("at this point the engine emits TLB_MISS"), because a
 * lesson that quietly drifts away from the hardware is worse than one that fails. The
 * checkpoint is ENFORCED rather than trusted: `runLesson()` compares every step's
 * expectation against the real event stream and reports a disagreement (`checkpoint.ok
 * === false`) instead of showing the script's version of events. Tests assert that
 * every checkpoint holds, so the lesson cannot become fiction without a red test.
 *
 * The same rule covers what the lesson is allowed to claim about absence: the page-fault
 * steps carry a `forbids` checkpoint, so "no frame, no physical address, no RAM access"
 * is a statement about the events the engine actually produced, not a promise made in
 * prose.
 */

import {
  EXAMPLE_FRAME_COUNT,
  EXAMPLE_PAGE_SIZE,
  LAB_PAGE_TABLE,
  createLabMachine,
  createMachineState,
  step,
} from "../../../engine";
import type { AccessAddressAction, Event, EventType, MachineState } from "../../../engine";
import type { AccessRecord, PipelineStage, SessionCursor, SessionRecord, SessionView } from "./session";
import { viewForCursor } from "./session";

/**
 * The machine the lesson runs on: the lab machine, which has six resident pages, one
 * page that is in the table but not resident, and a four-slot TLB - enough to miss,
 * hit, fill and fault without a single mechanism being invented for the lesson.
 */
export const LEARN_PAGE_SIZE = EXAMPLE_PAGE_SIZE;
export const LEARN_FRAME_COUNT = EXAMPLE_FRAME_COUNT;
export const LEARN_TLB_CAPACITY = 4;

/**
 * Where the simulated `x` lives.
 *
 * This is lesson DATA (the scenario the learner is following), not an OS fact: the
 * address is simply what the lesson hands to the engine as `ACCESS_ADDRESS`. Page 1 is
 * resident in the lab page table, and the second address is a DIFFERENT offset inside
 * the SAME page, which is what makes the TLB hit visible at step 9.
 */
export const X_ADDRESS = 0x1345;
export const X_SECOND_ADDRESS = 0x1999;
/** Page 6 of the lab page table: present in the address space, not resident in RAM. */
export const ABSENT_PAGE_ADDRESS = 0x6064;

/** Build the lesson machine. The engine validates it; nothing here configures OS logic. */
export function createLessonMachine(): MachineState {
  return createLabMachine({ processName: "learn-lesson" });
}

/**
 * The SAME machine without a TLB, for the "what if it did not exist?" comparison.
 *
 * It is built from the same page table, page size and frame count as the lesson
 * machine, so the only difference between the two runs is the mechanism being taught.
 * That is asserted by a test rather than assumed.
 */
export function createLessonMachineWithoutTlb(): MachineState {
  return createMachineState({
    pageSize: LEARN_PAGE_SIZE,
    frameCount: LEARN_FRAME_COUNT,
    pid: 1,
    processName: "learn-lesson-no-tlb",
    pageTableEntries: LAB_PAGE_TABLE,
    // No `tlbCapacity`: a machine built without a TLB never emits TLB events at all.
  });
}

/** Which part of the interface a step is about. The rest is dimmed while it is shown. */
export type LearnFocus =
  | "cpu"
  | "virtual"
  | "split"
  | "tlb"
  | "pageTable"
  | "fill"
  | "frame"
  | "physical"
  | "ram"
  | "fault"
  | "chain"
  | "timeline"
  | "lesson";

/** A question the learner can answer before the lesson explains. */
export interface LearnQuestion {
  readonly prompt: string;
  readonly options: readonly string[];
  readonly answerIndex: number;
  readonly explanation: string;
}

/** One engine action the lesson performs, in order. */
export interface LessonAction {
  readonly label: string;
  /** An engine action, verbatim - the lesson never sends the engine anything else. */
  readonly action: AccessAddressAction;
}

/** The mechanism-removed comparisons the lesson can offer. */
export type LearnComparisonId = "TLB_OMITTED";

/** The proofs the lesson can show, computed from engine events rather than asserted. */
export type LearnEvidenceId = "PAGE_TABLE_SKIPPED";

/**
 * One step of the lesson.
 *
 * `actionIndex` names the engine action this step talks about, and `focusEvent` names
 * the exact engine event inside that action's event list. Both are LESSON choices: they
 * decide which truthful event the learner is looking at, never what the event says.
 */
export interface LessonStep {
  readonly id: string;
  readonly title: string;
  readonly what: string;
  readonly why: string;
  readonly whyNecessary: string;
  /** "What would happen if it did not exist?" - `null` where the question is meaningless. */
  readonly withoutIt: string | null;
  readonly actionIndex: number | null;
  readonly focusEvent: EventType | null;
  readonly focus: LearnFocus;
  readonly question: LearnQuestion | null;
  readonly comparison: LearnComparisonId | null;
  readonly evidence: LearnEvidenceId | null;
  /** Checkpoint: the engine MUST have produced every one of these by this step. */
  readonly expects: readonly EventType[];
  /** Checkpoint: the engine must NOT have produced any of these by this step. */
  readonly forbids: readonly EventType[];
}

/**
 * The engine actions the lesson performs, in order.
 *
 * Three memory accesses tell the whole story: the first touch of `x`, a second touch of
 * the same page (which the cached translation answers), and a touch of a page that is
 * in the address space but not in RAM.
 */
export const LESSON_ACTIONS: readonly LessonAction[] = [
  { label: "read x", action: { type: "ACCESS_ADDRESS", address: X_ADDRESS, access: "read" } },
  {
    label: "read x again (same page, different offset)",
    action: { type: "ACCESS_ADDRESS", address: X_SECOND_ADDRESS, access: "read" },
  },
  {
    label: "read a page that is not resident",
    action: { type: "ACCESS_ADDRESS", address: ABSENT_PAGE_ADDRESS, access: "read" },
  },
];

/** Named indexes into `LESSON_ACTIONS`, so the script reads like a story. */
export const ACTION_READ_X = 0;
/** The second read of the same page: the one the cached translation answers. */
export const ACTION_READ_X_AGAIN = 1;
/** The read of a page that is mapped but not resident: the one that faults. */
export const ACTION_READ_ABSENT = 2;

/**
 * The lesson, step by step.
 *
 * Every step answers four questions, in this order, because that is the order a learner
 * needs them: WHAT is happening, WHY it is happening, WHY the mechanism has to exist,
 * and (where it means something) WHAT WOULD HAPPEN IF IT DID NOT.
 *
 * Note what is NOT in the text: frame numbers, physical addresses, hit/miss verdicts.
 * Those are facts of the simulated hardware, so the screen prints them from engine
 * events and never narrates them here. Where a number is genuinely part of the SCENARIO
 * (the address `x` lives at) it is written as a hex address, and the engine is handed
 * exactly that address in `LESSON_ACTIONS`.
 */
export const LESSON_STEPS: readonly LessonStep[] = [
  {
    id: "program-starts",
    title: "The program starts",
    what: "A process is running. Instructions execute, and executing instructions means reading and writing memory.",
    why: "The CPU cannot compute with a value that lives nowhere. A process only exists because it can reach its own code and data.",
    whyNecessary:
      "Every value a program touches has an address, and every one of those addresses travels the same route through the memory subsystem. This lesson follows one such address from end to end.",
    withoutIt: null,
    actionIndex: null,
    focusEvent: null,
    focus: "cpu",
    question: null,
    comparison: null,
    evidence: null,
    expects: [],
    forbids: [],
  },
  {
    id: "variable-exists",
    title: "The variable exists",
    what: "The program declares x = 10 and needs somewhere to keep it while it works.",
    why: "The value has to exist in memory the running program can reach, or the program would have nothing to read back.",
    whyNecessary:
      "In this educational model we assume x is a stack variable: the compiler placed it in the process's own stack region. A real compiler is free to keep it in a register, or to place it anywhere it likes - we are choosing the stack-shaped example because it makes addressing visible. The simulation therefore assigns x an address, and that address is what the rest of this lesson follows.",
    withoutIt:
      "If the value had no home in memory, nothing could read it back after another function call ran - programs could not keep state.",
    actionIndex: null,
    focusEvent: null,
    focus: "virtual",
    question: null,
    comparison: null,
    evidence: null,
    expects: [],
    forbids: [],
  },
  {
    id: "virtual-address",
    title: "The CPU asks for an address",
    what: "The CPU issues a read of x. In this simulation x sits at the address 0x1345, and the engine is handed exactly that number as a memory access.",
    why: "Reading a value means naming where it is. There is no other handle on memory than an address.",
    whyNecessary:
      "The address the program generates is a VIRTUAL address: a number in this process's own address space. Each process can then be laid out as if it owned memory, without any process knowing where it really lives.",
    withoutIt:
      "Without virtual addressing every program would have to agree on where everything is, and one process could name - and corrupt - another process's memory just by using an address.",
    actionIndex: ACTION_READ_X,
    focusEvent: "CPU_MEMORY_ACCESS",
    focus: "virtual",
    question: {
      prompt: "Is 0x1345 the actual physical RAM address?",
      options: [
        "Yes - RAM is addressed with numbers like this one.",
        "No - it is a virtual address the program generated.",
        "Only if the page holding it happens to be resident.",
      ],
      answerIndex: 1,
      explanation:
        "No. It is a virtual address: a number in this process's own address space. The CPU cannot hand it to RAM until it has been translated, which is what the next steps follow. The physical address is a different number, and it is printed for you a few steps further on.",
    },
    comparison: null,
    evidence: null,
    expects: ["CPU_MEMORY_ACCESS", "VIRTUAL_ADDRESS_GENERATED"],
    forbids: [],
  },
  {
    id: "address-split",
    title: "The address is split into page number and offset",
    what: "The MMU divides the virtual address into a PAGE NUMBER (which page) and an OFFSET (which byte inside that page). Both numbers below arrive in the engine's own ADDRESS_SPLIT event.",
    why: "Translation happens at page granularity, so the address has to be cut at the page boundary before anything can be looked up.",
    whyNecessary:
      "The offset is what keeps the translation exact. Only the page number gets translated; the offset travels through untouched, so the byte the program meant is the byte that gets read - not the start of the page.",
    withoutIt:
      "Without a split, a translation could only ever name a page, and the CPU would have no way to say which byte inside it the program meant.",
    actionIndex: ACTION_READ_X,
    focusEvent: "ADDRESS_SPLIT",
    focus: "split",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["ADDRESS_SPLIT"],
    forbids: [],
  },
  {
    id: "tlb-lookup",
    title: "The TLB is consulted - and misses",
    what: "Before walking the page table, the MMU checks its TLB: a small cache of recent page-to-frame translations. This access misses, because the cache starts empty and nothing has been cached yet.",
    why: "The page table itself lives in memory, so consulting it is another lookup on top of the one the program asked for.",
    whyNecessary:
      "Programs repeat themselves: a loop touches the same few pages again and again. A cache of translations turns those repeats into lookups that never touch the page table at all.",
    withoutIt:
      "Every single access would walk the page table. Step 9 runs that comparison for you, on this machine's own numbers.",
    actionIndex: ACTION_READ_X,
    focusEvent: "TLB_MISS",
    focus: "tlb",
    question: {
      prompt: "Does a TLB miss mean the page is missing from RAM?",
      options: [
        "Yes - a miss means the page is not resident.",
        "No - the TLB caches translations, so a miss only means 'not cached yet'.",
        "Yes - the next thing that happens is a page fault.",
      ],
      answerIndex: 1,
      explanation:
        "A miss says nothing about residency. The TLB holds copies of page-table translations, so a miss means the MMU has to ask the page table - which is exactly what happens next. A page fault needs the page table ITSELF to report the page as not present, and that is a different event (step 11).",
    },
    comparison: null,
    evidence: null,
    expects: ["TLB_LOOKUP", "TLB_MISS"],
    forbids: [],
  },
  {
    id: "page-table",
    title: "The page table has the answer",
    what: "The MMU walks the process's page table, which maps page number to frame number. It finds this page, so the page really is in RAM. The frame number below arrives in the engine's own PAGE_TABLE_HIT event.",
    why: "The page table is the authoritative record of where each page currently lives. It is what the operating system maintains.",
    whyNecessary:
      "The TLB is only a cache OF this table. Because the table is the record of truth, a TLB miss can only ever cost time - it can never change the outcome of an access.",
    withoutIt:
      "With no page table there would be no record of where a page lives, and the TLB would have nothing to be a cache of.",
    actionIndex: ACTION_READ_X,
    focusEvent: "PAGE_TABLE_HIT",
    focus: "pageTable",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["PAGE_TABLE_LOOKUP", "PAGE_TABLE_HIT"],
    forbids: ["PAGE_FAULT"],
  },
  {
    id: "tlb-fill",
    title: "The translation is cached",
    what: "Because the page table answered, the MMU records page-to-frame in a TLB slot. The slot and the occupancy shown below are the engine's own TLB_FILL payload.",
    why: "The page-table walk has just been paid for. Caching its answer means the next access to this page does not have to pay for it again.",
    whyNecessary:
      "This is the only reason the TLB earns its place: it is filled from real answers, and only after one has been found. It never guesses a translation.",
    withoutIt: "Every later access to this page would walk the page table again, exactly as the first one did.",
    actionIndex: ACTION_READ_X,
    focusEvent: "TLB_FILL",
    focus: "fill",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["TLB_FILL"],
    forbids: [],
  },
  {
    id: "physical-address",
    title: "Frame plus offset become a physical address",
    what: "The MMU combines the frame number with the offset it preserved, producing the physical address - the number RAM is actually addressed by. It arrives in the engine's PHYSICAL_ADDRESS_GENERATED event.",
    why: "Physical memory is organised as frames, exactly as virtual memory is organised as pages, so a physical address has to name a frame plus a position inside it.",
    whyNecessary:
      "This is where translation ends: the CPU now holds an address it can hand to RAM for the byte the program originally asked for.",
    withoutIt:
      "Without translation the CPU would have to give RAM the program's own address-space numbers, which cannot mean anything to physical memory.",
    actionIndex: ACTION_READ_X,
    focusEvent: "PHYSICAL_ADDRESS_GENERATED",
    focus: "physical",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["FRAME_RESOLVED", "PHYSICAL_ADDRESS_GENERATED", "RAM_ACCESS"],
    forbids: [],
  },
  {
    id: "second-access",
    title: "The same page again - this time it hits",
    what: "The program reads x again, at a different offset inside the same page. The TLB still holds that page's translation and answers immediately, so the page table is never visited.",
    why: "Because the translation was cached one step earlier, and nothing has invalidated it since.",
    whyNecessary:
      "Real programs touch the same pages constantly - a loop mostly re-reads what it just read. A translation cache is the difference between one memory walk per access and two.",
    withoutIt:
      "Run the comparison below. With the cache removed, this second access walks the page table exactly like the first one did.",
    actionIndex: ACTION_READ_X_AGAIN,
    focusEvent: "TLB_HIT",
    focus: "tlb",
    question: {
      prompt: "Which stage did this access skip?",
      options: [
        "The TLB - it was not consulted at all.",
        "The page table - the cached translation answered instead.",
        "RAM - the value came from the cache.",
      ],
      answerIndex: 1,
      explanation:
        "The TLB was consulted and answered, so the page table was never walked. RAM was still touched: a translation cache caches ADDRESSES, not data. If you want the value of x in a cache, that is a data cache - a different mechanism, and not one this engine has.",
    },
    comparison: "TLB_OMITTED",
    evidence: null,
    expects: ["TLB_LOOKUP", "TLB_HIT", "FRAME_RESOLVED", "PHYSICAL_ADDRESS_GENERATED"],
    forbids: ["PAGE_TABLE_LOOKUP", "TLB_MISS", "PAGE_FAULT"],
  },
  {
    id: "page-table-skipped",
    title: "Proof: the page table really was skipped",
    what: "The two accesses reached the same kind of answer by different routes. Counted from the engine's event stream: the first access walked the page table, the second did not.",
    why: "Because the second access's page number was already in the TLB, so there was nothing to look up.",
    whyNecessary:
      "This is the entire economic argument for a TLB. The lesson claims the page table was skipped, so the lesson should show you the evidence rather than ask you to take its word - the event log below is that evidence.",
    withoutIt:
      "Without a TLB the second access would look like the first: a lookup, a walk of the page table, and a fresh copy of a translation. See the comparison at the previous step.",
    actionIndex: ACTION_READ_X_AGAIN,
    focusEvent: "RAM_ACCESS",
    focus: "timeline",
    question: null,
    comparison: null,
    evidence: "PAGE_TABLE_SKIPPED",
    expects: ["RAM_ACCESS"],
    forbids: ["PAGE_TABLE_LOOKUP", "TLB_MISS"],
  },
  {
    id: "page-fault",
    title: "A page that is not there",
    what: "The program asks for a different page - one that exists in its address space but is not resident in RAM. The TLB has no translation for it, so the MMU walks the page table, and the page table reports it as not present.",
    why: "RAM is finite. A page can legitimately be part of a process's address space while no frame currently holds it.",
    whyNecessary:
      "The CPU cannot invent the contents of a page it does not have. The access cannot complete correctly, so it has to be reported instead of guessed at.",
    withoutIt:
      "Hardware that ignored a missing page would read whatever those bytes happen to contain - silent memory corruption instead of a fault the OS can do something about.",
    actionIndex: ACTION_READ_ABSENT,
    focusEvent: "PAGE_TABLE_LOOKUP",
    focus: "pageTable",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["TLB_MISS", "PAGE_TABLE_LOOKUP", "PAGE_FAULT"],
    forbids: ["FRAME_RESOLVED", "PHYSICAL_ADDRESS_GENERATED", "RAM_ACCESS"],
  },
  {
    id: "fault-stops",
    title: "Translation stops here",
    what: "The engine raises a page fault and the access ends. Nothing downstream happens: the page is never resolved to a frame, no physical address is produced, and RAM is never touched. The event list below is the engine's own record of that access - you can check it yourself.",
    why: "There is no frame to name, so there is no physical address to build and nothing for RAM to read.",
    whyNecessary:
      "A fault is a control transfer out of the running program, not a memory access. Handling it means the operating system takes over: kernel mode, moving the page in from storage, updating the page table, and retrying the instruction. Those mechanisms are a later phase of this project and are NOT implemented in this engine - so this lesson ends at the detection, and says so rather than pretending the page appeared.",
    withoutIt: null,
    actionIndex: ACTION_READ_ABSENT,
    focusEvent: "PAGE_FAULT",
    focus: "fault",
    question: null,
    comparison: null,
    evidence: null,
    expects: ["PAGE_FAULT"],
    forbids: ["FRAME_RESOLVED", "PHYSICAL_ADDRESS_GENERATED", "RAM_ACCESS"],
  },
];

/* ------------------------------------------------------------------ *
 * Running the lesson: engine first, script second.
 * ------------------------------------------------------------------ */

/**
 * The result of checking one step's expectation against the engine's real events.
 *
 * A lesson that drifts away from the hardware must not be able to hide it, so this is
 * reported to the screen (and asserted by the tests) instead of being swallowed.
 */
export interface LearnCheckpoint {
  readonly ok: boolean;
  readonly expected: readonly EventType[];
  /** Expected event types the engine did NOT produce. */
  readonly missing: readonly EventType[];
  /** Forbidden event types the engine DID produce. */
  readonly unexpected: readonly EventType[];
}

/**
 * How far the access under the cursor has travelled SO FAR.
 *
 * This is a projection of the events at or before the cursor - the same kind of
 * presentation logic `stageStatuses()` does - so a step can show "the TLB has been
 * consulted" without also spoiling the verdict that has not happened yet.
 */
export interface LearnProgress {
  readonly tlbLookedUp: boolean;
  readonly tlbHit: boolean;
  readonly tlbMiss: boolean;
  readonly pageTableWalked: boolean;
  readonly pageTableHit: boolean;
  readonly tlbFilled: boolean;
  readonly frameResolved: boolean;
  readonly physicalAddressGenerated: boolean;
  readonly ramAccessed: boolean;
  readonly faulted: boolean;
  /** The furthest station reached so far: the answer to "how far has this got?". */
  readonly reached: "none" | "translation" | "tlb" | "pageTable" | "frame" | "ram" | "fault";
  /** True when this access skipped the page table, read off the whole record's events. */
  readonly pageTableSkipped: boolean;
}

/** Numbers that PROVE a step's claim, counted from engine events rather than stated. */
export interface LearnEvidence {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: number }[];
  readonly note: string;
}

/** Totals for the whole lesson, folded from every event the engine produced. */
export interface LearnTotals {
  readonly actions: number;
  readonly events: number;
  readonly accesses: number;
  readonly tlbHits: number;
  readonly tlbMisses: number;
  readonly pageTableWalks: number;
  readonly pageFaults: number;
  readonly ramAccesses: number;
}

/** Everything the screen needs for one step, all of it grounded in engine output. */
export interface LearnStepState {
  readonly index: number;
  readonly step: LessonStep;
  /** Records applied by the time this step is reached. */
  readonly records: readonly SessionRecord[];
  /** The action's record, or `null` for a step that performs no action. */
  readonly record: SessionRecord | null;
  readonly cursor: SessionCursor | null;
  readonly view: SessionView;
  /** The machine as it stood immediately after this step's action. */
  readonly machine: MachineState;
  /** The engine's own events for this step's action. Empty for a silent step. */
  readonly events: readonly Event[];
  readonly checkpoint: LearnCheckpoint;
  readonly progress: LearnProgress;
  readonly evidence: LearnEvidence | null;
}

export interface LearnRun {
  readonly records: readonly SessionRecord[];
  readonly steps: readonly LearnStepState[];
  /** State after every lesson action has run - used for the machine-wide panels. */
  readonly finalMachine: MachineState;
  readonly initialMachine: MachineState;
  readonly totals: LearnTotals;
  /** True when no step disagrees with the engine. The tests require this. */
  readonly allCheckpointsOk: boolean;
}

/** Count how many events of one type the engine produced. */
export function countEvents(events: readonly Event[], type: EventType): number {
  return events.filter((event) => event.type === type).length;
}

/** The cursor position at the last event of the newest record, or `null` when empty. */
export function cursorAtEndOf(records: readonly SessionRecord[]): SessionCursor | null {
  const recordIndex = records.length - 1;
  const record = records[recordIndex];
  if (record === undefined || record.events.length === 0) {
    return record === undefined ? null : { recordIndex, eventIndex: 0 };
  }
  return { recordIndex, eventIndex: record.events.length - 1 };
}

/**
 * Run every lesson action through the engine, in order, and keep each transition.
 *
 * `step()` is pure, so replaying the script from a fresh machine always produces the
 * same events: going Back and Restarting are not "undo", they are the same lesson
 * played again from the beginning - which is exactly why they can be trusted.
 */
function runLessonActions(): { readonly records: readonly AccessRecord[]; readonly machine: MachineState } {
  const initial = createLessonMachine();
  let machine = initial;
  const records: AccessRecord[] = [];

  for (const { action } of LESSON_ACTIONS) {
    const result = step(machine, action);
    records.push({
      kind: "access",
      stateBefore: machine,
      address: action.address,
      accessKind: action.access ?? "read",
      events: result.events,
      stateAfter: result.state,
    });
    machine = result.state;
  }

  return { records, machine };
}

/** The empty progress, for a step with no access behind it yet. */
const NOTHING_REACHED: LearnProgress = {
  tlbLookedUp: false,
  tlbHit: false,
  tlbMiss: false,
  pageTableWalked: false,
  pageTableHit: false,
  tlbFilled: false,
  frameResolved: false,
  physicalAddressGenerated: false,
  ramAccessed: false,
  faulted: false,
  reached: "none",
  pageTableSkipped: false,
};

/** Compare a step's expectation against the engine's real event stream. */
function checkpointFor(step: LessonStep, events: readonly Event[]): LearnCheckpoint {
  const produced = new Set(events.map((event) => event.type));
  const missing = step.expects.filter((type) => !produced.has(type));
  const unexpected = step.forbids.filter((type) => produced.has(type));

  return {
    ok: missing.length === 0 && unexpected.length === 0,
    expected: [...step.expects],
    missing,
    unexpected,
  };
}

/**
 * Project the events at or before the cursor into "how far has this access got?".
 *
 * Presentation only: every flag is the presence of a real engine event, so a panel built
 * from this can never claim a stage the hardware has not reached yet.
 */
function progressAt(record: SessionRecord | null, cursor: SessionCursor | null): LearnProgress {
  if (record === null || cursor === null) {
    return NOTHING_REACHED;
  }

  const seen = record.events.slice(0, cursor.eventIndex + 1);
  const has = (type: EventType): boolean => seen.some((event) => event.type === type);

  const faulted = has("PAGE_FAULT");
  const ramAccessed = has("RAM_ACCESS");
  const frameResolved = has("FRAME_RESOLVED");
  const physicalAddressGenerated = has("PHYSICAL_ADDRESS_GENERATED");
  const pageTableHit = has("PAGE_TABLE_HIT");
  const pageTableWalked = has("PAGE_TABLE_LOOKUP");
  const tlbHit = has("TLB_HIT");
  const tlbMiss = has("TLB_MISS");
  const tlbLookedUp = tlbHit || tlbMiss;

  const reached: LearnProgress["reached"] = faulted
    ? "fault"
    : ramAccessed
      ? "ram"
      : frameResolved || physicalAddressGenerated
        ? "frame"
        : pageTableHit || pageTableWalked
          ? "pageTable"
          : tlbLookedUp
            ? "tlb"
            : seen.length > 0
              ? "translation"
              : "none";

  return {
    tlbLookedUp,
    tlbHit,
    tlbMiss,
    pageTableWalked,
    pageTableHit,
    tlbFilled: has("TLB_FILL"),
    frameResolved,
    physicalAddressGenerated,
    ramAccessed,
    faulted,
    reached,
    // A cache hit is the reason the walk never happened - read off the whole record.
    pageTableSkipped: record.events.some((event) => event.type === "TLB_HIT"),
  };
}

/**
 * Count the engine events that prove a step's claim.
 *
 * The point of this function is that it never writes a number: it counts the events the
 * engine produced. If a future engine change made the second access walk the page table
 * too, the lesson would display that - and the step's checkpoint would fail loudly.
 */
function evidenceFor(step: LessonStep, records: readonly SessionRecord[]): LearnEvidence | null {
  if (step.evidence !== "PAGE_TABLE_SKIPPED") {
    return null;
  }

  const firstEvents = records[ACTION_READ_X]?.events ?? [];
  const secondEvents = records[ACTION_READ_X_AGAIN]?.events ?? [];

  const walksBefore = countEvents(firstEvents, "PAGE_TABLE_LOOKUP");
  const walksAfter = countEvents(secondEvents, "PAGE_TABLE_LOOKUP");
  const cachedLookups = countEvents(secondEvents, "TLB_LOOKUP");
  const secondReachedRam = countEvents(secondEvents, "RAM_ACCESS");

  return {
    title: "Counted from the engine's event stream",
    rows: [
      { label: "page-table walks in the first access", value: walksBefore },
      { label: "page-table walks in the second access", value: walksAfter },
      { label: "TLB lookups in the second access", value: cachedLookups },
      { label: "RAM accesses in the second access", value: secondReachedRam },
    ],
    note:
      `The first access walked the page table ${walksBefore} time(s). The second walked it ` +
      `${walksAfter} time(s), because the translation was already cached, and still reached ` +
      `RAM ${secondReachedRam} time(s) - the cache changed the work, not the answer.`,
  };
}

/** Which event the cursor should sit on for a step. */
function cursorForStep(
  applied: readonly SessionRecord[],
  record: SessionRecord | null,
  step: LessonStep,
): SessionCursor | null {
  if (applied.length === 0 || record === null || step.focusEvent === null) {
    return cursorAtEndOf(applied);
  }

  const eventIndex = record.events.findIndex((event) => event.type === step.focusEvent);
  if (eventIndex === -1) {
    // The engine did not produce the event this step explains. The checkpoint reports
    // that; showing the end of the action is the honest fallback.
    return cursorAtEndOf(applied);
  }

  return { recordIndex: applied.length - 1, eventIndex };
}

/**
 * Play the whole lesson through the engine and describe every step.
 *
 * Called once when the lesson is built, and by the tests, which assert that every step's
 * checkpoint holds. Advancing a step re-reads the returned value; it never re-runs the
 * engine, so stepping Back and Forward cannot produce two different stories.
 */
export function runLesson(): LearnRun {
  const initialMachine = createLessonMachine();
  const played = runLessonActions();

  let appliedCount = 0;
  const steps: LearnStepState[] = LESSON_STEPS.map((step, index) => {
    if (step.actionIndex !== null) {
      appliedCount = Math.max(appliedCount, step.actionIndex + 1);
    }

    const applied = played.records.slice(0, appliedCount);
    const record = step.actionIndex === null ? null : (applied[applied.length - 1] ?? null);
    const cursor = cursorForStep(applied, record, step);
    const stepMachine = record === null ? initialMachine : record.stateAfter;
    const events = record === null ? [] : record.events;

    return {
      index,
      step,
      records: applied,
      record,
      cursor,
      view: viewForCursor(applied, cursor),
      machine: stepMachine,
      events,
      checkpoint: checkpointFor(step, events),
      progress: progressAt(record, cursor),
      evidence: evidenceFor(step, played.records),
    };
  });

  const allEvents = played.records.flatMap((record) => record.events);

  return {
    records: played.records,
    steps,
    finalMachine: played.machine,
    initialMachine,
    totals: {
      actions: played.records.length,
      events: allEvents.length,
      accesses: played.records.length,
      tlbHits: countEvents(allEvents, "TLB_HIT"),
      tlbMisses: countEvents(allEvents, "TLB_MISS"),
      pageTableWalks: countEvents(allEvents, "PAGE_TABLE_LOOKUP"),
      pageFaults: countEvents(allEvents, "PAGE_FAULT"),
      ramAccesses: countEvents(allEvents, "RAM_ACCESS"),
    },
    allCheckpointsOk: steps.every((state) => state.checkpoint.ok),
  };
}

/* ------------------------------------------------------------------ *
 * "What if it did not exist?" - the mechanism-removed comparison.
 * ------------------------------------------------------------------ */

/** One row of the comparison: the same quantity, with and without the mechanism. */
export interface ComparisonRow {
  readonly label: string;
  readonly withMechanism: number;
  readonly withoutMechanism: number;
}

export interface LearnComparison {
  readonly id: LearnComparisonId;
  readonly title: string;
  readonly question: string;
  readonly withLabel: string;
  readonly withoutLabel: string;
  readonly rows: readonly ComparisonRow[];
  readonly conclusion: string;
}

/** Replay a prefix of the lesson's actions and return every event they produced. */
function replayEvents(actions: readonly LessonAction[], machine: MachineState): readonly Event[] {
  const events: Event[] = [];
  let current = machine;

  for (const { action } of actions) {
    const result = step(current, action);
    events.push(...result.events);
    current = result.state;
  }

  return events;
}

/**
 * Run the lesson's two SUCCESSFUL accesses on two machines that differ only in whether
 * they have a TLB, and report what the engine did in each case.
 *
 * This is not an alternate architecture and it is not simulated in the UI: both runs are
 * real engine runs, one on a machine built with `tlbCapacity` and one on a machine built
 * without it. Every number below is a count of the events those runs produced.
 */
export function runTlbComparison(): LearnComparison {
  const actions = LESSON_ACTIONS.slice(0, 2);

  const withTlb = replayEvents(actions, createLessonMachine());
  const withoutTlb = replayEvents(actions, createLessonMachineWithoutTlb());

  const walksWith = countEvents(withTlb, "PAGE_TABLE_LOOKUP");
  const walksWithout = countEvents(withoutTlb, "PAGE_TABLE_LOOKUP");

  return {
    id: "TLB_OMITTED",
    title: "What if the TLB did not exist?",
    question: "The same two accesses, on the same machine, with the translation cache removed.",
    withLabel: "With the TLB",
    withoutLabel: "Without the TLB",
    rows: [
      { label: "page-table walks", withMechanism: walksWith, withoutMechanism: walksWithout },
      {
        label: "TLB lookups",
        withMechanism: countEvents(withTlb, "TLB_LOOKUP"),
        withoutMechanism: countEvents(withoutTlb, "TLB_LOOKUP"),
      },
      {
        label: "RAM accesses",
        withMechanism: countEvents(withTlb, "RAM_ACCESS"),
        withoutMechanism: countEvents(withoutTlb, "RAM_ACCESS"),
      },
      {
        label: "events in total",
        withMechanism: withTlb.length,
        withoutMechanism: withoutTlb.length,
      },
    ],
    conclusion:
      `Both machines reached RAM the same number of times, so the answer never changed. ` +
      `What changed is the work: the page table was walked ${walksWith} time(s) with the ` +
      `cache and ${walksWithout} time(s) without it, for the very same two accesses.`,
  };
}

/** Every comparison the lesson can offer, each one produced by a real engine run. */
export function comparisonFor(id: LearnComparisonId): LearnComparison {
  // One comparison today; the id is kept so a second cannot be added half-wired.
  void id;
  return runTlbComparison();
}

/* ------------------------------------------------------------------ *
 * Navigation: pure functions, so Play / Pause / Back are testable in Node.
 * ------------------------------------------------------------------ */

export const FIRST_STEP_INDEX = 0;

/** The index of the last step - where Play stops. */
export function lastStepIndex(): number {
  return Math.max(LESSON_STEPS.length - 1, 0);
}

/**
 * The description of one step of a played lesson.
 *
 * The lesson is a compile-time constant with at least one step, so this cannot fail for
 * any index; it clamps rather than indexing, which is why callers get a step rather than
 * a `maybe`.
 */
export function lessonStepAt(run: LearnRun, index: number): LearnStepState {
  const state = run.steps[clampStepIndex(index)] ?? run.steps[FIRST_STEP_INDEX];
  if (state === undefined) {
    throw new Error("the lesson has no steps");
  }
  return state;
}

/** Clamp any number (a URL parameter, a typed value) onto the lesson. */
export function clampStepIndex(index: number): number {
  if (!Number.isSafeInteger(index)) {
    return FIRST_STEP_INDEX;
  }
  return Math.min(Math.max(index, FIRST_STEP_INDEX), lastStepIndex());
}

export function nextStepIndex(index: number): number {
  return clampStepIndex(index + 1);
}

export function previousStepIndex(index: number): number {
  return clampStepIndex(index - 1);
}

export function isFirstStep(index: number): boolean {
  return clampStepIndex(index) === FIRST_STEP_INDEX;
}

export function isLastStep(index: number): boolean {
  return clampStepIndex(index) === lastStepIndex();
}

/**
 * Advance one step for PLAY, and say whether the reel should keep rolling.
 *
 * Play stops at the last step instead of wrapping around: a lesson that silently starts
 * again while the learner is still reading is worse than one that stops.
 */
export function advanceForPlay(index: number): {
  readonly index: number;
  readonly playing: boolean;
} {
  if (isLastStep(index)) {
    return { index: clampStepIndex(index), playing: false };
  }
  return { index: nextStepIndex(index), playing: true };
}

/* ------------------------------------------------------------------ *
 * Keyboard: a pure mapping, so the shortcut rules are unit-testable.
 * ------------------------------------------------------------------ */

/** What a key press asks the lesson to do. */
export type LessonCommand = "next" | "back" | "toggle-play" | "restart";

/**
 * Translate a key into a lesson command.
 *
 * `inTextField` is the guard the CALLER computes from the event target: while the learner
 * is typing, the lesson must not steal the arrow keys, the space bar or the letter R. The
 * mapping stays pure so the rule can be tested without a browser.
 */
export function lessonCommandFor(key: string, inTextField: boolean): LessonCommand | null {
  if (inTextField) {
    return null;
  }

  switch (key) {
    case "ArrowRight":
      return "next";
    case "ArrowLeft":
      return "back";
    case " ":
    case "Spacebar":
      return "toggle-play";
    case "r":
    case "R":
      return "restart";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Focus: which part of the screen is THE subject of a step.
 * ------------------------------------------------------------------ */

/** The parts of the Learn screen that can be lit (everything else is dimmed). */
export type LearnPanelKey = "chain" | "tlb" | "pageTable" | "ram" | "timeline" | "lesson";

/**
 * Which panels a focus keeps lit.
 *
 * The chain (the CPU-to-RAM diagram) stays lit for every hardware focus, because a step
 * is always about ONE stop on that chain and the rest of the chain is what gives it
 * context. The state panels are lit only when the step is actually about them - that is
 * the dimming rule, expressed as data instead of as scattered class names.
 */
export const FOCUS_PANELS: Record<LearnFocus, readonly LearnPanelKey[]> = {
  cpu: ["chain"],
  virtual: ["chain"],
  split: ["chain"],
  tlb: ["chain", "tlb"],
  pageTable: ["chain", "pageTable"],
  fill: ["chain", "tlb"],
  frame: ["chain"],
  physical: ["chain"],
  ram: ["chain", "ram"],
  fault: ["chain", "pageTable"],
  chain: ["chain"],
  timeline: ["timeline"],
  lesson: ["lesson"],
};

/** The panels to keep lit for a focus. Never empty, so some panel is always the subject. */
export function focusedPanels(focus: LearnFocus): readonly LearnPanelKey[] {
  return FOCUS_PANELS[focus];
}

export function isPanelFocused(focus: LearnFocus, panel: LearnPanelKey): boolean {
  return FOCUS_PANELS[focus].includes(panel);
}

/**
 * The pipeline row a focus points at, or `null` when the step is not about one row.
 *
 * The pipeline draws its own vocabulary (`PipelineStage`), so a focus that names the
 * event log or the lesson itself has no row to highlight.
 */
export const FOCUS_STAGES: Record<LearnFocus, PipelineStage | null> = {
  cpu: "cpu",
  virtual: "virtual",
  split: "split",
  tlb: "tlb",
  pageTable: "pageTable",
  fill: "fill",
  frame: "frame",
  physical: "physical",
  ram: "ram",
  fault: "fault",
  chain: null,
  timeline: null,
  lesson: null,
};

export function focusedStage(focus: LearnFocus): PipelineStage | null {
  return FOCUS_STAGES[focus];
}

/**
 * The step that explains a given engine event, or `null` when no step does.
 *
 * This is how clicking a row of the event log moves the lesson. It maps an event to the
 * step that talks about it; it does not tell the step what to say - the step still reads
 * its numbers out of that same event.
 */
export function stepIndexForEvent(
  run: LearnRun,
  recordIndex: number,
  type: EventType,
): number | null {
  const index = run.steps.findIndex(
    (state) => state.step.actionIndex === recordIndex && state.step.focusEvent === type,
  );
  return index === -1 ? null : index;
}







