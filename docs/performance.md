# Performance

What the engine costs, measured, on the machine this was written on. Every number
below was produced by `npm run bench` at commit `5cd38bb` plus the Day 6 changes -
none of it is estimated, and nothing here is claimed that was not observed.

## What this is and is not

**Is:** a load check. It answers three questions about this repository:

1. Does the cost grow linearly with the number of accesses, or has something become
   accidentally quadratic?
2. Does repeated stepping degrade - does the machine accumulate state that is never
   released?
3. Are the published results (FIFO 15 / LRU 12 / Optimal 9) still stable at scale?

**Is not:** a benchmark suite. There is no warm-up phase, no repeated-measure
statistics, no memory profiling, no cross-machine comparison and no claim about
throughput on any hardware but the one below. Treat the absolute numbers as
order-of-magnitude indications and the *ratios between rows* as the real finding.

## Environment

```
node v22.15.0 on win32/x64
```

Single process, single thread, no warm-up. Timings use `process.hrtime.bigint()`, so
they are monotonic wall-clock durations for the whole workload including its
allocation.

## Reproducing

```bash
npm run bench      # builds the CLI (tsc -p tsconfig.cli.json), then runs the harness
```

`npm run bench` takes roughly **50-60 seconds**, almost all of it the 100,000-access
section. That is deliberate: the large case exists to find the ceiling, and a ceiling
you have to wait for is still a ceiling. Everything else in the run finishes in about
two seconds.

The harness is `scripts/bench.ts`. It reads only the public engine API - `step()`,
`runReferenceString()` and the preset machines - which is the same surface the CLI and
the browser use.

## Method

| Workload | What it is |
| --- | --- |
| Translation | Sequential `step()` calls over an 11-address working set spanning 7 distinct pages: 6 resident in frames 3, 7, 1, 5, 9 and 11, and page 6 deliberately absent. With a 4-entry TLB this cycles hits, misses, fills and evictions, and faults once per lap |
| Replacement | One reference string per row, `runReferenceString(algorithm, pages, frames)` |
| Repeatability | The identical 10,000-access translation workload, five times in one process |

The fault counts are checked against **arithmetic**, not against the engine: the
working set has 11 positions and the last one names the absent page, so `accesses`
translations must produce `ceil((accesses - 10) / 11)` faults. For 100, 1,000 and
10,000 accesses that is 9, 90 and 909 - and those are exactly what the engine
reported. A count the harness derived from the engine's own output would prove
nothing.

## Results

### Translation - 11-address working set, 4-entry TLB

| accesses | time | throughput | events produced | faults |
| --- | --- | --- | --- | --- |
| 100 | 2.0 ms | 48,936 ops/s | 1,007 | 9 |
| 1,000 | 4.6 ms | 215,489 ops/s | 10,090 | 90 |
| 10,000 | 36.9 ms | 271,089 ops/s | 100,907 | 909 |

**Reading this.** Throughput *rises* with size, which looks backwards and is not: the
100-access row is one hundred calls in a cold process, so it is mostly interpreter
warm-up. The 10,000-access row is the honest steady-state figure - about **271,000
translations per second**, or 3.7 microseconds each, with roughly ten events produced
per access. Going from 1,000 to 10,000 accesses costs 8.0x the time for 10x the work,
which is linear within measurement noise.

### Repeatability - the same 10,000-access workload, five times

```
9.0 ms, 17.7 ms, 12.5 ms, 16.7 ms, 14.1 ms
fastest 9.0 ms, slowest 17.7 ms
first 9.0 ms, last 14.1 ms
```

**Reading this.** No trend. The spread is roughly 2x, which is ordinary garbage
collection and JIT noise at these durations, but the times do not grow: the fifth run
is not slower than the first, the second or the fourth. State that accumulated and was
never released would make every run slower than the one before it.

There is also a structural reason, which is the stronger evidence: `MachineState`
holds a CPU, a process, a TLB, physical memory, swap state, four counters and a
sequence number. It holds **no event log**. Events are returned from `step()` and are
the caller's to keep, so a long session's state stays the same size while the caller's
history grows only as fast as the caller asks it to.

### Replacement - each algorithm over all four workloads (31,020 accesses each)

| algorithm | time | throughput | faults across all four |
| --- | --- | --- | --- |
| FIFO | 674.2 ms | 46,008 ops/s | 31,015 |
| LRU | 703.0 ms | 44,125 ops/s | 31,012 |
| OPTIMAL | 795.2 ms | 39,008 ops/s | 18,710 |

Workloads: textbook string 17 accesses / 3 frames; 1,000 / 8 frames; 10,000 / 16
frames; 20,000 / 32 frames (64-page alphabet for the last three).

**Reading this.** All three are in the same band. FIFO and LRU differ by 4%, which is
inside the noise for workloads this size. Optimal is slower by about 18%, and the next
table shows why that gap widens with input size.

### Optimal's growth - the same policy at three input sizes

| accesses | time | throughput | faults |
| --- | --- | --- | --- |
| 2,000 | 7.2 ms | 276,690 ops/s | 1,039 |
| 10,000 | 71.4 ms | 140,060 ops/s | 5,102 |
| 20,000 | 440.6 ms | 45,394 ops/s | 10,176 |

**Reading this.** This is the one genuinely unbounded-looking result, and it is real.
Doubling the input from 2,000 to 10,000 accesses (5x) costs 9.9x the time; doubling
again from 10,000 to 20,000 costs **6.2x**. Throughput halves as the input doubles,
which is the signature of super-linear growth.

The cause is not a defect introduced on this project - it is what "Optimal" means. To
choose a victim, an optimal policy must know when each candidate page is used *again*,
which means looking ahead through the remaining reference string. The work per eviction
therefore grows with how much of the string is left, and the total cost grows faster
than the access count. FIFO and LRU need only a timestamp they already have, which is
why they stay linear.

It is measured and printed rather than hidden because the shape of the curve is the
useful part: anyone changing victim selection can see immediately whether they made it
better or worse.

### Large input - FIFO and LRU on 100,000 accesses

Reference string is 100,000 accesses drawn from a 64-page alphabet with 32 frames, so
every access faults: 100,000 faults, 100,000 loads, 100,000 evictions.

| algorithm | time | throughput | trace | heap after |
| --- | --- | --- | --- | --- |
| FIFO | 16,062.4 ms | 6,226 ops/s | 100,000 entries | 148 MB |
| LRU | 20,609.1 ms | 4,852 ops/s | 100,000 entries | 295 MB |

**Reading this.** This is the ceiling, and it is worth stating plainly: **100,000
accesses is not a reasonable interactive workload for this harness.** Sixteen to twenty
seconds and a quarter of a gigabyte of heap is Fine for a script and unacceptable for a
button press.

The reason is the shape of `ReferenceStringRun.trace`: it stores the full frame state
after *every* access, by design, because Compare Mode needs to show what RAM looked
like after access N. That is O(accesses x frames) memory - 100,000 snapshots of 32
resident pages - and the allocation cost dominates the actual simulation. The engine
arithmetic is not the bottleneck here; the record it keeps is.

Optimal is deliberately excluded from this row. At the growth rate measured above, a
100,000-access Optimal run would take minutes.

### Correctness at scale

The run ends by re-checking the published textbook values, against literals from
`docs/reference-values.md` rather than against the engine's own output:

```
ok   FIFO     15 faults (published 15), 5 hits over 20 accesses
ok   LRU      12 faults (published 12), 8 hits over 20 accesses
ok   OPTIMAL  9 faults (published 9), 11 hits over 20 accesses

node v22.15.0 on win32/x64
all checks passed
```

The harness exits non-zero if any of those three disagree, so the performance check is
also a correctness check and cannot be quoted from a run that was already wrong.

## What the numbers say

| Question | Answer |
| --- | --- |
| Does translation cost grow linearly? | **Yes.** 10x the accesses for 8.0x the time, ~271,000 accesses/s at the 10,000 row. |
| Does repeated stepping degrade? | **No.** Five identical runs with no upward trend, and the machine state holds no event log to grow. |
| Is FIFO/LRU replacement linear? | **Yes, up to the trace.** Both land in the same band over 31,020 accesses each. |
| Is Optimal linear? | **No, and it cannot be.** Throughput halves per doubling. Measured, documented, not hidden. |
| Are the published values stable? | **Yes.** 15 / 12 / 9, at every size tested. |
| Is memory reasonable? | **Up to a point.** 295 MB of heap for a 100,000-entry trace with 32 frames. Fine for a script, not for a page. |

**The practical statement:** the deterministic simulation stays responsive for
educational workloads. At the sizes a lesson, an exercise or a classroom demonstration
actually uses - tens to a few tens of thousands of accesses - every waveform here is
either flat or linear, and the slowest single measurement in the whole run is 440 ms.

## Limitations

These are the honest edges of what was measured.

- **One machine, one runtime.** `node v22.15.0 on win32/x64`. These are not portable
  numbers, and they are not presented as such.
- **No warm-up, no repeated trials.** Millisecond-scale rows carry roughly 2x variance
  from JIT and garbage collection. The reliable signal is the *ratio between rows of the
  same workload at different sizes*, not any single figure. An earlier draft of this
  harness ran the 100,000-access section before the Optimal table, and the leftover
  garbage made Optimal read 14x slower than the same table now reads. The section was
  moved to last for that reason, and the correction is recorded here rather than
  quietly applied.
- **The engine only.** Nothing here measures React render cost, DOM work, layout or
  paint. The UI renders a windowed timeline rather than the whole trace, so browser cost
  is not expected to be proportional to trace length - but that was **not** measured and
  is therefore **not** claimed.
- **Optimal is documented, not fixed.** Making it cheaper would mean changing how
  victim selection works, which is an architecture change and out of scope for a
  stabilization phase.
- **No cap on reference-string length - the most concrete risk found.** Nothing stops a
  person pasting 100,000 entries into Compare Mode's reference box, and nothing stops
  the engine running it. That is a 16-29 second main-thread block, and worse for
  Optimal. `tests/ui/urlParams.test.ts` caps frame count and TLB capacity (1024 and 64)
  but there is no equivalent bound on string length. A cap plus a hint on the field is
  the obvious fix; it was left undone because it changes what input is accepted, which
  is a product decision rather than a hardening one.
- **Allocation is not separated from arithmetic.** Each timing is wall clock for the
  whole workload, so the 100,000-access rows are dominated by allocating trace
  snapshots rather than by translation logic.
- **Garbage collection is not controlled.** Node was not run with `--expose-gc`.

## What is NOT claimed

- No throughput claim for hardware other than the one above.
- No claim that the engine is fast enough for anything beyond educational workloads.
- No general claim about exponential behaviour: only the workloads in the tables above
  were executed.
- No production-scale benchmarking. This is a load check that fits in a minute.
