# Architecture

PAGEFAULT.DEV is an interactive OS / computer-systems learning laboratory. This
document describes the pieces that exist today: the **simulation engine** and the
**MemoryLab UI** built on it, which has three modes - **Learn**, **Experiment** and
**Compare**. Later phases (paging algorithms in the address path, swap, context
switching) are deliberately not built yet - see section 8.

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
UI (ui/)  ──imports──>  engine/          engine/  ──imports──>  nothing
```

Nothing under `engine/` imports React, Zustand, DOM APIs, animation libraries, CSS
or any storage/network API. The engine is pure TypeScript, and the engine's own
type configuration proves it: `tsconfig.json` type-checks `engine/` (plus the Node
tests) with no DOM and no Node type libraries at all. The UI is type-checked
separately (`tsconfig.ui.json`), which is the only config that knows about the DOM.

The one exception is deliberate: the UI's URL helpers use `window.location` and
`window.history`. Those live in `ui/src/lib/url.ts`, import nothing from the engine,
and are the only UI files allowed to touch browser globals.

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

So every step returns a truthful, ordered list of what the simulated hardware did.

The no-TLB path is unchanged from Day 1:

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

With a TLB, the same access takes one of three paths. A hit skips the page table -
that is the entire point of the cache, and it is visible as a shorter event stream:

```
TLB miss (cold), then the usual walk    TLB hit: the short path      TLB miss, page absent
-------------------------------         -----------------------      ----------------------
CPU_MEMORY_ACCESS                       CPU_MEMORY_ACCESS            CPU_MEMORY_ACCESS
VIRTUAL_ADDRESS_GENERATED               VIRTUAL_ADDRESS_GENERATED    VIRTUAL_ADDRESS_GENERATED
ADDRESS_SPLIT                           ADDRESS_SPLIT                ADDRESS_SPLIT
TLB_LOOKUP                              TLB_LOOKUP                   TLB_LOOKUP
TLB_MISS                                TLB_HIT                      TLB_MISS
PAGE_TABLE_LOOKUP                       FRAME_RESOLVED               PAGE_TABLE_LOOKUP
PAGE_TABLE_HIT                          PHYSICAL_ADDRESS_GENERATED   PAGE_FAULT  <- stops
TLB_FILL                                RAM_ACCESS
FRAME_RESOLVED
PHYSICAL_ADDRESS_GENERATED
RAM_ACCESS
```

A machine WITHOUT a TLB emits no TLB event at all and keeps the Day 1 streams
byte-for-byte. Enabling a TLB is a property of the machine (`tlbCapacity` in
`MachineConfig`), never a property of an access, so an instrumented simulator
cannot silently change the behaviour of the simpler machine every existing test was
written against: the TLB can change the PATH of an access, never its outcome.

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
- `TLB_HIT` → light up the TLB column and visibly skip the page table
- `TLB_MISS` → light up the TLB column, then continue to the page table
- `TLB_FILL` → insert the cached row into the TLB panel
- `PAGE_FAULT` → draw the "not resident" state and the explanation for the fault
- `RAM_ACCESS` → mark the touched physical address

The first MemoryLab screen works exactly this way (`ui/src/lib/session.ts`): each
event maps to one pipeline column, and every number painted on screen comes from an
event payload or from engine state handed over whole by `step()`. If a lesson needs
a fact the engine does not emit yet, the fix belongs in the engine (plus a test),
never in a component.

## 5. What exists in the code today

```
engine/
  errors.ts                 typed, code-carrying errors (no silent NaN)
  types/
    memory.ts               addresses, page/frame numbers, page table entries
    events.ts               the Event union (facts only, now TLB-aware)
    actions.ts              the Action union (`ACCESS_ADDRESS`, `INVALIDATE_TLB`)
    machine.ts              MachineState, StepResult, TlbEntry/TlbState
    tlb.ts                  lookup/fill/invalidation result types, eviction policy
    replacement.ts          ReplacementState, the ReplacementEvent union, evidence
  tlb/
    tlb.ts                  lookupTlb(), fillTlb(), invalidateTlbPage() (all pure)
    validation.ts           TLB capacity and entry checks
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
  machine.ts                createMachineState(), step() with the TLB step inside
  presets.ts                example machine, lab machine, reference strings
  index.ts                  the public API surface
scripts/                    developer CLI (`npm run demo`), built by tsconfig.cli.json
  demo.ts                   annotated runs: translation, TLB, replacement, Belady
tests/
  engine/*.test.ts          vitest, plain Node environment
  tlb.test.ts               the 43-test TLB gate: hit/miss, fill, FIFO eviction,
                            invalidation, purity, determinism, no-TLB equivalence
ui/                         the MemoryLab screen (Vite + React + Tailwind)
  index.html                Vite root
  src/
    main.tsx                React entry point (strict mode)
    App.tsx                 layout plus session dispatch; the only file that calls `step()`
    index.css               Tailwind import plus lab-only tokens
    lib/
      session.ts            records, cursor, and the event-fold the UI paints from
      lab.ts                the lab machine factory and address presets
      url.ts                shareable ?address=&pageSize=&tlb= config; the only files
                            that touch window live here
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
| `tlb` | enabled or disabled by config; FIFO fill, eviction, invalidation | ASID/PCID process tags, context-switch flushes |
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

## 7. What this enables (and what Learn Mode already uses)

- **Learn Mode - built (Day 5).** Each event maps to exactly one lesson step. The
  scripted lesson (`ui/src/lib/lesson.ts`) names the engine action to run and the
  event to explain; the screen shows a step only while the engine's own event stream
  satisfies the step's checkpoint, and reports a disagreement instead of smoothing
  it over.
- **Experiment Mode.** Change a value (page size, page table, RAM size), re-run the
  same action list, and diff the resulting events.
- **Compare Mode.** Run two configurations from the same initial state and show the
  event streams side by side; the fault counters in `stats` make the difference
  measurable, not anecdotal.
- **"What if this didn't exist?" — built for the TLB (Day 5).** Because the engine is a small set of pure
  functions, a hypothetical machine with no TLB at all is a
  different engine path producing a different event stream - never a UI special
  case. Learn Mode runs both machines and shows the counted difference.
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
| A TLB that replaces more cleverly than FIFO | FIFO needs no clock and no reference bits; policies that need them wait |
| ASID-tagged or multi-process TLBs, TLB shootdown | Needs a CPU instruction model and per-process state history |
| Context switching, user/kernel mode | Needs a CPU instruction model and per-process state history |
| Instruction execution | Today the CPU issues memory accesses, not instructions |
| Trace My Code / C parser | A source of `ACCESS_ADDRESS` actions, not an engine concern |
| Advanced landing page, final marketing polish | Rendering must not be able to change engine correctness |

## 9. The three screens

The app has three screens, one URL parameter apart: `?mode=learn`,
`?mode=experiment` or `?mode=compare` (and the same as `/lab/learn?...` etc.).
The app shell keeps the active screen in state and writes it back into the URL, so
every screen's current CONFIGURATION is shareable - not its running results.

**Learn Mode** - a scripted, 12-step lesson that runs the engine ONCE through three real
accesses and explains one engine event at a time. Each step names the focused component,
dims the rest, and shows WHAT is happening, WHY, WHY IT IS NECESSARY, and - where it
means something - WHAT WOULD HAPPEN WITHOUT IT. The lesson never decides the hardware's
answer: every page number, offset, frame, physical address, TLB hit/miss and page fault
is read off the events `step()` returned. The physical address for `x` at `0x1345`
resolves to `0x7345` because the lab machine puts page 1 in frame 7 - the lesson states
that number because the engine produced it, not because the script likes it. The TLB
comparison runs the same two-page access once with a TLB and once without, and counts the
real difference (1 page-table walk saved, 1 RAM access shared). The page-fault steps
carry a `forbids` checkpoint: "no frame, no physical address, no RAM access" is checked
against the engine's events, so the lesson cannot quietly invent a frame after a fault.
Navigation: Next, Back, Restart, Play/Pause, a step jump box, and keyboard shortcuts
(→ next, ← back, Space play/pause, R restart) that stay out of the way while the learner
is typing. A step is a shareable link: `?mode=learn&step=4` opens the TLB explanation.

**Experiment Mode** - the MemoryLab from Day 3: a freely configurable machine driven one
action at a time, with the CPU/program pane (address box, read/write, presets, STEp,
PLAY/PAUSE, RESET), the translation pipeline, the state panels (TLB, page table, RAM,
verdict, session counters) and the event log. Machine settings (page size, TLB capacity
or none) rebuild the machine and reset the session. A whole-TLB flush and per-page
invalidate are maintenance actions; the replacement panel runs the same reference string
through the currently selected algorithm.

**Compare Mode** - one reference string through FIFO, LRU and Optimal side by side, with
the textbook answer row (FIFO = 15, LRU = 12, Optimal = 9 for the default string) and a
per-algorithm timeline.

The ONLY thing each screen contributes to the URL is presentation-level configuration:
which screen to open, what sits in the input boxes, and (for Learn) which step to open
on. The engine is never touched by the URL.

## 10. The three screens: events in, pixels out

Every screen shares one rule from section 8: **React renders, the engine decides.** The
engine is the source of truth; the screen is only the lens. What differs is how each
screen paints those events.

### 10.1 The Experiment screen (the free MemoryLab)

One session, three panes, one log. The same session from Day 3, grown up with two
maintenance actions (whole-TLB flush and page unmap) and a replacement panel.

- **Left pane - CPU / Program**: virtual address box (decimal or `0x` hex), read/write
  choice, ACCESS, five address presets (first touch, same page again, peer page, absent
  page, page with no entry), STEP forward/backward through the event stream, PLAY/PAUSE,
  and RESET.
- **Center - translation pipeline**: CPU, Virtual Address, TLB, Page Table, Fill, Frame,
  RAM. Each event lights exactly one column (`ui/src/lib/stages.ts` and
  `ui/src/lib/session.ts`), so a TLB hit visibly skips the page-table column and a fault
  stops at the red one.
- **Right pane - state, taken whole from the engine**: current values read off the latest
  events (page, offset, frame, physical address), TLB slots with ages (`fillOrder`),
  page-table rows with the touched row highlighted, RAM frames with the touched frame
  highlighted, and session counters.
- **Bottom - event log**: every event of the session with its sequence number,
  clickable to jump the cursor there.

Machine settings (page size, TLB capacity or none) live in a small bar above the panes
and rebuild the machine when changed, which resets the session - silently swapping
hardware under a running lesson would be a lie by omission. The replacement panel runs
the currently selected algorithm over the reference string.

For the record: Zustand was considered and deliberately NOT added. The session is one
`useState` record list plus one cursor plus one playing flag; a global store would add a
dependency and a second source of truth to describe three values that already live in
exactly one place.

### 10.2 The Learn screen

The lesson. The engine runs its three real accesses ONCE when the screen opens
(`runLesson`, memoised). Every step is a view of that one deterministic run - never a
fresh guess about what the hardware would do.

Each step names the focused component, dims the rest with `FocusFrame` (`data-dimmed="true"`
when not focused, `ring-1 ring-sky-400/40` when it is), and shows the same kind of engine
facts the Experiment screen shows, but tied to the STEP, not to a free access: page,
offset, frame, physical address, TLB lookup/hit/miss, page-table walk, TLB fill, RAM
access, page fault. The narration card states WHAT, WHY, WHY NECESSARY and (where it means
something) WITHOUT IT. The question card checks understanding. The evidence card counts
real events off the stream to prove a claim (for example, "the second access produced one
TLB_HIT and zero PAGE_TABLE_LOOKUP, so the page table was skipped"). The comparison card
runs two real engine runs and counts the difference. The pipeline column for the focused
stage gets `data-focus="true"` and a connector naming the next station. The timeline shows
the event log filtered to this lesson's three accesses, with the cursor sitting on the event
the lesson is currently explaining. The step counter reads `Step X / 12`, the progress bar
is a real percentage, and the jump box lets the learner type a step number - clamped,
validated, with an inline error if out of range. Nothing on the Learn screen is
hand-written prose pretending to be a number: if the engine and the lesson ever disagree,
the checkpoint shows `checkpoint.ok === false`.

Navigation: Next, Back, Restart, Play/Pause, a step jump box, and keyboard shortcuts
(→ next, ← back, Space play/pause, R restart) that stay out of the way while the learner
is typing. A step is a shareable link: `?mode=learn&step=4` opens the TLB explanation.

### 10.3 The Compare screen

One reference string, three algorithms, one timeline each. The reference string (page
numbers, spaces or commas) and the frame count come from the URL or the defaults.
`runReferenceString()` from `ui/src/lib/compare.ts` calls the engine's shared harness once
per algorithm, so the three columns are three real engine runs side by side. The disputed
cases (pages 4 and 5 of the textbook string) are annotated. The answer row is *derived*,
not typed: it sums the same `PAGE_FAULT` events the engine emitted and formats them, so the
"FIFO = 15, LRU = 12, Optimal = 9" row only stays green as long as the engine keeps
producing those numbers.

### 10.4 What each typecheck pass proves

| pass | what it checks | the guarantee |
| --- | --- | --- |
| `tsc -p tsconfig.json` | `engine/`, `tests/` - with no DOM and no Node types | the engine cannot touch the UI's world, even by accident |
| `tsc -p tsconfig.cli.json --noEmit` | `engine/` + `scripts/` with Node types | the CLI build still compiles and prints |
| `tsc -p tsconfig.ui.json` | `ui/` + `engine/` with DOM types, JSX and Vite clients | the screen compiles; engine purity is still guarded by the first pass |

### 10.5 What the URL carries

The lab screen reads its starting configuration from the address bar and writes it
back whenever it changes, so any configuration is a link:

```
?mode=experiment&address=0x1345&access=read&pageSize=4096&tlb=4&frames=16&algo=FIFO
?mode=compare&ref=7%200%201%202&frames=3
?mode=learn&step=4
```

`tlb=none` builds the machine WITHOUT a TLB, so the Day 1 path (no TLB events, page
table on every access) is one link away from the equipped path. A lesson step is a
shareable link: `?mode=learn&step=4` opens the TLB explanation, and the address bar
follows the lesson as it moves. Invalid values fall back to the defaults; the engine
still validates every access it is asked to run.

