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

import { EngineError, createExampleMachine, pageTableEntries, step } from "../engine";
import type { Event, MachineState } from "../engine";

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
  output.push(...describeRejectedInput());

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
    `  tlb                   : ${machine.tlb.enabled ? "enabled" : "not modelled yet"}`,
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

/** One readable line for the outcome of a whole event sequence. */
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
  }
}

function block(sequence: number, type: string, fields: readonly string[]): string[] {
  return [`  [${sequence}] ${type}`, ...fields.map((field) => `      ${field}`)];
}

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

main();