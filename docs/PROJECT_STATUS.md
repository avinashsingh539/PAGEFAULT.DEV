# PAGEFAULT.DEV — Project Status (source of truth for agent handoffs)

> Product vision: PAGEFAULT.DEV is exclusively an **interactive virtual-memory laboratory**, not a tutorial/article site.
> It shows what happens between a program accessing a virtual address and the resulting access to physical RAM.
> Differentiator: make hidden memory mechanisms **observable and experimentally verifiable**.
> Motto: **"Don't just learn how computers work. Watch memory work."**
> Users observe execution, control inputs, change configuration, inspect internal state, and compare outcomes.

## Scope
**In scope:**
- Virtual addresses, address splitting, and physical-address translation.
- Page tables and virtual-page → physical-frame mappings.
- TLB lookups, hits, misses, and invalidation.
- Physical RAM frames, page faults, and memory allocation behavior.
- FIFO, LRU, and Optimal page replacement.
- Interactive memory experiments, deterministic replay, and comparisons.
- Guided, engine-driven memory demonstrations.

**Out of scope:** networking, CIDR, CPU scheduling, or unrelated laboratories. PAGEFAULT.DEV is **not** a general-purpose computer-science learning platform.

## Architectural principles (must not be violated)
- **Engine is UI-independent.** `engine/` is pure, deterministic TypeScript. No React, DOM, Zustand, `window`/`document`, animations, or UI logic. UI consumes `step(state, action) -> { state, events }` only.
- **Determinism.** No `Date.now()`, `Math.random()`, or global mutable state in the engine. Same input => identical events/state. Enables replay, sharing, and reproducible experiments.
- **No OS logic in React.** The UI renders engine facts; it never recomputes page numbers, TLB hits, faults, or physical addresses.
- Reuse design tokens/components; avoid new dependencies and speculative refactors.

## Current branch / verified state
- Branch: `main`
- Latest verified commit: `517dfaf` — `fix(lab): stop the mobile transport bar from overflowing the page` (committed locally, not pushed, per task instructions; `origin/main` still at `7ac543c`)
- Remote: `https://github.com/avinashsingh539/PAGEFAULT.DEV.git`
- Last verified gates (Task 4 run): `check:purity` **PASS**, `typecheck` **0 errors** (3 configs), `npm test` **348/348 (19 files)**, `npm run build` **pass**, Playwright **58/58 (full suite, incl. new `e2e/responsive.spec.ts`)**. (One parallel-load flake on `experiment.spec` `#frameCount` in the first full run; passed in isolation 1.5s and in the full re-run — environmental, not a regression.)

## Completed tasks (concise)
- **Days 1-6 (engine + CI/deploy):** virtual-memory translation engine; FIFO/LRU/Optimal; TLB; Experiment & Compare modes; Learn mode; GitHub Actions CI; docs (architecture, deployment, performance, reference-values, test-matrix).
- **UI redesign:** Tailwind v4 token layer (Inter/Manrope + JetBrains Mono), light surfaces, `MemoryPipeline` + node components, `eventPresentation.ts` (read-only, exhaustive over all event types).
- **Lab redesign:** controls / pipeline / explanation; empty state; presets; Beginner / Technical modes.
- **Landing (7 sections):** hero concept flow, proof strip, "What You'll Learn", learning path, interactive "Try It Now", Students/Developers, CTA.
- **Visual differentiation (12.5 A-D):** Hero = *introduce*; Try It Now = *operate*; Learn = *explain* (`LessonDiagram` + "Technical details"); Lab dark Replacement panel restyled to light tokens.
- **Task 2 — Lab clarity (`172f2b4`):** the Lab empty state tells a first-time user *what to watch* (the virtual→physical journey; first access falls through the TLB to the page table, a repeat is served by the TLB). Copy-only; verified purity/typecheck/343 unit/17 e2e/build green.
- **Task 3 — access narration (`972fba2`):** the Lab result column now explains each access as a whole journey. New DOM-free `ui/src/lib/accessNarration.ts` (`summarizeAccess`) reads the record's real events and returns outcome-first narration (RAM address or page fault) plus ordered steps (CPU request → address split → TLB hit/miss → page-table hit → translated to RAM / page fault), quoting only event payloads and `presentEvent` phrasing. New `ui/src/screens/lab/LabNarration.tsx` card ("What did this access do?") renders it above the unchanged per-event `EventExplanation`; null for maintenance/invalidation records. 5 new unit tests (miss→RAM, TLB-hit skips page table, fault stops with no RAM step, null for empty events, determinism). Visual check desktop 1440 + narrow 390 confirmed all three outcome cards. **Found (pre-existing, out of scope): `/lab` has horizontal overflow at 390px caused by the mobile transport bar (Beginner/Technical row does not wrap) — present at page load before any access; see Known issues.**
- **Task 4 — mobile overflow fix (`517dfaf`):** the sticky mobile transport row lacked `flex-wrap` (the desktop row had it), so the Beginner/Technical group pushed `/lab` to `scrollWidth=515` at `innerWidth=390`. Fix: the transport row and its button cluster now always wrap; desktop classes unchanged; `compact` still accepted for API stability but no longer changes rendering. New permanent regression `e2e/responsive.spec.ts` asserts `scrollWidth <= innerWidth` at 390px (fresh and post-access) and that every `detail-*` instance (the transport mounts twice) stays inside the viewport. Measured 390→390 and 1280→1280; screenshots inspected at both widths. Gates: purity PASS, typecheck 0, 348/348 unit, build pass, 58/58 e2e.


## Current routes and purpose
| Route | Purpose |
|---|---|
| `/` | Landing — introduce the lab, live concept flow, interactive Try It Now |
| `/learn` | Learn index (6 modules) -> guided lesson (`?step=N`, deep-linkable) |
| `/lab` | Memory Lab — operate the machine (query state: `pageSize`, `tlbCapacity`, `frameCount`, `algorithm`; legacy `?mode=`) |
| `/compare` | Compare — same reference string through FIFO/LRU/Optimal |

## Key files / reusable components
- Engine: `engine/` (machine, tlb, replacement, memory, types) — untouched by UI work.
- Routing: `ui/src/lib/routes.ts`, `ui/src/App.tsx`.
- Screens: `ui/src/screens/LandingScreen.tsx`; `LearnScreen.tsx` + `screens/learn/LearnModuleIndex.tsx`; `screens/ExperimentScreen.tsx` (Lab) + `screens/lab/*`; `CompareScreen.tsx` + `screens/compare/*`.
- Viz: `ui/src/design/viz/*` (`MemoryPipeline`, `NodeShell`, `nodes.tsx`, `EventExplanation`, `EventTimeline`, `LessonDiagram`).
- Design system: `ui/src/design/*` (`primitives.tsx`, `feedback.tsx`, `AppShell.tsx`, `TopNav.tsx`, `SiteFooter.tsx`, `motion.ts`).
- Libs (DOM-free, unit-tested): `ui/src/lib/labView.ts`, `session.ts`, `lesson.ts`, `stages.ts`, `compare.ts`, `experiment.ts`, `fields.ts`, `eventPresentation.ts`.

## Test commands (npm scripts)
- `npm run check:purity` — engine has no UI/DOM/react.
- `npm run typecheck` — engine (DOM-free) + CLI + UI configs.
- `npm test` — Vitest unit/integration.
- `npm run e2e` — Playwright (learn, experiment, compare, hardening, landing).
- `npm run build` — production build.
- `npm run demo`, `npm run bench` — CLI/debug + performance.


## Audit findings (product direction)
**Already supports the vision:** Lab (control inputs + inspect state + observe TLB hit/miss/fault); Compare (experiment with consequences of RAM pressure); deterministic, shareable, event-driven engine.

**Feels generic:** Learn index is a static module grid; the lesson is a fixed narrative that *explains* more than it lets the user *operate*; Landing's "What You'll Learn"/"Learning Path" are conventional course-site furniture; no hypothesis-testing / knowledge checks.

## Recommended roadmap (staged) — virtual memory only
1. **Deepen the Memory Lab:** live config re-run, timeline scrub/replay, shareable experiment URL (partly present), keyboard-driven operation, knowledge-check hooks.
2. **Turn Learn modules into guided interactive experiments** (start with TLB), not article pages.
3. **Landing leads with interactivity** — change a setting, watch faults change.
4. Scope is fixed to virtual memory; do not add CPU scheduling, CIDR, or other unrelated labs.

## Next task (recommended)
**Timeline scrub / replay in the Lab** (roadmap item 1): let the learner drag or click through the event timeline so the pipeline shows the machine state at any past access, reusing `session.viewForCursor` (already the source of the Step cursor). No engine change; existing Step/Play/Reset preserved.
Acceptance criteria: scrubbing to a past event reproduces exactly the same pipeline/explanation the Step cursor showed for that event; forward and backward both work; URL state preserved; `check:purity`, `typecheck`, `test`, `e2e`, `build` all green; record the real commit hash here.

## Known issues / deferred work
- **Known: `/lab` horizontal overflow at 360px** (pre-existing, distinct from the fixed 390px transport issue): the Lab content column has an intrinsic minimum of ~334px (sections 368px incl. padding/border) inside a 320px grid cell → `scrollWidth=388` at `innerWidth=360`. Measured during Task 4; the transport bar is NOT the cause at this width. Deferred — out of Task 4's 390px acceptance scope; candidate follow-up if 360px support is prioritized.
- Concept "article pages" deliberately **not** built (vision is interactive, not article-based).
- Dead dark components remain (`ConfigPanel.tsx`, `ModeNav.tsx`) — unmounted, unreferenced; safe to delete later.
- Deployment intentionally not wired to a live host (recipe in `docs/deployment.md`).
- Page-fault *handling* (disk/swap, kernel) intentionally out of scope — detection only.

## Handoff (update this after every completed task)
This file is the source of truth for agent handoffs. After each completed task, update: changes, verification results (`check:purity`, `typecheck`, `test`, `e2e`, `build`), the real commit hash, and the next task. Never claim a task or test is complete without running it, and never invent commit hashes or test results.

**Next task (proposed):** timeline scrub / replay in the Lab — see "Next task" above for acceptance criteria.
