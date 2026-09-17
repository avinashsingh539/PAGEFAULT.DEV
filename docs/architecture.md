# Architecture

PAGEFAULT.DEV is an interactive OS / computer-systems learning laboratory. This
document describes the piece that exists today: the **simulation engine**. The
teaching UI described elsewhere in the project vision is intentionally **not**
built yet.

## 1. Why the engine is separated from the UI

The engine answers a purely mechanical question: *given this machine state and this
action, what does the computer actually do?* The UI answers a different question:
*how do we show that to a student?*

Mixing them would make correctness depend on rendering. Keeping them apart means:

- the engine can be tested in plain Node (`vitest`, no browser, no jsdom);
- every explanation shown later is derived from the same computation the tests pin
  down, instead of from a second, parallel implementation inside components;
- the rendering technology can change (or be replaced entirely) without touching a
  line of OS logic.

The rule is enforced by dependency direction:

```
UI (future)  ──imports──>  engine/          engine/  ──imports──>  nothing
```

Nothing under `engine/` imports React, Zustand, DOM APIs, animation libraries, CSS
or any storage/network API. The engine is pure TypeScript.

## 2. Why `step()` is pure

```
step(state: MachineState, action: Action): { state: MachineState; events: Event[] }
```

`step()` never mutates the state it receives; it returns a new state plus the events
that explain the transition. It also never reads:

- `Date.now()` / timers - "when" is irrelevant to the simulated hardware,
- `Math.random()` - nondeterminism would make teaching, replay and testing lie,
- module-level mutable variables - state lives in `MachineState`, nowhere else,
- the environment (DOM, filesystem, network).

Purity buys three things the product needs:

1. **Reproducibility.** The same action on the same state always yields the same
   events. A student sees the same thing on every replay.
2. **Testability.** No fixtures, no mocking, no setup - just values in, values out.
3. **Time travel / replay.** Because states are values and transitions are pure,
   the app can keep the action history, re-run it, step backwards and forwards, and
   compare two divergent runs (Compare Mode) without special engine support.

Event numbering is deterministic too: each event carries a `sequence` number taken
from `state.sequence`, which only ever increments - never from a clock.

## 3. Why the engine returns events

State tells you *where you ended up*; events tell you *what happened on the way*.
The teaching philosophy of the project is about the "on the way": WHAT happened, WHY
it was necessary, WHAT problem it solved, WHAT would break without it.

So every step returns a truthful, ordered list of what the simulated hardware did:

```
successful access                     faulting access
-----------------                     ---------------
CPU_MEMORY_ACCESS                     CPU_MEMORY_ACCESS
VIRTUAL_ADDRESS_GENERATED             VIRTUAL_ADDRESS_GENERATED
ADDRESS_SPLIT                         ADDRESS_SPLIT
PAGE_TABLE_LOOKUP                     PAGE_TABLE_LOOKUP
PAGE_TABLE_HIT                        PAGE_FAULT          <- translation stops
FRAME_RESOLVED
PHYSICAL_ADDRESS_GENERATED
RAM_ACCESS
```

Two properties matter here:

- **Events describe the machine, not the screen.** `ADDRESS_SPLIT` with
  `{ pageNumber: 18, offset: 837 }` is an event; `SHOW_GREEN_BOX`, `ANIMATE_ARROW`
  or `DISPLAY_TEXT` are not. Presentation is the UI's job, and it can only be
  correct if the engine refuses to know about it.
- **Events are the boundary of truth.** On a page fault there is deliberately no
  frame, no physical address and no `RAM_ACCESS` event: the engine never pretends a
  failed translation succeeded.
## 4. Why the UI will render events rather than contain OS logic

A component that decides "this page faulted, so I should show a red box" is a second
implementation of the OS. Such an implementation drifts from the engine, then the
tests pass while the product lies. So the future UI is a pure function of events:

```
events (facts)  ──map──>  visual state  ──render──>  pixels
```

Concretely, later UI code should look like this and nothing more:

- `PAGE_TABLE_LOOKUP` → highlight the page-table row for `pageNumber`
- `PAGE_TABLE_HIT` → draw the arrow page table → frame `frameNumber`
- `PAGE_FAULT` → draw the "not resident" state and the explanation for the fault
- `RAM_ACCESS` → mark the touched physical address

If a lesson needs a fact the engine does not emit yet, the fix belongs in the
engine (plus a test), never in a component.

## 5. What exists in the code today

```
engine/
  errors.ts                 typed, code-carrying errors (no silent NaN)
  types/
    memory.ts               addresses, page/frame numbers, page table entries
    events.ts               the Event union (facts only)
    actions.ts              the Action union (today: ACCESS_ADDRESS)
    machine.ts              MachineState, StepResult, placeholders for the future
  memory/
    validation.ts           input checks, shared by every memory function
    translateAddress.ts     virtual address -> page number + offset
    physicalAddress.ts      frame number + offset -> physical address
    pageTable.ts            page table construction and lookup (hit / fault)
  machine.ts                createMachineState(), step()
  presets.ts                the documented example machine used by docs, demo, tests
  index.ts                  the public API surface
scripts/
  demo.ts                   developer CLI (`npm run demo`), not the UI
tests/
  engine/*.test.ts          vitest, plain Node environment
docs/
  architecture.md           this file
  reference-values.md       hand-calculated values used by the tests
```

`MachineState` has the shape the future lessons need, with today's behaviour kept
small:

| field | today | later |
| --- | --- | --- |
| `cpu` | `mode: "user"`, `pendingFault` | kernel/user transitions, context switches |
| `process` | pid, name, page table, address-space size | multiple processes |
| `tlb` | disabled, empty entries | TLB lookup, hits, misses, flushing |
| `memory` | frames + which page owns them | replacement algorithms mutate frames |
| `swap` | disabled, empty slots | evicted pages living on disk |
| `stats` | deterministic counters | fault rates, hit rates for comparison |
| `sequence` | event numbering | timeline / replay positions |

One deliberate deviation from a flat reading of the spec: the page table lives
inside `state.process` rather than at the top level, because a page table belongs to
a process (in hardware terms the MMU points at the *current* process' tables). This
keeps context switching a matter of swapping `state.process`, not of untangling two
copies of the same data.

## 6. What this enables later

- **Learn Mode.** Each event maps to exactly one lesson step. An explanation panel
  is data keyed by event type and payload (`ADDRESS_SPLIT` → "the page number is
  the high part of the address..."), so a lesson never guesses.
- **Experiment Mode.** Change a value (page size, page table, RAM size), re-run the
  same action list, and diff the resulting events.
- **Compare Mode.** Run two configurations from the same initial state and show the
  event streams side by side; the fault counters in `stats` make the difference
  measurable, not anecdotal.
- **"What if this didn't exist?"** Because the engine is a small set of pure
  functions, a hypothetical machine (for example: no page table at all) is a
  different engine path producing a different event stream - never a UI special
  case.
- **Trace My Code.** Compiled or hand-written instruction traces can be replayed as
  `ACCESS_ADDRESS` actions; the engine already answers truthfully for every address.
- **Replay / time travel.** States are values and transitions are pure, so history
  is just the list of actions sent, and scrubbing is re-running a prefix. Event
  `sequence` numbers make the timeline stable.
## 7. Deliberately not implemented yet

Each of these is left out on purpose so that this phase stays reviewable. None of
them require the architecture to change - they need new events and new pure
functions:

| Not implemented | Why it waits |
| --- | --- |
| Fault *handling* (disk read, kernel transition) | Today the engine must only *detect* a fault truthfully |
| Page replacement (FIFO / LRU / Optimal) | Needs a frame-eviction model and textbook reference values |
| Swap / disk | Only meaningful once something evicts a page |
| TLB | A cache of translations; must not exist before translation itself is trusted |
| Context switching, user/kernel mode | Needs a CPU instruction model and per-process state history |
| Instruction execution | Today the CPU issues memory accesses, not instructions |
| Trace My Code / C parser | A source of `ACCESS_ADDRESS` actions, not an engine concern |
| Any UI (landing page, Learn Mode, animations) | Rendering must not be able to change engine correctness |

## 8. How to run the engine

```
npm install
npm test          # vitest, plain Node environment
npm run typecheck # engine type-checked without Node or DOM libs, plus the CLI build
npm run demo      # compiles and prints an annotated run of the example machine
```

There is no dev server, no bundler configuration and no UI in this phase, by design.

