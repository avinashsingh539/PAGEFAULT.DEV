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
- Latest verified commit: `172f2b4` — `feat(lab): tell first-time users what to watch in the empty state` (not yet pushed)
- Remote: `https://github.com/avinashsingh539/PAGEFAULT.DEV.git`
- Last verified gates (Task 2 run): `check:purity` **PASS**, `typecheck` **0 errors** (3 configs), `npm test` **343/343 (18 files)**, `npm run build` **pass** (398.47 kB JS / 45.85 kB CSS), Playwright **17/17** (experiment + landing subsets). Full 57-test e2e not re-run this task.

## Completed tasks (concise)
- **Days 1-6 (engine + CI/deploy):** virtual-memory translation engine; FIFO/LRU/Optimal; TLB; Experiment & Compare modes; Learn mode; GitHub Actions CI; docs (architecture, deployment, performance, reference-values, test-matrix).
- **UI redesign:** Tailwind v4 token layer (Inter/Manrope + JetBrains Mono), light surfaces, `MemoryPipeline` + node components, `eventPresentation.ts` (read-only, exhaustive over all event types).
- **Lab redesign:** controls / pipeline / explanation; empty state; presets; Beginner / Technical modes.
- **Landing (7 sections):** hero concept flow, proof strip, "What You'll Learn", learning path, interactive "Try It Now", Students/Developers, CTA.
- **Visual differentiation (12.5 A-D):** Hero = *introduce*; Try It Now = *operate*; Learn = *explain* (`LessonDiagram` + "Technical details"); Lab dark Replacement panel restyled to light tokens.
- **Task 2 — Lab clarity (`172f2b4`):** single highest-impact fix — the Lab empty state now tells a first-time user *what to watch* (the virtual→physical journey: `CPU → Virtual Address → TLB → Page Table → RAM`, first access falls through TLB to the page table, a repeat of the same page is served by the TLB and skips the page table). Copy-only addition to the existing empty state in `ExperimentScreen.tsx`; no engine, routes, URL state, test IDs, or interactions changed. Verified: purity/typecheck/343 unit/17 e2e (experiment+landing)/build all green.


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

## Next task (recommended, awaiting approval)
**Lab timeline scrub / step replay.** Add a way to step back and forth through the recorded accesses and re-inspect each translation's pipeline state and explanation (replaying the existing deterministic event history — no new engine work). This directly serves the differentiator: "watch memory work" by rewinding what already happened.
Acceptance criteria: scrubbing to any past access re-renders the exact engine state + events for that access; **no engine/algorithm/event/state change**; existing routes, URL params, and test IDs preserved; `check:purity`, `typecheck`, `test`, `e2e`, `build` all green; documented here with the real commit hash.

## Known issues / deferred work
- Concept "article pages" deliberately **not** built (vision is interactive, not article-based).
- Dead dark components remain (`ConfigPanel.tsx`, `ModeNav.tsx`) — unmounted, unreferenced; safe to delete later.
- Deployment intentionally not wired to a live host (recipe in `docs/deployment.md`).
- Page-fault *handling* (disk/swap, kernel) intentionally out of scope — detection only.

## Handoff (update this after every completed task)
This file is the source of truth for agent handoffs. After each completed task, update: changes, verification results (`check:purity`, `typecheck`, `test`, `e2e`, `build`), the real commit hash, and the next task. Never claim a task or test is complete without running it, and never invent commit hashes or test results.

**Next task (proposed, awaiting approval):** TLB "What-if" experiment — change TLB capacity (0/1/2/4), run a fixed repeated-access sequence, observe TLB hit count and whether the page table is walked. No engine/algorithm/event/state change; preserve routes, URL params, and test IDs; all gates green; record the real commit hash here.
