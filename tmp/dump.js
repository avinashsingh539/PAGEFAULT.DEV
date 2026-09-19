import { step, createDemoMachine, MachineState } from "../../engine";
import type { Event } from "../../engine";

function dumpEvents(label: string, state: MachineState, address: number): void {
  const result = step(state, { type: "ACCESS_ADDRESS", address });
  console.log(`\n=== ${label} ===`);
  console.log(`address: 0x${address.toString(16)} (${address})`);
  console.log("events:");
  for (const e of result.events) {
    console.log(`  #${String(e.sequence).padStart(2)} ${e.type}`);
  }
  console.log(`stateAfter.tlb?.entries.length = ${result.state.tlb?.entries.length ?? "n/a"}`);
  process.exit(0);
}

const machine = createDemoMachine();
dumpEvents("first access to page 0", machine, 0 * 4096);
