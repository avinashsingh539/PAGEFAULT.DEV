/**
 * Tests for the UI's session fold (`ui/src/lib/session.ts`).
 *
 * These exist to prove the contract the whole product rests on: the screen paints
 * EXACTLY what the engine returned, and nothing else. Every assertion checks that a
 * value shown in the UI came from an event payload or from engine state - and the
 * "never invents facts" properties (the TLB panel switches states exactly at TLB
 * mutation events, the page-table column is skipped on a hit, everything after a
 * fault stays dark) are pinned mechanically, not by eyeballing a browser.
 *
 * This file runs in the same plain-Node vitest environment as the engine tests; the
 * session fold deliberately uses no DOM, so it can be tested here.
 */

import { describe, expect, it } from "vitest";

import type { AccessRecord } from "../../ui/src/lib/session";
import { EngineError, step } from "../../engine";
import type { MachineState } from "../../engine";
import { createUiLabMachine, LAB_ENTRIES, LAB_TLB_CAPACITY } from "../../ui/src/lib/lab";
import {
  appendAccess,
  cursorAtEndOf,
  cursorForEntry,
  cursorForNewRecord,
  cursorForward,
  historyPosition,
  pageTableRows,
  stageForEvent,
  timelineEntries,
  viewForCursor,
} from "../../ui/src/lib/session";
import { PIPELINE_COLUMNS, stageStatuses, stageTitle } from "../../ui/src/lib/stages";
import { parseAddressText } from "../../ui/src/lib/url";
import type { Event } from "../../engine";


const PAGE_SIZE = 4096;

function addressOf(pageNumber: number, offset = 0): number {
  return pageNumber * PAGE_SIZE + offset;
}

/** One real engine access, folded into a session record exactly as the UI does. */
function accessRecord(machine: MachineState, address: number): AccessRecord {
  const result = step(machine, { type: "ACCESS_ADDRESS", address });
  return {
    kind: "access",
    stateBefore: machine,
    address,
    accessKind: "read",
    events: [...result.events],
    stateAfter: result.state,
  };
}

function indexOfType(
  record: AccessRecord,
  type: AccessRecord["events"][number]["type"],
): number {
  const index = record.events.findIndex((event) => event.type === type);
  if (index === -1) {
    throw new Error(`record has no ${type} event`);
  }
  return index;
}

describe("the lab machine the screen starts on", () => {
  it("is the documented machine: six mapped pages, one absent, a four-entry TLB", () => {
    const machine = createUiLabMachine();

    expect(machine.tlb).toEqual({ enabled: true, capacity: LAB_TLB_CAPACITY, entries: [] });
    expect(machine.memory.frameCount).toBe(16);
    expect(machine.process.pageTable.pageSize).toBe(PAGE_SIZE);
    expect(LAB_ENTRIES).toHaveLength(7);
    expect(LAB_ENTRIES[6]).toEqual({ pageNumber: 6, present: false, frameNumber: null });
  });

  it("refuses to build a machine the engine would reject", () => {
    expect(() => createUiLabMachine({ tlbCapacity: 0 })).toThrowError(EngineError);
  });
});

describe("the view the screen paints from one access", () => {
  it("reads page, offset, frame and physical address off the events - and nothing else", () => {
    const machine = createUiLabMachine();
    const record = accessRecord(machine, addressOf(0, 0x345));

    // The cursor starts on the first event, so nothing is resolved yet.
    const start = viewForCursor([record], cursorForNewRecord([record]));
    expect(start.event?.type).toBe("CPU_MEMORY_ACCESS");
    expect(start.pageNumber).toBeNull();
    expect(start.frameNumber).toBeNull();
    expect(start.physicalAddress).toBeNull();
    expect(start.tlbAfter).toBe(false); // a fill is still ahead of the cursor

    // Walk to RAM_ACCESS: now every number is present, and each one is the event's.
    const ramIndex = indexOfType(record, "RAM_ACCESS");
    const atRam = viewForCursor([record], { recordIndex: 0, eventIndex: ramIndex });
    expect(atRam.pageNumber).toBe(0);
    expect(atRam.offset).toBe(0x345);
    expect(atRam.frameNumber).toBe(3);
    expect(atRam.physicalAddress).toBe(3 * PAGE_SIZE + 0x345);
    expect(atRam.tlbAfter).toBe(true);
    expect(atRam.tlbEntries).toEqual(record.stateAfter.tlb.entries);
  });

  it("switches the TLB panel from before-state to after-state exactly at the fill", () => {
    const machine = createUiLabMachine();
    const record = accessRecord(machine, addressOf(0));
    const fillIndex = indexOfType(record, "TLB_FILL");

    const before = viewForCursor([record], { recordIndex: 0, eventIndex: fillIndex - 1 });
    const after = viewForCursor([record], { recordIndex: 0, eventIndex: fillIndex });

    expect(before.tlbAfter).toBe(false);
    expect(before.tlbEntries).toEqual([]);
    expect(after.tlbAfter).toBe(true);
    expect(after.tlbEntries).toEqual([{ pageNumber: 0, frameNumber: 3, fillOrder: 0 }]);
  });

  it("maps each event to the pipeline stage a lesson would name", () => {
    const machine = createUiLabMachine();
    const record = accessRecord(machine, addressOf(0));
    const at = (type: Parameters<typeof indexOfType>[1]): Event =>
      record.events[indexOfType(record, type)] as AccessRecord["events"][number];

    expect(stageForEvent(record, record.events[0] as AccessRecord["events"][number])).toBe("cpu");
    expect(stageForEvent(record, at("ADDRESS_SPLIT"))).toBe("split");
    expect(stageForEvent(record, at("TLB_MISS"))).toBe("tlb");
    expect(stageForEvent(record, at("PAGE_TABLE_HIT"))).toBe("pageTable");
    expect(stageForEvent(record, at("TLB_FILL"))).toBe("fill");
    expect(stageForEvent(record, at("RAM_ACCESS"))).toBe("ram");
  });
});

describe("the teaching rules the pipeline paints", () => {
  it("renders every pipeline stage as a column, including the fault", () => {
    // The hardware order now names `fault` where it happens: after the page table, in
    // place of the stages a faulting access never reaches. This pins the diagram's shape
    // so a lesson about faults always has a column to light up.
    expect(PIPELINE_COLUMNS).toEqual([
      "cpu",
      "virtual",
      "split",
      "tlb",
      "pageTable",
      "fault",
      "fill",
      "frame",
      "physical",
      "ram",
    ]);
    expect(stageTitle("fault")).toBe("Page Fault");
  });

  it("keeps the page-table column dark for the whole record on a TLB hit", () => {
    const machine = createUiLabMachine();
    const first = accessRecord(machine, addressOf(0));
    const second = accessRecord(first.stateAfter, addressOf(0, 0x10));
    const records = appendAccess(appendAccess([], first), second);

    const statuses = stageStatuses(second, viewForCursor(records, cursorForNewRecord(records)));

    // At the first event only the CPU column is lit; the page table is already dark.
    expect(statuses.pageTable).toBe("skipped");
    expect(statuses.cpu).toBe("active");
    expect(statuses.ram).not.toBe("skipped");

    // At the hit itself the TLB column is the one that is lit.
    const atHit = stageStatuses(
      second,
      viewForCursor(records, {
        recordIndex: records.length - 1,
        eventIndex: indexOfType(second, "TLB_HIT"),
      }),
    );
    expect(atHit.tlb).toBe("active");
    expect(atHit.pageTable).toBe("skipped");
    expect(atHit.ram).not.toBe("skipped");
  });

  it("keeps fill, frame, physical and RAM dark for the whole record on a fault", () => {
    const machine = createUiLabMachine();
    const record = accessRecord(machine, addressOf(6, 100));
    const records = appendAccess([], record);

    // Even at the very first event, the record already says what never happens.
    const early = stageStatuses(record, viewForCursor(records, cursorForNewRecord(records)));
    expect(early.fill).toBe("skipped");
    expect(early.frame).toBe("skipped");
    expect(early.physical).toBe("skipped");
    expect(early.ram).toBe("skipped");

    // At the fault itself the column turns red.
    const atFault = stageStatuses(
      record,
      viewForCursor(records, { recordIndex: 0, eventIndex: indexOfType(record, "PAGE_FAULT") }),
    );
    expect(atFault.fault).toBe("fault");
  });

  it("marks the TLB column as skipped for a machine without one", () => {
    const machine = createUiLabMachine({ tlbCapacity: null });
    const record = accessRecord(machine, addressOf(0));
    const records = appendAccess([], record);

    const statuses = stageStatuses(record, viewForCursor(records, cursorForNewRecord(records)));

    expect(statuses.tlb).toBe("skipped");
    expect(statuses.pageTable).not.toBe("skipped");
    // And the events agree: no TLB event exists in the record at all.
    expect(record.events.some((event) => event.type.startsWith("TLB_"))).toBe(false);
  });
});

describe("the cursor and the log", () => {
  it("advances across records and stops honestly at the end", () => {
    const machine = createUiLabMachine();
    const first = accessRecord(machine, addressOf(0));
    const second = accessRecord(first.stateAfter, addressOf(2));
    const records = appendAccess(appendAccess([], first), second);

    let cursor = cursorForNewRecord(records);
    const first0 = cursor;
    cursor = cursorForward(records, cursor);
    expect(cursor.recordIndex).toBe(first0.recordIndex);
    expect(cursor.eventIndex).toBe(first0.eventIndex + 1);

    // Jump to the last event of the last record: forward must not move.
    const lastRecord = records[records.length - 1] as AccessRecord;
    const end = {
      recordIndex: records.length - 1,
      eventIndex: (lastRecord.events.length ?? 1) - 1,
    };
    expect(cursorForward(records, end)).toEqual(end);

    // The log holds every event of the session, in order.
    const log = timelineEntries(records);
    expect(log).toHaveLength(records.reduce((total, record) => total + record.events.length, 0));
    expect(log[0]?.recordIndex).toBe(0);
    expect(log.at(-1)?.recordIndex).toBe(records.length - 1);
  });

  it("shows empty counts before anything happened", () => {
    const view = viewForCursor([], null);

    expect(view.event).toBeNull();
    expect(view.hits).toBe(0);
    expect(view.misses).toBe(0);
    expect(view.faults).toBe(0);
    expect(view.headline).toContain("No access");
  });

  it("positions a cursor exactly where the log entry points", () => {
    const machine = createUiLabMachine();
    const record = accessRecord(machine, addressOf(0));
    const records = appendAccess([], record);
    const log = timelineEntries(records);

    const entry = log[3];
    if (entry === undefined) {
      throw new Error("the log has no fourth entry");
    }
    expect(cursorForEntry(entry)).toEqual({ recordIndex: entry.recordIndex, eventIndex: entry.eventIndex });
  });
});

describe("jump-to-latest and history position", () => {
  function twoAccesses(): ReturnType<typeof appendAccess> {
    const machine = createUiLabMachine();
    const first = accessRecord(machine, addressOf(0));
    const second = accessRecord(first.stateAfter, addressOf(2));
    return appendAccess(appendAccess([], first), second);
  }

  it("cursorAtEndOf points at the last event of the newest record", () => {
    const records = twoAccesses();
    const last = records[records.length - 1];
    if (last === undefined) {
      throw new Error("expected two records");
    }
    expect(cursorAtEndOf(records)).toEqual({
      recordIndex: records.length - 1,
      eventIndex: last.events.length - 1,
    });
  });

  it("cursorAtEndOf is empty-safe", () => {
    expect(cursorAtEndOf([])).toBeNull();
  });

  it("historyPosition counts the cursor in whole-session event order", () => {
    const records = twoAccesses();
    const firstLength = records[0]?.events.length ?? 0;
    const total = records.reduce((sum, record) => sum + record.events.length, 0);

    expect(historyPosition(records, null)).toBeNull();
    expect(historyPosition(records, { recordIndex: 0, eventIndex: 0 })).toEqual({
      position: 1,
      total,
    });
    expect(historyPosition(records, { recordIndex: 1, eventIndex: 0 })).toEqual({
      position: firstLength + 1,
      total,
    });
    expect(historyPosition(records, cursorAtEndOf(records))).toEqual({
      position: total,
      total,
    });
  });

  it("a jump to latest lands exactly where stepping there would land", () => {
    const records = twoAccesses();
    // Walk every step from the very first event: the last distinct position
    // reached must equal the jump target.
    let walked = cursorForNewRecord(records);
    let previous = walked;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = cursorForward(records, walked);
      if (next.recordIndex === walked.recordIndex && next.eventIndex === walked.eventIndex) {
        break;
      }
      previous = walked;
      walked = next;
    }
    expect(walked).toEqual(cursorAtEndOf(records));
    // And the view painted there is the latest event of the newest record.
    const view = viewForCursor(records, walked);
    const last = records[records.length - 1];
    expect(view.event).toBe(last?.events[last.events.length - 1] ?? null);
    expect(previous).not.toEqual(walked);
  });

  it("a scrubbed-back session reports the historical event, not the latest", () => {
    const records = twoAccesses();
    const backAtStart = { recordIndex: 0, eventIndex: 0 };
    const view = viewForCursor(records, backAtStart);
    const latest = cursorAtEndOf(records);
    const latestView = latest === null ? null : viewForCursor(records, latest);

    expect(view.event?.type).toBe("CPU_MEMORY_ACCESS");
    expect(latestView?.event).not.toBe(view.event);
    // The records themselves are untouched by the scrub: same count, same
    // events - only the cursor moved.
    expect(records).toHaveLength(2);
    expect(timelineEntries(records)).toHaveLength(
      records.reduce((sum, record) => sum + record.events.length, 0),
    );
  });
});

describe("the page-table rows the screen renders", () => {
  it("are the engine's own rows, in ascending page order", () => {
    const rows = pageTableRows(createUiLabMachine());

    expect(rows.map((row) => row.pageNumber)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(rows[6]).toEqual({ pageNumber: 6, present: false, frameNumber: null });
    expect(rows[0]).toEqual({ pageNumber: 0, present: true, frameNumber: 3 });
  });
});

describe("address text parsing (UI input; the engine still validates every access)", () => {
  it("accepts decimal and hex, and rejects everything else", () => {
    expect(parseAddressText("74565")).toBe(74565);
    expect(parseAddressText("0x12345")).toBe(0x12345);
    expect(parseAddressText("0X12345")).toBe(0x12345);
    expect(parseAddressText(" 0x10 ")).toBe(16);
    expect(parseAddressText("")).toBeNull();
    expect(parseAddressText("-1")).toBeNull();
    expect(parseAddressText("1.5")).toBeNull();
    expect(parseAddressText("0xzz")).toBeNull();
    expect(parseAddressText("12abc")).toBeNull();
  });
});