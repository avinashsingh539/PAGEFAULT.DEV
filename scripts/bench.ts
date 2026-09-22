/**
 * Performance and load check for the pure engine.
 *
 *   npm run bench
 *
 * This is not a benchmark harness and does not pretend to be one. There is no
 * warm-up phase, no statistical analysis and no comparison against other machines'
 * numbers. It answers three narrow questions about THIS repository:
 *
 *   1. Does the cost of the simulation grow linearly with the number of accesses, or
 *      has something accidentally become quadratic?
 *   2. Does repeated stepping degrade - does the machine accumulate state that is
 *      never released, so a long session gets slower as it goes?
 *   3. Are the published results (FIFO 15 / LRU 12 / Optimal 9) stable at scale?
 *
 * If any of those three ever answers badly, the numbers printed here will show it.
 * The measured values for the current commit are recorded in `docs/performance.md`.
 *
 * The harness only reads the public engine API - state in, events out - which is the
 * same surface the CLI and the browser use.
 */

import {
  CLASSIC_REFERENCE_STRING,
  REPLACEMENT_ALGORITHMS,
  TEXTBOOK_FRAME_COUNT,
  createLabMachine,
  runReferenceString,
  step,
} from "../engine";
import type { MachineState, ReplacementAlgorithm } from "../engine";

const RULE = "-".repeat(70);

interface Measurement {
  readonly label: string;
  readonly operations: number;
  readonly milliseconds: number;
}

function measure<T>(label: string, operations: number, work: () => T): Measurement & { readonly value: T } {
  const started = process.hrtime.bigint();
  const value = work();
  const milliseconds = Number(process.hrtime.bigint() - started) / 1_000_000;
  return { label, operations, milliseconds, value };
}

/** Operations per second, safe against a sub-nanosecond workload. */
function rate(measurement: Measurement): string {
  if (measurement.milliseconds <= 0) {
    return "instant";
  }
  const perSecond = measurement.operations / (measurement.milliseconds / 1000);
  return `${Math.round(perSecond).toLocaleString("en-US")} ops/s`;
}

function row(measurement: Measurement, note = ""): string {
  const ops = measurement.operations.toLocaleString("en-US").padStart(9);
  const ms = `${measurement.milliseconds.toFixed(1)} ms`.padStart(11);
  const suffix = note === "" ? "" : `   ${note}`;
  return `  ${ops}  ${ms}  ${rate(measurement).padStart(16)}${suffix}`;
}

/**
 * Eleven addresses over seven distinct pages: six resident in frames 3, 7, 1, 5, 9 and
 * 11, and page 6 absent from RAM. With a 4-entry TLB, cycling this set produces hits,
 * misses, fills and evictions on every lap, and a fault once per lap.
 */
const WORKING_SET: readonly number[] = [
  0x0000, 0x0100, 0x1000, 0x1fff, 0x2000, 0x2121, 0x3000, 0x3121, 0x4000, 0x5121, 0x6000,
];

interface TranslationOutcome {
  readonly events: number;
  readonly faults: number;
}

/** Run `accesses` translations through repeated calls to the same pure `step()`. */
function translationWorkload(accesses: number): TranslationOutcome {
  let machine: MachineState = createLabMachine();
  let events = 0;
  let faults = 0;
  let cursor = 0;

  for (let index = 0; index < accesses; index += 1) {
    const address = WORKING_SET[cursor] ?? 0;
    cursor = cursor + 1 >= WORKING_SET.length ? 0 : cursor + 1;

    const result = step(machine, { type: "ACCESS_ADDRESS", address });
    machine = result.state;
    events += result.events.length;

    for (const event of result.events) {
      if (event.type === "PAGE_FAULT") {
        faults += 1;
      }
    }
  }

  return { events, faults };
}

/** A reference string of `length` accesses drawn from `alphabet` distinct pages. */
function referenceStringOf(length: number, alphabet: number): readonly number[] {
  const pages: number[] = [];
  for (let index = 0; index < length; index += 1) {
    pages.push(index % alphabet);
  }
  return pages;
}

/** The working-set position that names the absent page; one fault per lap. */
const FAULTING_INDEX = WORKING_SET.length - 1;

/** How many laps of the working set contain the absent page, by arithmetic, not by asking the engine. */
function expectedFaults(accesses: number): number {
  return Math.max(0, Math.ceil((accesses - FAULTING_INDEX) / WORKING_SET.length));
}

function reportTranslation(output: string[]): void {
  output.push("Translation - sequential accesses, 4-entry TLB, 11-address working set");
  output.push("(six pages resident in RAM, one absent, so every lap also produces one fault)");
  output.push(RULE);
  output.push("   accesses         time        throughput     work done");

  for (const accesses of [100, 1_000, 10_000]) {
    const measured = measure("translation", accesses, () => translationWorkload(accesses));
    const outcome = measured.value;
    const faults = outcome.faults.toLocaleString("en-US");
    const events = outcome.events.toLocaleString("en-US");
    output.push(row(measured, `${events} events, ${faults} faults`));

    // Non-circular: the expectation is lap arithmetic, the observed value is the
    // engine's own PAGE_FAULT count.
    const expected = expectedFaults(accesses);
    if (outcome.faults !== expected) {
      output.push(`  !! arithmetic says ${expected} faults, the engine reported ${outcome.faults}`);
    }
  }
}

function reportRepeatability(output: string[]): void {
  const runs = 5;
  const timings: Measurement[] = [];

  for (let index = 0; index < runs; index += 1) {
    timings.push(measure("translation", 10_000, () => translationWorkload(10_000)));
  }

  const times = timings.map((timing) => timing.milliseconds);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);
  const first = times[0] ?? 0;
  const last = times[times.length - 1] ?? 0;

  output.push("");
  output.push(`Repeatability - the same 10,000-access workload, ${runs} times in one process`);
  output.push(RULE);
  output.push(`  ${times.map((time) => time.toFixed(1)).join(" ms, ")} ms`);
  output.push(`  fastest ${fastest.toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms`);
  output.push(
    `  first ${first.toFixed(1)} ms, last ${last.toFixed(1)} ms - ` +
      "state that accumulated and was never released",
  );
  output.push("  would make every run slower than the one before it, not just the last one noisy");
}

interface ReplacementWorkload {
  readonly label: string;
  readonly pages: readonly number[];
  readonly frames: number;
}

const REPLACEMENT_WORKLOADS: readonly ReplacementWorkload[] = [
  { label: "textbook string, 17 accesses, 3 frames", pages: CLASSIC_REFERENCE_STRING, frames: TEXTBOOK_FRAME_COUNT },
  { label: "1,000 accesses, 8 frames, 64-page alphabet", pages: referenceStringOf(1_000, 64), frames: 8 },
  { label: "10,000 accesses, 16 frames, 64-page alphabet", pages: referenceStringOf(10_000, 64), frames: 16 },
  { label: "20,000 accesses, 32 frames, 64-page alphabet", pages: referenceStringOf(20_000, 64), frames: 32 },
];

/**
 * Sizes only the linear algorithms are asked about.
 *
 * Optimal has to look ahead to choose a victim, so its work per eviction grows with
 * the remaining length of the reference string and its total cost grows
 * super-linearly. That is inherent to a real Optimal policy - it needs the future -
 * rather than a defect introduced here, and it is measured rather than assumed: see
 * `docs/performance.md`. Asking Optimal for 100,000 accesses would spend minutes of
 * arithmetic on a number nobody needs, so the large case is run against FIFO and LRU,
 * whose cost is linear in the access count.
 */
const LINEAR_ONLY_WORKLOAD: ReplacementWorkload = {
  label: "100,000 accesses, 32 frames, 64-page alphabet",
  pages: referenceStringOf(100_000, 64),
  frames: 32,
};

const LINEAR_ALGORITHMS: readonly ReplacementAlgorithm[] = ["FIFO", "LRU"];

/** The documented textbook fault counts - literal facts, never the engine's own output. */
const PUBLISHED_FAULTS: readonly { readonly algorithm: ReplacementAlgorithm; readonly faults: number }[] = [
  { algorithm: "FIFO", faults: 15 },
  { algorithm: "LRU", faults: 12 },
  { algorithm: "OPTIMAL", faults: 9 },
];

function reportReplacement(output: string[]): void {
  const totalAccesses = REPLACEMENT_WORKLOADS.reduce((sum, workload) => sum + workload.pages.length, 0);

  output.push("");
  output.push("Replacement - each algorithm over all four workloads below");
  output.push(`(total ${totalAccesses.toLocaleString("en-US")} accesses per algorithm)`);
  output.push(RULE);
  output.push("  algorithm         time        throughput      faults");

  for (const algorithm of REPLACEMENT_ALGORITHMS) {
    const measured = measure(algorithm, totalAccesses, () => {
      let faults = 0;
      for (const workload of REPLACEMENT_WORKLOADS) {
        faults += runReferenceString(algorithm, workload.pages, workload.frames).pageFaults;
      }
      return faults;
    });

    const times = `${measured.milliseconds.toFixed(1)} ms`.padStart(11);
    const faults = measured.value.toLocaleString("en-US").padStart(7);
    output.push(`  ${algorithm.padEnd(10)} ${times}  ${rate(measured).padStart(16)}  ${faults}`);
  }

  output.push("  workloads:");
  for (const workload of REPLACEMENT_WORKLOADS) {
    output.push(`    - ${workload.label}`);
  }
}

function reportCorrectness(output: string[]): number {
  output.push("");
  output.push("Correctness at scale - the published textbook values, re-checked here");
  output.push(RULE);

  let failures = 0;
  for (const expected of PUBLISHED_FAULTS) {
    const run = runReferenceString(expected.algorithm, CLASSIC_REFERENCE_STRING, TEXTBOOK_FRAME_COUNT);
    const ok = run.pageFaults === expected.faults;
    if (!ok) {
      failures += 1;
    }
    output.push(
      `  ${ok ? "ok  " : "FAIL"} ${expected.algorithm.padEnd(8)} ${run.pageFaults} faults ` +
        `(published ${expected.faults}), ${run.hits} hits over ${run.accesses} accesses`,
    );
  }

  return failures;
}

/** FIFO and LRU on a reference string too large to hand to Optimal. */
function reportLargeInput(output: string[]): void {
  const accesses = LINEAR_ONLY_WORKLOAD.pages.length;

  output.push("");
  output.push("Large input - the linear algorithms on 100,000 accesses");
  output.push("(Optimal is left out on purpose; the next section shows why)");
  output.push("(this is the slow section: the harness keeps one frame snapshot per access)");
  output.push(RULE);

  for (const algorithm of LINEAR_ALGORITHMS) {
    const measured = measure(algorithm, accesses, () =>
      runReferenceString(algorithm, LINEAR_ONLY_WORKLOAD.pages, LINEAR_ONLY_WORKLOAD.frames),
    );

    // The trace is a snapshot per access, so this is the memory a long run costs.
    const heapMegabytes = process.memoryUsage().heapUsed / (1024 * 1024);
    const faults = measured.value.pageFaults.toLocaleString("en-US");
    const traceEntries = measured.value.trace.length.toLocaleString("en-US");
    output.push(
      row(measured, `${faults} faults, ${traceEntries} trace entries, heap ${heapMegabytes.toFixed(0)} MB`),
    );
  }
}

/**
 * Optimal's cost against the size of the input, at three sizes.
 *
 * Printed as a table rather than described, because the point is the SHAPE of the
 * growth. Doubling the accesses should roughly double the time for FIFO and LRU; for
 * Optimal it does more than that, and anyone changing the victim-selection code can
 * see immediately whether they made it better or worse.
 */
function reportOptimalScaling(output: string[]): void {
  output.push("");
  output.push("Optimal's growth - the same policy at three input sizes");
  output.push("(one decision must weigh every remaining use of every candidate page)");
  output.push(RULE);
  output.push("   accesses         time        throughput     faults");

  for (const accesses of [2_000, 10_000, 20_000]) {
    const pages = referenceStringOf(accesses, 64);
    const measured = measure("OPTIMAL", accesses, () => runReferenceString("OPTIMAL", pages, 32));
    output.push(row(measured, `${measured.value.pageFaults.toLocaleString("en-US")} faults`));
  }
}

function main(): void {
  const output: string[] = [];

  output.push("PAGEFAULT.DEV - engine performance and load check");
  output.push("=".repeat(70));
  output.push("");

  reportTranslation(output);
  reportRepeatability(output);
  reportReplacement(output);
  reportOptimalScaling(output);
  // Last on purpose. This section allocates hundreds of megabytes of trace, and the
  // garbage it leaves behind measurably distorts any timing measured after it - the
  // Optimal table read 14x slower when it was run below this one instead of above it.
  reportLargeInput(output);

  const failures = reportCorrectness(output);

  output.push("");
  output.push(`node ${process.version} on ${process.platform}/${process.arch}`);
  output.push(failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`);

  console.log(output.join("\n"));
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
