# PAGEFAULT.DEV

An interactive OS / computer-systems learning laboratory.

Long term, students will visually explore virtual memory, paging, the TLB, page
faults, page replacement, context switching, user/kernel mode and "Trace My Code" -
each step answering *what* happens, *why* it is necessary, *what problem it solves*
and *what would break without it*.

**Current status: the translation engine, the replacement harness, and the MemoryLab
screen with three modes - Learn, Experiment and Compare.** `npm run dev` opens the
visual lab; the engine stays UI-independent and fully tested in plain Node.

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

## The TLB in one line

```ts
const lab = createLabMachine(); // 4-entry TLB on top of a richer page table
const first = step(lab, { type: "ACCESS_ADDRESS", address: 0x1345 });
first.events.map((event) => event.type); // [..., "TLB_LOOKUP", "TLB_MISS", "PAGE_TABLE_LOOKUP", "PAGE_TABLE_HIT", "TLB_FILL", ...]

const again = step(first.state, { type: "ACCESS_ADDRESS", address: 0x1345 });
again.events.map((event) => event.type); // [..., "TLB_LOOKUP", "TLB_HIT", ...] - the page table is skipped
```

A machine built *without* a TLB (`createMachineState` with no `tlbCapacity`) emits
no TLB event at all and keeps the Day 1 event streams byte-for-byte.

## The MemoryLab screen

```
npm run dev     # http://localhost:5173
npm run build   # type-check, then bundle into dist/
```

Three modes, one URL parameter apart: `?mode=learn`, `?mode=experiment` or
`?mode=compare` (also `/lab/learn?...` etc.). What survives a switch is each
screen's shareable CONFIGURATION, written back into the URL by the app shell.

**Learn** - a 12-step guided lesson. The engine runs three real memory accesses
through `step()` once, then the lesson walks the learner through the resulting
events one at a time: virtual address, address split, TLB lookup, page table,
TLB fill, physical address, RAM, and the page fault. Each step names the focused
component, dims the rest, and states WHAT is happening, WHY, WHY IT IS NECESSARY,
and - where it means something - WHAT WOULD HAPPEN WITHOUT IT. The lesson never
invents numbers: every page, offset, frame, physical address, TLB hit/miss and
page fault is read off the engine's events. A step is a shareable link:
`?mode=learn&step=4` opens the TLB explanation. Navigation: Next, Back,
Restart, Play/Pause, a step jump box, and keyboard shortcuts (→ next, ← back,
Space play/pause, R restart) that stay out of the way inside text fields.

**Experiment** - the freer MemoryLab: CPU → virtual address → TLB → page table →
frame → RAM, under the learner's own control. Pick any address, read or write,
STEP through the event stream, PLAY/PAUSE, RESET, rebuild the machine (page size,
TLB capacity or none), invalidate a cached page, and run the replacement panel
through the currently selected algorithm.

**Compare** - one reference string through FIFO, LRU and Optimal side by side.
The classic `7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1` with 3 frames produces
FIFO = 15, LRU = 12, Optimal = 9, with a per-algorithm timeline and the
disputed cases annotated.

In every mode the engine remains the source of truth: React renders events, the
engine decides what happened.

## Non-negotiables

- `engine/` is pure TypeScript: no React, no Zustand, no DOM, no CSS, no animations.
- No `Date.now()`, no `Math.random()`, no global mutable state in the engine.
- Events describe what the simulated computer did, never how to draw it.
- OS logic never lives in a component.

## Layout

```
engine/     the UI-independent simulation engine (types, memory, tlb, machine, step)
scripts/    developer CLI that prints an annotated run (`npm run demo`)
tests/      vitest suites, plain Node environment
ui/         the MemoryLab screen (Vite + React + Tailwind, imports engine only)
docs/       architecture.md, reference-values.md
```

## Commands

```
npm install
npm test           # unit tests (engine only, plain Node)
npm run typecheck  # three passes: DOM-free engine proof, CLI build, UI build
npm run demo       # readable event traces: translation, TLB, replacement, Belady
npm run dev        # the MemoryLab screen on http://localhost:5173
npm run build      # type-check the UI, then bundle it into dist/
npm run preview    # serve the production bundle locally
```

## Docs

- [`docs/architecture.md`](docs/architecture.md) - why the engine is separate from
  the UI, why `step()` is pure, why events, what the TLB is and is not, how the
  MemoryLab screen paints events, and what that enables later.
- [`docs/reference-values.md`](docs/reference-values.md) - every hand-calculated
  address translation, translation event sequence (with and without a TLB) and
  page-replacement fault count used by the tests.
