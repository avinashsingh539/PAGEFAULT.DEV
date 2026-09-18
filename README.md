# PAGEFAULT.DEV

An interactive OS / computer-systems learning laboratory.

Long term, students will visually explore virtual memory, paging, the TLB, page
faults, page replacement, context switching, user/kernel mode and "Trace My Code" -
each step answering *what* happens, *why* it is necessary, *what problem it solves*
and *what would break without it*.

**Current status: the simulation engine only.** There is no UI, no landing page and
no animations in this phase, on purpose.

## The engine in one line

```ts
const { state, events } = step(machineState, { type: "ACCESS_ADDRESS", address: 0x12345 });
```

A pure function takes a machine state and an action, and returns the next state plus
the ordered, factual list of events that explain it:

```
CPU_MEMORY_ACCESS -> VIRTUAL_ADDRESS_GENERATED -> ADDRESS_SPLIT -> PAGE_TABLE_LOOKUP
                  -> PAGE_TABLE_HIT -> FRAME_RESOLVED -> PHYSICAL_ADDRESS_GENERATED -> RAM_ACCESS
```

or, when the page is not in RAM:

```
CPU_MEMORY_ACCESS -> VIRTUAL_ADDRESS_GENERATED -> ADDRESS_SPLIT -> PAGE_TABLE_LOOKUP -> PAGE_FAULT
```

## Page replacement in one line

```ts
const run = runReferenceString("FIFO", [7, 0, 1, 2], 3);
run.pageFaults; // 4 - three frames cannot hold four pages
run.trace[3].evicted; // { pageNumber: 7, frameNumber: 0 } - FIFO removes the oldest load
```

FIFO, LRU and Optimal run over a reference string (page numbers, no addresses) and
report the counts, the per-access trace and the events that justify every eviction:

```
PAGE_FAULT -> REPLACEMENT_DECISION -> EVICT_PAGE -> LOAD_PAGE
```

The published textbook strings and their fault counts are in
[`docs/reference-values.md`](docs/reference-values.md).

## Non-negotiables

- `engine/` is pure TypeScript: no React, no Zustand, no DOM, no CSS, no animations.
- No `Date.now()`, no `Math.random()`, no global mutable state in the engine.
- Events describe what the simulated computer did, never how to draw it.
- OS logic never lives in a component.

## Layout

```
engine/     the UI-independent simulation engine (types, memory, machine, step)
scripts/    developer CLI that prints an annotated run (`npm run demo`)
tests/      vitest suites, plain Node environment
docs/       architecture.md, reference-values.md
```

## Commands

```
npm install
npm test           # unit tests
npm run typecheck  # engine type-checked without Node/DOM libs + CLI build check
npm run demo       # readable event trace of the example machine
```

## Docs

- [`docs/architecture.md`](docs/architecture.md) - why the engine is separate from
  the UI, why `step()` is pure, why events, and what that enables later.
- [`docs/reference-values.md`](docs/reference-values.md) - every hand-calculated
  address translation and page-replacement fault count used by the tests.
