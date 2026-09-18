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
    replacement.ts          ReplacementState, the ReplacementEvent union, evidence
  memory/
    validation.ts           input checks, shared by every memory function
    translateAddress.ts     virtual address -> page number + offset
    physicalAddress.ts      frame number + offset -> physical address
    pageTable.ts            page table construction and lookup (hit / fault)
  replacement/
    algorithms.ts           the policies: FIFO, LRU, Optimal (pure victim choice)
    state.ts                createReplacementState(), stepReplacement()
    referenceString.ts      the harness: runReferenceString() over a whole string
    validation.ts           algorithm, frame-count and reference-string checks
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
| `memory` | frames + which page owns them | the replacement harness drives frame churn |
| `swap` | disabled, empty slots | evicted pages living on disk |
| `stats` | deterministic counters | fault rates, hit rates for comparison |
| `sequence` | event numbering | timeline / replay positions |

One deliberate deviation from a flat reading of the spec: the page table lives
inside `state.process` rather than at the top level, because a page table belongs to
a process (in hardware terms the MMU points at the *current* process' tables). This
keeps context switching a matter of swapping `state.process`, not of untangling two
copies of the same data.

## 6. Page replacement: a second, higher abstraction

Translation and replacement answer different questions, so they get different
functions and different state:

```
Day 1 (address level)        Day 2 (page-number level)
----------------------       --------------------------
step(state, action)          stepReplacement(replacementState, request)
"virtual address 0x3064"     "the CPU now touches page 3"
splits, looks up, faults     hits, or faults and then MUST resolve the fault
Event union                  ReplacementEvent union
```

The replacement harness is handed page *numbers* and nothing else. There is no
address, no offset and no page table in it, because a textbook reference-string
exercise is exactly that: a list of page numbers and a frame count. Keeping the
levels apart is what let Day 2 be added without editing a single Day 1 test: the
Day 1 `Event` union is untouched, and the new `ReplacementEvent` union lives beside
it.

### Time is an access index, never a clock

FIFO needs to know when a page was loaded; LRU needs to know when it was last used.
Both take that ordering from the **position in the reference string** (`0`, `1`,
`2`, ...), never from `Date.now()`. A clock would make replays, traces and tests
nondeterministic, and wall-clock time is not simulated time. Every frame therefore
carries:

| field | meaning | who reads it |
| --- | --- | --- |
| `loadedAt` | access index at which the page entered this frame | FIFO (and nothing else) |
| `lastUsedAt` | access index of the most recent load **or** hit | LRU (and nothing else) |
| `useCount` | hits served since the page was loaded | the UI/tests, for explanation |

The consequence is visible in the events: a hit refreshes `lastUsedAt` but must
**not** touch `loadedAt`. That single sentence is the entire difference between LRU
and FIFO, and it is pinned down by a test that runs the same string through both
algorithms and asserts that their frames are identical while their victims differ.

### Every fault is resolved, and the decision carries its evidence

Day 1's `PAGE_FAULT` deliberately stops translation. In the replacement harness a
fault is always followed by the work that removes it, so one faulting access
produces:

```
PAGE_FAULT              <- the page is not resident; how many frames are still free?
REPLACEMENT_DECISION    <- only when RAM is full: which victim, and WHY
EVICT_PAGE              <- only when RAM is full: the victim leaves its frame
LOAD_PAGE               <- the faulting page is now resident
```

`REPLACEMENT_DECISION` does not carry a sentence, it carries structured
`evidence` - for FIFO the victim's `loadedAt`, for LRU its `lastUsedAt`, for
Optimal the victim's next use in the lookahead. The demo prints those numbers, and
a future UI can highlight the exact value that decided the eviction instead of
asserting a claim the engine never made.

Optimal is the only algorithm that needs the future, so it is the only one the
request type offers `futureUses` to. The string harness passes a copy of the
remaining references (`slice`, not a view) so the lookahead cannot alias a caller's
array. FIFO and LRU ignore the field entirely.

Tie-breaking is deterministic everywhere: when two frames are equally valid
victims, **the lowest frame number wins**. Without that rule a correct
implementation of "evict the oldest" could still return a different frame each run,
and neither the tests nor Compare Mode would mean anything.

### What the harness returns

`runReferenceString(algorithm, referenceString, frameCount)` loops over
`stepReplacement()` and returns one value containing everything a lesson needs:

- the **counts**: `accesses`, `hits`, `pageFaults`, `loads`, `evictions`;
- the **trace**: one entry per access, each with the frame contents *after* that
  access - this is what a visualization scrubs through;
- the **events**: the whole ordered stream, numbered from `0`;
- `initialFrames` / `finalFrames`, so a run can be diffed against another.

The invariants the tests enforce (`accesses = hits + faults`, `loads = faults`,
resident pages are always distinct, every `EVICT_PAGE` removes a page that was
really resident, and `evictions` equals the number of faults that found RAM full)
are what make the counts trustworthy rather than merely self-consistent.

## 7. What this enables later

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
- **Replacement labs.** Because `runReferenceString()` returns a trace and a full
  event stream, a lesson can step through an eviction decision, show the evidence
  that produced the victim, and compare policies on one string - including Belady's
  anomaly, which is nothing more than two runs of the same string with 3 and 4
  frames.

## 8. Deliberately not implemented yet

Each of these is left out on purpose so that this phase stays reviewable. None of
them require the architecture to change - they need new events and new pure
functions:

| Not implemented | Why it waits |
| --- | --- |
| Fault *handling* (disk read, kernel transition) | Today the engine must only *detect* a fault truthfully |
| Evicted pages going anywhere | Replacement picks a victim and drops it; nothing writes it to a backing store yet |
| Swap / disk | Only meaningful once an evicted page has somewhere to go |
| Second-chance / Clock, LFU, MFU | The policy seam exists (`REPLACEMENT_ALGORITHMS`, `chooseVictim`), no policy is invented without its own reference values |
| The replacement harness driving the machine's frames | The page-number harness and the address-level machine are still separate levels |
| TLB | A cache of translations; must not exist before translation itself is trusted |
| Context switching, user/kernel mode | Needs a CPU instruction model and per-process state history |
| Instruction execution | Today the CPU issues memory accesses, not instructions |
| Trace My Code / C parser | A source of `ACCESS_ADDRESS` actions, not an engine concern |
| Any UI (landing page, Learn Mode, animations) | Rendering must not be able to change engine correctness |

## 9. How to run the engine

```
npm install
npm test          # vitest, plain Node environment
npm run typecheck # engine type-checked without Node or DOM libs, plus the CLI build
npm run demo      # compiles and prints an annotated run of the example machine
```

There is no dev server, no bundler configuration and no UI in this phase, by design.

