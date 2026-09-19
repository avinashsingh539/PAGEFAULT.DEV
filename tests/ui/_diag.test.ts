import { describe, it, expect } from "vitest";
import { step } from "../../engine";
import type { MachineState } from "../../engine";
import { createUiLabMachine } from "../../ui/src/lib/lab";

function accessAddress(state: MachineState, address: number) {
  return step(state, { type: "ACCESS_ADDRESS", address });
}

describe("diag: actual engine event stream", () => {
  it("prints every event for page 0 so we can see what stageForEvent receives", () => {
    const machine = createUiLabMachine();
    const result = accessAddress(machine, 0 * 4096);

    console.log("event count:", result.events.length);
    for (const event of result.events) {
      console.log(`  seq=${event.sequence}  type=${event.type}`);
    }

    const types = result.events.map((e) => e.type);
    expect(types).toContain("CPU_MEMORY_ACCESS");
    expect(types).toContain("VIRTUAL_ADDRESS_GENERATED");
    expect(types).toContain("ADDRESS_SPLIT");
    expect(types).toContain("TLB_LOOKUP");
    expect(types).toContain("TLB_MISS");
    expect(types).toContain("PAGE_TABLE_LOOKUP");
    expect(types).toContain("PAGE_TABLE_HIT");
    expect(types).toContain("TLB_FILL");
    expect(types).toContain("FRAME_RESOLVED");
    expect(types).toContain("PHYSICAL_ADDRESS_GENERATED");
    expect(types).toContain("RAM_ACCESS");
  });
});
