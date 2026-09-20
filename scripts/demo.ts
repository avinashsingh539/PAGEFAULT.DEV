/**
 * Developer CLI for the simulation engine.
 *
 * This is NOT the product UI - it is the smallest possible way to watch the engine
 * work, and it exists so engine behaviour can be inspected (and demonstrated)
 * without a browser, a bundler or a single React import.
 *
 *   npm run demo
 *
 * The script only reads the public engine API: state in, events out, printed.
 */

import {
  BELADY_REFERENCE_STRING,
  CLASSIC_REFERENCE_STRING,
  EngineError,
  EXAMPLE_PAGE_SIZE,
  LAB_PAGE_TABLE,
  LAB_TLB_CAPACITY,
  REPLACEMENT_ALGORITHMS,
  TEXTBOOK_FRAME_COUNT,
  TLB_EVICTION_POLICY,
  createExampleMachine,
  createLabMachine,
  pageTableEntries,
  runReferenceString,
  step,
  tlbEntries,
} from "../engine";
import type {
  Event,
  MachineState,
  PageTableEntry,
  ReferenceStringRun,
  ReplacementAlgorithm,
  ReplacementEvent,
  ReplacementEvidence,
} from "../engine";

/** Addresses chosen to exercise hits, faults and page boundaries. */
const DEMO_ADDRESSES: readonly number[] = [
  0x0100, // page 0 -> frame 3
  0x1000, // page 1 -> frame 7
  0x1fff, // last byte of page 1
  0x2121, // page 2 -> frame 1
  0x3000, // page 3 -> NOT PRESENT (page fault)
  0x12345, // page 18 -> no page-table entry at all (page fault)
];

const RULE = "-".repeat(46);

function main(): void {
  const output: string[] = [];

  output.push("PAGEFAULT.DEV - engine demo (developer tool, not the UI)");
  output.push("=".repeat(58));
  output.push("");

  let machine: MachineState = createExampleMachine();
  output.push(...describeMachine(machine));

  for (const address of DEMO_ADDRESSES) {
    const result = step(machine, { type: "ACCESS_ADDRESS", address });
    machine = result.state;

    output.push("");
    output.push(`> ACCESS_ADDRESS(${hex(address)} = ${address})`);
    output.push(RULE);
    for (const event of result.events) {
      output.push(...formatEvent(event));
    }
    output.push(`  ==> ${verdict(result.events)}`);
  }

  output.push("");
  output.push(...describeSummary(machine));

  output.push("");
  output.push(...describeTlb());

  output.push("");
  output.push(...describeReplacement());

  output.push("");
  output.push(...describeBelady());

  output.push("");
  output.push(...describeRejectedInput());

  output.push("");
  output.push(...describeRejectedReplacementInput());

  console.log(output.join("\n"));
}

function describeMachine(machine: MachineState): string[] {
  const { process: proc, memory } = machine;
  const lines: string[] = [
    "Machine",
    RULE,
    `  page size             : ${memory.pageSize} bytes`,
    `  physical RAM          : ${memory.frameCount} frames (${memory.pageSize * memory.frameCount} bytes)`,
    `  process               : ${proc.name} (pid ${proc.pid})`,
    `  virtual address space : ${proc.virtualMemorySizeBytes} bytes (${proc.virtualMemorySizeBytes / memory.pageSize} pages)`,
    `  cpu mode              : ${machine.cpu.mode}`,
    `  tlb                   : ${
      machine.tlb.enabled
        ? `enabled, ${machine.tlb.entries.length}/${machine.tlb.capacity} entries (${TLB_EVICTION_POLICY})`
        : "none - this machine was built without a TLB"
    }`,
    `  swap                  : ${machine.swap.enabled ? "enabled" : "not modelled yet"}`,
    "  page table",
  ];

  for (const entry of pageTableEntries(proc.pageTable)) {
    const target =
      entry.present && entry.frameNumber !== null
        ? `frame ${entry.frameNumber}`
        : "NOT PRESENT (access faults)";
    lines.push(`    page ${entry.pageNumber} -> ${target}`);
  }

  return lines;
}

function describeSummary(machine: MachineState): string[] {
  const { stats } = machine;
  const lines: string[] = [
    "Summary",
    RULE,
    `  accesses     : ${stats.accesses}`,
    `  translated   : ${stats.translations}`,
    `  page faults  : ${stats.pageFaults}`,
    `  RAM accesses : ${stats.ramAccesses}`,
    `  next event # : ${machine.sequence}`,
  ];

  const pending = machine.cpu.pendingFault;
  if (pending !== null) {
    lines.push(
      `  unresolved fault : page ${pending.pageNumber}, offset ${pending.offset} (${pending.reason})`,
    );
  }

  return lines;
}

/** Show that malformed input is rejected instead of producing garbage. */
function describeRejectedInput(): string[] {
  const lines: string[] = ["Rejected input (the engine refuses to invent values)", RULE];

  for (const badAddress of [-1, 1.5, Number.NaN]) {
    try {
      step(createExampleMachine(), { type: "ACCESS_ADDRESS", address: badAddress });
      lines.push(`  ACCESS_ADDRESS(${String(badAddress)}) -> unexpectedly accepted`);
    } catch (error) {
      if (error instanceof EngineError) {
        lines.push(`  ACCESS_ADDRESS(${String(badAddress)}) -> ${error.code}: ${error.message}`);
      } else {
        lines.push(`  ACCESS_ADDRESS(${String(badAddress)}) -> ${String(error)}`);
      }
    }
  }

  return lines;
}

/**
 * The replacement algorithms at work on the classic reference string.
 *
 * The numbers printed here are the published textbook counts, and the tests assert
 * the very same ones: 15 / 12 / 9 faults for FIFO / LRU / Optimal with 3 frames.
 */
function describeReplacement(): string[] {
  const lines: string[] = [
    "Page replacement - reference string walkthrough",
    RULE,
    `  reference string : ${CLASSIC_REFERENCE_STRING.join(", ")}`,
    `  frames           : ${TEXTBOOK_FRAME_COUNT}`,
    `  accesses         : ${CLASSIC_REFERENCE_STRING.length}`,
    "",
    "  algorithm   faults   hits   evictions   final RAM",
  ];

  for (const algorithm of REPLACEMENT_ALGORITHMS) {
    const run = runReferenceString(algorithm, CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);

    lines.push(
      `  ${algorithm.padEnd(10)} ${pad(run.pageFaults)}   ${pad(run.hits)}   ${pad(run.evictions)}       ${formatFrames(run)}`,
    );
  }

  lines.push("");
  lines.push(...describeFirstReplacement());

  return lines;
}

/** The full event sequence of the first access that had to evict a page. */
function describeFirstReplacement(): string[] {
  const lines: string[] = ["  first replacement (FIFO), event by event", `  ${RULE}`];
  const run = runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);
  const entry = run.trace.find((candidate) => candidate.evicted !== null);

  if (entry === undefined) {
    lines.push("  no access needed a victim");
    return lines;
  }

  lines.push(
    `  access #${entry.accessIndex} touches page ${entry.pageNumber} with every frame full`,
  );

  for (const event of entry.events) {
    lines.push(...formatReplacementEvent(event));
  }

  const frames = entry.frames
    .map((frame) => (frame.pageNumber === null ? "-" : String(frame.pageNumber)))
    .join(", ");
  lines.push(`  ==> RAM is now [${frames}]`);

  return lines;
}

/** Belady's anomaly: FIFO can fault MORE when it is given MORE frames. */
function describeBelady(): string[] {
  const lines: string[] = [
    "Belady's anomaly - same string, more frames",
    RULE,
    `  reference string : ${BELADY_REFERENCE_STRING.join(", ")}`,
    "",
    "  algorithm   3 frames   4 frames   verdict",
  ];

  for (const algorithm of REPLACEMENT_ALGORITHMS) {
    const three = runReferenceString(algorithm, BELADY_REFERENCE_STRING, 3);
    const four = runReferenceString(algorithm, BELADY_REFERENCE_STRING, 4);
    const verdictText =
      four.pageFaults > three.pageFaults
        ? "MORE faults with more frames (the anomaly)"
        : "fewer faults with more frames";

    lines.push(
      `  ${algorithm.padEnd(10)} ${pad(three.pageFaults)} ${pad(four.pageFaults, 10)}   ${verdictText}`,
    );
  }

  return lines;
}

/** RAM as a compact list, with free frames shown as `-`. */
function formatFrames(run: ReferenceStringRun): string {
  const frames = run.finalFrames
    .map((frame) => (frame.pageNumber === null ? "-" : String(frame.pageNumber)))
    .join(", ");

  return `[${frames}]`;
}

/** Right-align a number inside a fixed column. */
function pad(value: number, width = 6): string {
  return String(value).padStart(width);
}

/** Show that a malformed replacement run is rejected, not guessed at. */
function describeRejectedReplacementInput(): string[] {
  const lines: string[] = ["Rejected replacement input", RULE];
  const attempts: readonly (readonly [string, () => unknown])[] = [
    [
      'runReferenceString("CLOCK", ...)   ',
      () => runReferenceString("CLOCK" as ReplacementAlgorithm, CLASSIC_REFERENCE_STRING, 3),
    ],
    [
      "runReferenceString(\"FIFO\", ..., 0)",
      () => runReferenceString("FIFO", CLASSIC_REFERENCE_STRING, 0),
    ],
    ["runReferenceString(\"FIFO\", [7, -1, 2], 3)", () => runReferenceString("FIFO", [7, -1, 2], 3)],
  ];

  for (const [label, attempt] of attempts) {
    try {
      attempt();
      lines.push(`  ${label} -> unexpectedly accepted`);
    } catch (error) {
      if (error instanceof EngineError) {
        lines.push(`  ${label} -> ${error.code}: ${error.message}`);
      } else {
        lines.push(`  ${label} -> ${String(error)}`);
      }
    }
  }

  return lines;
}

/**
 * `formatReplacementEvent` is an exhaustive switch over the replacement event union,
 * for the same reason `formatEvent` is: a new event type must not slip past the
 * debug output unnoticed.
 */
function formatReplacementEvent(event: ReplacementEvent): string[] {
  switch (event.type) {
    case "PAGE_FAULT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `reason : ${event.reason}`,
        `free   : ${event.freeFramesRemaining} frame(s) still free`,
      ]);
    case "PAGE_HIT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
      ]);
    case "REPLACEMENT_DECISION":
      return block(event.sequence, event.type, [
        `policy : ${event.algorithm}`,
        `page   : ${event.pageNumber} (incoming)`,
        `victim : page ${event.victimPageNumber} from frame ${event.victimFrameNumber}`,
        `why    : ${formatEvidence(event.evidence)}`,
      ]);
    case "EVICT_PAGE":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
      ]);
    case "LOAD_PAGE":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
      ]);
  }
}

/** The numbers behind a victim choice, in one line. */
function formatEvidence(evidence: ReplacementEvidence): string {
  const frames = `[${evidence.candidateFrameNumbers.join(", ")}]`;

  switch (evidence.rule) {
    case "FIFO_EARLIEST_LOADED":
      return `loaded at access ${evidence.victimLoadedAt}, before every other candidate ${frames}`;
    case "LRU_LEAST_RECENTLY_USED":
      return `last used at access ${evidence.victimLastUsedAt}, longer ago than every other candidate ${frames}`;
    case "OPTIMAL_FARTHEST_NEXT_USE":
      return evidence.victimNextUseIndex === null
        ? `never referenced again; candidates were ${frames}`
        : `next used ${evidence.victimNextUseIndex + 1} access(es) from now; candidates were ${frames}`;
  }
}

/**
 * The TLB at work: the same page twice, a different page, an unmapped page, and a TLB
 * that fills up. This section is the command-line version of the UI's first screen.
 */
function describeTlb(): string[] {
  const lines: string[] = [
    "TLB - a cache of translations",
    RULE,
    `  machine        : lab (${LAB_TLB_CAPACITY}-entry TLB, TLB eviction ${TLB_EVICTION_POLICY})`,
    `  page table     : ${LAB_PAGE_TABLE.map(describeLabEntry).join(", ")}`,
  ];

  // 1. First touch of a page: nothing is cached, so the page table must be walked.
  let machine = createLabMachine();
  const first = step(machine, { type: "ACCESS_ADDRESS", address: pageAddress(1, 0x345) });
  machine = first.state;

  lines.push("");
  lines.push("  access #1: page 1, offset 0x345 - first touch, nothing cached");
  for (const event of first.events) {
    lines.push(...formatEvent(event));
  }

  // 2. Second touch of the SAME page: the TLB answers, and the page table is skipped.
  const second = step(machine, { type: "ACCESS_ADDRESS", address: pageAddress(1, 0x999) });
  machine = second.state;

  lines.push("");
  lines.push("  access #2: page 1 again, a different offset - the TLB answers");
  for (const event of second.events) {
    lines.push(...formatEvent(event));
  }

  lines.push(
    `  ==> ${first.events.length} events through the page table, only ${second.events.length} on a TLB hit`,
  );

  // 3. A different page misses again, and is cached in turn.
  const third = step(machine, { type: "ACCESS_ADDRESS", address: pageAddress(4, 0) });
  machine = third.state;

  lines.push("");
  lines.push("  access #3: page 4 - a different page, so the TLB misses again");
  lines.push(`  ==> ${eventTypes(third.events).join(" -> ")}`);

  // 4. An unmapped page: TLB miss, page table, PAGE FAULT - and then nothing.
  const fourth = step(machine, { type: "ACCESS_ADDRESS", address: pageAddress(6, 100) });

  lines.push("");
  lines.push("  access #4: page 6 - not resident, so the TLB cannot help");
  lines.push(`  ==> ${eventTypes(fourth.events).join(" -> ")}`);
  lines.push("  ==> no frame, no physical address and no RAM access: translation stopped");

  // 5. Capacity: touch six distinct pages with only four slots.
  let churn = createLabMachine();
  lines.push("");
  lines.push(`  capacity: touching pages 0..5 with only ${LAB_TLB_CAPACITY} slots`);

  for (const pageNumber of [0, 1, 2, 3, 4, 5]) {
    const result = step(churn, { type: "ACCESS_ADDRESS", address: pageAddress(pageNumber, 0) });
    churn = result.state;

    const fill = result.events.find((event) => event.type === "TLB_FILL");
    const evict = result.events.find((event) => event.type === "TLB_EVICT");
    const slot = fill?.type === "TLB_FILL" ? fill.slotIndex : "?";
    const outcome =
      evict === undefined ? "fits in free space" : `evicts page ${evict.pageNumber} (FIFO)`;

    lines.push(`    page ${pageNumber}: miss, slot ${slot}, ${outcome}`);
  }

  const held = tlbEntries(churn.tlb).map((entry) => entry.pageNumber);
  lines.push(`  ==> TLB now holds pages [${held.join(", ")}] - the oldest entries had to go`);

  return lines;
}

/** A virtual address inside a page, at a given offset. */
function pageAddress(pageNumber: number, offset: number): number {
  return pageNumber * EXAMPLE_PAGE_SIZE + offset;
}

/** One page-table entry, as `page 3 -> frame 5` or `page 6 -> NOT PRESENT`. */
function describeLabEntry(entry: PageTableEntry): string {
  return entry.present && entry.frameNumber !== null
    ? `${entry.pageNumber}->${entry.frameNumber}`
    : `${entry.pageNumber}=NOT PRESENT`;
}

/** Event types of one access, joined for a one-line summary. */
function eventTypes(events: readonly Event[]): string[] {
  return events.map((event) => event.type);
}
function verdict(events: readonly Event[]): string {
  const last = events[events.length - 1];
  if (last === undefined) {
    return "no events";
  }
  if (last.type === "RAM_ACCESS") {
    return `RAM accessed at physical ${hex(last.physicalAddress)} (frame ${last.frameNumber}, offset ${last.offset})`;
  }
  if (last.type === "PAGE_FAULT") {
    return `PAGE FAULT on page ${last.pageNumber}, offset ${last.offset} - translation stopped`;
  }
  return `incomplete translation (last event: ${last.type})`;
}
/**
 * `formatEvent` is an exhaustive switch over the event union on purpose: adding a
 * new event type without teaching the debug output about it becomes a compile error.
 */
function formatEvent(event: Event): string[] {
  switch (event.type) {
    case "CPU_MEMORY_ACCESS":
      return block(event.sequence, event.type, [
        `access : ${event.access}`,
        `address: ${hex(event.virtualAddress)} (${event.virtualAddress})`,
        `pid    : ${event.pid}`,
      ]);
    case "VIRTUAL_ADDRESS_GENERATED":
      return block(event.sequence, event.type, [
        `address: ${hex(event.virtualAddress)} (${event.virtualAddress})`,
        `pid    : ${event.pid}`,
      ]);
    case "ADDRESS_SPLIT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `offset : ${event.offset}`,
        `page sz: ${event.pageSize}`,
      ]);
    case "TLB_LOOKUP":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `search : ${event.entriesSearched} cached entry/entries`,
      ]);
    case "TLB_HIT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber} (from slot ${event.slotIndex})`,
        "note   : page table NOT consulted",
      ]);
    case "TLB_MISS":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `reason : ${event.reason}`,
        "note   : a miss is not a fault - continue to the page table",
      ]);
    case "TLB_FILL":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber} (into slot ${event.slotIndex})`,
        `usage  : ${event.occupancy}/${event.capacity} entries`,
        `evicted: ${event.evicted ? "yes" : "no"}`,
      ]);
    case "TLB_EVICT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber} (from slot ${event.slotIndex})`,
        `policy : ${event.policy}`,
      ]);
    case "TLB_INVALIDATE":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
        `reason : ${event.reason}`,
      ]);
    case "PAGE_TABLE_LOOKUP":
      return block(event.sequence, event.type, [`page   : ${event.pageNumber}`]);
    case "PAGE_TABLE_HIT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
      ]);
    case "PAGE_FAULT":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `offset : ${event.offset}`,
        `reason : ${event.reason}`,
      ]);
    case "FRAME_RESOLVED":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber}`,
      ]);
    case "PHYSICAL_ADDRESS_GENERATED":
      return block(event.sequence, event.type, [
        `address: ${hex(event.physicalAddress)} (${event.physicalAddress})`,
        `frame  : ${event.frameNumber}, offset ${event.offset}`,
      ]);
    case "RAM_ACCESS":
      return block(event.sequence, event.type, [
        `address: ${hex(event.physicalAddress)} (${event.physicalAddress})`,
        `frame  : ${event.frameNumber}, offset ${event.offset}`,
        `access : ${event.access}`,
      ]);
    case "PAGE_UNMAPPED":
      return block(event.sequence, event.type, [
        `page   : ${event.pageNumber}`,
        `frame  : ${event.frameNumber} (released)`,
        `pid    : ${event.pid}`,
        `note   : a mapped page was unmapped - TLB entries for it are now stale`,
      ]);
    default:
      // Exhaustive check: any new event type added to the union must be handled here,
      // otherwise this line prevents compilation - which is exactly what we want.
      // `_exhaustiveCheck` is used below only to satisfy the compiler's unused-variable
      // check; the point is that this branch is unreachable for a correctly-shaped union.
      const _exhaustiveCheck: never = event;
      throw new Error("Unhandled event type in demo formatting - exhaustive check failed: " + _exhaustiveCheck);
  }
}

function block(sequence: number, type: string, fields: readonly string[]): string[] {
  return [`  [${sequence}] ${type}`, ...fields.map((field) => `      ${field}`)];
}

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

main();