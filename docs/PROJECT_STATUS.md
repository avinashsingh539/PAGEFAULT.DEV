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
- Latest verified commit: `972fba2` — `feat: narrate each Lab access from its engine events` (not pushed, per task instructions)
- Remote: `https://github.com/avinashsingh539/PAGEFAULT.DEV.git`
- Last verified gates (Task 3 run): `check:purity` **PASS**, `typecheck` **0 errors** (3 configs), `npm test` **348/348 (19 files)** (343 previous + 5 new narration tests), `npm run build` **pass** (401.77 kB JS / 45.91 kB CSS), Playwright **57/57 (full suite)**.

## Completed tasks (concise)
- **Days 1-6 (engine + CI/deploy):** virtual-memory translation engine; FIFO/LRU/Optimal; TLB; Experiment & Compare modes; Learn mode; GitHub Actions CI; docs (architecture, deployment, performance, reference-values, test-matrix).
- **UI redesign:** Tailwind v4 token layer (Inter/Manrope + JetBrains Mono), light surfaces, `MemoryPipeline` + node components, `eventPresentation.ts` (read-only, exhaustive over all event types).
- **Lab redesign:** controls / pipeline / explanation; empty state; presets; Beginner / Technical modes.
- **Landing (7 sections):** hero concept flow, proof strip, "What You'll Learn", learning path, interactive "Try It Now", Students/Developers, CTA.
- **Visual differentiation (12.5 A-D):** Hero = *introduce*; Try It Now = *operate*; Learn = *explain* (`LessonDiagram` + "Technical details"); Lab dark Replacement panel restyled to light tokens.
- **Task 2 — Lab clarity (`172f2b4`):** the Lab empty state tells a first-time user *what to watch* (the virtual→physical journey; first access falls through the TLB to the page table, a repeat is served by the TLB). Copy-only; verified purity/typecheck/343 unit/17 e2e/build green.
- **Task 3 — access narration (`972fba2`):** the Lab result column now explains each access as a whole journey. New DOM-free `ui/src/lib/accessNarration.ts` (`summarizeAccess`) reads the record's real events and returns outcome-first narration (RAM address or page fault) plus ordered steps (CPU request → address split → TLB hit/miss → page-table hit → translated to RAM / page fault), quoting only event payloads and `presentEvent` phrasing. New `ui/src/screens/lab/LabNarration.tsx` card ("What did this access do?") renders it above the unchanged per-event `EventExplanation`; null for maintenance/invalidation records. 5 new unit tests (miss→RAM, TLB-hit skips page table, fault stops with no RAM step, null for empty events, determinism). Visual check desktop 1440 + narrow 390 confirmed all three outcome cards. **Found (pre-existing, out of scope): `/lab` has horizontal overflow at 390px caused by the mobile transport bar (Beginner/Technical row does not wrap) — present at page load before any access; see Known issues.**


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
**Fix the pre-existing `/lab` mobile overflow** (discovered and verified during Task 3): make the transport bar's controls wrap or collapse at narrow viewports so `scrollWidth === clientWidth` at 390px, without changing any control's function or test IDs.
Acceptance criteria: at 390px `/lab/experiment` has no horizontal overflow at load and after accesses; all existing test IDs/interactions preserved; **no engine change**; `check:purity`, `typecheck`, `test`, `e2e`, `build` all green; record the real commit hash here. Then return to the timeline-scrub roadmap item below.

## Known issues / deferred work
- **Pre-existing: `/lab` horizontal overflow at 390px** — the mobile transport bar's Beginner/Technical group does not wrap (`scrollWidth` 515 vs 390 at page load, before any access). Verified present without the Task 3 card; culprits are the transport buttons only. Not caused by Task 3.
- Concept "article pages" deliberately **not** built (vision is interactive, not article-based).
- Dead dark components remain (`ConfigPanel.tsx`, `ModeNav.tsx`) — unmounted, unreferenced; safe to delete later.
- Deployment intentionally not wired to a live host (recipe in `docs/deployment.md`).
- Page-fault *handling* (disk/swap, kernel) intentionally out of scope — detection only.

## Handoff (update this after every completed task)
This file is the source of truth for agent handoffs. After each completed task, update: changes, verification results (`check:purity`, `typecheck`, `test`, `e2e`, `build`), the real commit hash, and the next task. Never claim a task or test is complete without running it, and never invent commit hashes or test results.

**Next task (proposed):** fix the pre-existing `/lab` mobile overflow (transport bar wrap at 390px) — see "Next task" above for acceptance criteria.
