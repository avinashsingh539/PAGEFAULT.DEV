/**
 * Tests for the access narration (`ui/src/lib/accessNarration.ts`).
 *
 * These prove the contract Task 3 asked for: the narration explains each
 * access using ONLY the engine's real events. Every assertion runs a real
 * `step()` on the real lab machine and checks that the narration (a) reports
 * the true outcome first, (b) lists only stages that occurred, and (c) does
 * not fabricate a frame / physical address / RAM access on a fault.
 *
 * Plain-Node vitest, like every other lib test: the module is DOM-free by
 * construction, so a failing test here is a real logic failure, not a render
 * quirk.
 */

import { describe, expect, it } from "vitest";

import { step } from "../../engine";
import type { MachineState } from "../../engine";
import { createUiLabMachine } from "../../ui/src/lib/lab";
import { summarizeAccess } from "../../ui/src/lib/accessNarration";
import type { AccessNarration } from "../../ui/src/lib/accessNarration";

const PAGE_SIZE = 4096;
const addressOf = (page: number, offset = 0): number => page * PAGE_SIZE + offset;

/** Run one real access and narrate its real events. */
function narrate(machine: MachineState, address: number): AccessNarration {
  const result = step(machine, { type: "ACCESS_ADDRESS", address });
  const narration = summarizeAccess(result.events);
  if (narration === null) {
    throw new Error("access produced no narration");
  }
  return narration;
}

function labelsOf(narration: AccessNarration): string[] {
  return narration.steps.map((s) => s.label);
}

describe("summarizeAccess", () => {
  it("returns null for a record with no events", () => {
    expect(summarizeAccess([])).toBeNull();
  });

  it("narrates a first access: TLB miss -> page table -> RAM, with the physical address", () => {
    const narration = narrate(createUiLabMachine(), addressOf(0, 0x345));

    // Outcome first: it reached RAM, at the engine's real physical address.
    expect(narration.outcome).toEqual({ kind: "ram", physicalAddress: 3 * PAGE_SIZE + 0x345 });
    expect(narration.tone).toBe("hit");

    const labels = labelsOf(narration);
    expect(labels).toEqual([
      "CPU request",
      "Address split",
      "TLB miss",
      "Page table hit",
      "Translated to RAM",
    ]);

    // Sourced values, not guesses.
    const split = narration.steps[1];
    const ram = narration.steps[narration.steps.length - 1];
    if (split === undefined || ram === undefined) {
      throw new Error("narration is missing expected steps");
    }
    expect(split.detail).toContain("page 0");
    expect(split.detail).toContain("offset 837");
    expect(ram.detail).toContain("Frame 3");
    expect(ram.detail).toContain("0x3345");
  });

  it("narrates a repeated access: TLB hit, and no page-table step at all", () => {
    const machine = createUiLabMachine();
    // `step` is pure: the cache fills in the NEW state it returns.
    const warmed = step(machine, { type: "ACCESS_ADDRESS", address: addressOf(0, 0x10) }).state;

    const narration = narrate(warmed, addressOf(0, 0x20));
    const labels = labelsOf(narration);

    expect(labels).toContain("TLB hit");
    // The page table was skipped, so it must not appear as a step.
    expect(labels).not.toContain("TLB miss");
    expect(labels).not.toContain("Page table hit");
    expect(labels[labels.length - 1]).toBe("Translated to RAM");
    expect(narration.outcome.kind).toBe("ram");
  });

  it("narrates a page fault: fault is the last step and no RAM step exists", () => {
    // Page 6 is mapped as present:false on the lab machine.
    const narration = narrate(createUiLabMachine(), addressOf(6, 100));

    expect(narration.tone).toBe("fault");
    expect(narration.icon).toBe("alert");
    expect(narration.outcome).toEqual({ kind: "fault", pageNumber: 6 });

    const labels = labelsOf(narration);
    expect(labels[labels.length - 1]).toBe("Page fault");
    expect(labels).not.toContain("Translated to RAM");
    expect(labels).not.toContain("Page table hit");

    // The fault step must state the three things that did NOT happen.
    const fault = narration.steps[narration.steps.length - 1];
    if (fault === undefined) {
      throw new Error("narration has no fault step");
    }
    expect(fault.detail).toContain("no frame");
    expect(fault.detail).toContain("no physical address");
    expect(fault.detail).toContain("no RAM access");
  });

  it("is deterministic: the same access narrates identically every time", () => {
    const first = narrate(createUiLabMachine(), addressOf(2));
    const second = narrate(createUiLabMachine(), addressOf(2));
    expect(second).toEqual(first);
  });
});
