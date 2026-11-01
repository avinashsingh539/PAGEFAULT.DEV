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
- Latest verified commit: see `git log -1` (Task 9 — interactive concept pages, committed locally, not pushed, per task instructions; `origin/main` still at the previous task's commit)
- Remote: `https://github.com/avinashsingh539/PAGEFAULT.DEV.git`
- Last verified gates (Task 9 run): `check:purity` **PASS**, `typecheck` **0 errors** (3 configs), `npm test` **374/374 (20 files)**, `npm run build` **pass**, Playwright **79/79 (full suite)**. Concept pages verified: all 6 load directly, 6 new-tab links on /docs, no horizontal overflow at 360px/390px.

## Completed tasks (concise)
- **Days 1-6 (engine + CI/deploy):** virtual-memory translation engine; FIFO/LRU/Optimal; TLB; Experiment & Compare modes; Learn mode; GitHub Actions CI; docs (architecture, deployment, performance, reference-values, test-matrix).
- **UI redesign:** Tailwind v4 token layer (Inter/Manrope + JetBrains Mono), light surfaces, `MemoryPipeline` + node components, `eventPresentation.ts` (read-only, exhaustive over all event types).
- **Lab redesign:** controls / pipeline / explanation; empty state; presets; Beginner / Technical modes.
- **Landing (7 sections):** hero concept flow, proof strip, "What You'll Learn", learning path, interactive "Try It Now", Students/Developers, CTA.
- **Visual differentiation (12.5 A-D):** Hero = *introduce*; Try It Now = *operate*; Learn = *explain* (`LessonDiagram` + "Technical details"); Lab dark Replacement panel restyled to light tokens.
- **Task 2 — Lab clarity (`172f2b4`):** the Lab empty state tells a first-time user *what to watch* (the virtual→physical journey; first access falls through the TLB to the page table, a repeat is served by the TLB). Copy-only; verified purity/typecheck/343 unit/17 e2e/build green.
- **Task 3 — access narration (`972fba2`):** the Lab result column now explains each access as a whole journey. New DOM-free `ui/src/lib/accessNarration.ts` (`summarizeAccess`) reads the record's real events and returns outcome-first narration (RAM address or page fault) plus ordered steps (CPU request → address split → TLB hit/miss → page-table hit → translated to RAM / page fault), quoting only event payloads and `presentEvent` phrasing. New `ui/src/screens/lab/LabNarration.tsx` card ("What did this access do?") renders it above the unchanged per-event `EventExplanation`; null for maintenance/invalidation records. 5 new unit tests (miss→RAM, TLB-hit skips page table, fault stops with no RAM step, null for empty events, determinism). Visual check desktop 1440 + narrow 390 confirmed all three outcome cards. **Found (pre-existing, out of scope): `/lab` has horizontal overflow at 390px caused by the mobile transport bar (Beginner/Technical row does not wrap) — present at page load before any access; see Known issues.**
- **Task 4 — mobile overflow fix (`517dfaf`):** the sticky mobile transport row lacked `flex-wrap` (the desktop row had it), so the Beginner/Technical group pushed `/lab` to `scrollWidth=515` at `innerWidth=390`. Fix: the transport row and its button cluster now always wrap; desktop classes unchanged; `compact` still accepted for API stability but no longer changes rendering. New permanent regression `e2e/responsive.spec.ts` asserts `scrollWidth <= innerWidth` at 390px (fresh and post-access) and that every `detail-*` instance (the transport mounts twice) stays inside the viewport. Measured 390→390 and 1280→1280; screenshots inspected at both widths. Gates: purity PASS, typecheck 0, 348/348 unit, build pass, 58/58 e2e.
- **Task 5 — timeline scrub & replay (`3c92ae5`):** added what was genuinely missing rather than duplicating what existed (Back/Step/clickable timeline already worked). New: `cursorAtEndOf` moved from `lesson.ts` into `session.ts` (one shared implementation, re-exported for compatibility) and `historyPosition(records, cursor)` (position/total by flattening exactly like the timeline); **Latest** button (`latest-event`) + `position / total · history` readout in `LabTransport` (both mounts); a **HistoryStrip** panel for Beginner mode (the only mode without a clickable timeline, with its own `latest-event-beginner`); `EventTimeline` now scrolls the active row into view (`block:"nearest"`, list-scoped, no page scroll). All navigation moves only the cursor — zero engine/records changes, proven by position-invariant assertions. 5 unit + 3 e2e tests (select-past/Latest round trip, boundaries, arrows, beginner strip at 390px). Viewports measured: 390→390, 360→386 (≤ documented 388 baseline, not worsened). Gates: purity PASS, typecheck 0, 353/353 unit, build pass, 61/61 e2e.
- **Task 6 — first-visit guided tours for Learn & Lab:** wired the previously-unused `Tour` overlay into both screens. New pure policy module `ui/src/lib/tourState.ts` (auto-start once, Next/Back clamping, Skip **and** Finish both persist as "seen", reopen ignores the seen flag) so every rule is unit-testable without a DOM; `useTour` in `ui/src/design/Tour.tsx` is the thin adapter (React state + `localStorage` via `prefs`). **Fixed a real persistence bug:** `isTourSeen` read `key(tour)` while `markTourSeen` wrote `key("tours")`, so a finished tour could never stay seen — now both share the one list. Added "Take the tour" launch buttons (`learn-tour-launch` in the Learn module-index header, `lab-tour-launch` in the Lab Access panel) so both tours can always be replayed. Overlay test-IDs normalized (`tour-learn-card`, `tour-lab-next`, …). 21 new unit tests (`tests/ui/tour.test.ts`) + 9 tour E2E (both routes: auto-open, beat progression, Back-bounds, Skip/Finish persistence across reload, Escape, non-blocking overlay, reopen, 390px no-overflow) + 2 Docs E2E (`e2e/docs.spec.ts`: real content and working Learn/Lab/Compare navigation). Existing E2E specs kept deterministic via a seeded returning-user storage state (`e2e/returning-user.storage.json`, set in `playwright.config.ts`). Gates: purity PASS, typecheck 0, 374/374 unit, build pass, 73/73 e2e.
- **Task 7 — fix Lab horizontal overflow at 360px:** the Lab's grid column children (`flex flex-col gap-5` inside `grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]`) had default `min-width: auto`, so they could not shrink below their content's intrinsic width (~368px / `gridTemplateColumns: 367.969px`). At a 360px viewport (320px available after `px-5` padding), the grid track overflowed → `scrollWidth=388` at `innerWidth=360`. Fix: added `min-width: 0` (`min-w-0`) to all three grid column children in `ui/src/screens/ExperimentScreen.tsx` so each column can shrink below min-content. Verified at 360px (`scrollWidth=360`, was 388), 390px (`scrollWidth=390`, unchanged), and 1280px (`scrollWidth=1280`, unchanged). No `overflow-x: hidden`; no content or control removed; desktop layout unchanged. New regression tests in `e2e/responsive.spec.ts`: 360px initial load, 360px post-access, 360px during the Lab tour (clean storage, auto-open), plus visibility/bounds of essential controls (`#address`, `access-submit`, `preset-warm-tlb`, `lab-tour-launch`, `tour-lab-card`, `tour-lab-next`). Gates: purity PASS, typecheck 0, 374/374 unit, build pass, 79/79 e2e.
- **Task 8 — guided tour viewport awareness & focus highlighting:** the tour card could appear while its target was off-screen, and the highlight was only a subtle dashed ring. **Root cause:** `TourOverlay` measured the anchor rect once on mount and on scroll/resize but never scrolled the target into view when stepping forward/backward; the card was positioned beside the anchor or as a bottom sheet with no fallback for targets above/below the viewport; the highlight was a single 2px dashed ring with no backdrop. **Fix in `ui/src/design/Tour.tsx`:** (1) on every step change, if the target is not fully visible, `scrollIntoView({ behavior: smooth/auto, block: center, inline: center })` fires, respecting `prefers-reduced-motion`; (2) a 400ms re-measure timer repositions the ring and card after scrolling settles; (3) a spotlight overlay (4 translucent strips) dims everything except the target area, leaving the target bright and readable; (4) a prominent 2px solid border ring with 6px glow surrounds the target; (5) `computeCardPlacement()` tries below→above→right→left of the target, clamping to the viewport, with a bottom-sheet fallback on narrow screens; (6) Escape/Skip/Finish dismissal removes overlay, ring, and card. **Tests in `e2e/tourLab.spec.ts` and `e2e/tourLearn.spec.ts`:** viewport-awareness suites at 360px verify the page scrolls down to a below-viewport target, scrolls up to an above-viewport target, the highlight ring is present, the tour card and Next button stay inside the viewport, dismissal removes the ring, and no horizontal overflow. Gates: purity PASS, typecheck 0, 374/374 unit, build pass, 81/81 e2e.<|end|>


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
**Live configuration re-run in the Lab** (roadmap item 1): when the learner changes page size / TLB entries / frame count / algorithm and presses Apply, the Lab rebuilds the machine AND replays the recorded addresses through it with `step()`, so hits/faults/frames update to what the NEW machine would have done. The addresses already exist on each access record — no new data, only engine re-execution.
Acceptance criteria: changing e.g. TLB capacity from 4 to "none" over an existing session visibly changes TLB-hit counts without re-typing addresses; every record still comes from a real `step()` call (no recomputed numbers); Reset still returns to a fresh machine; URL state preserved; `check:purity`, `typecheck`, `test`, `e2e`, `build` all green; record the real commit hash here.

## Known issues / deferred work
- Concept "article pages" deliberately **not** built (vision is interactive, not article-based).
- Dead dark components remain (`ConfigPanel.tsx`, `ModeNav.tsx`) — unmounted, unreferenced; safe to delete later.
- Deployment intentionally not wired to a live host (recipe in `docs/deployment.md`).
- Page-fault *handling* (disk/swap, kernel) intentionally out of scope — detection only.

## Handoff (update this after every completed task)
This file is the source of truth for agent handoffs. After each completed task, update: changes, verification results (`check:purity`, `typecheck`, `test`, `e2e`, `build`), the real commit hash, and the next task. Never claim a task or test is complete without running it, and never invent commit hashes or test results.

**Next task (proposed):** live configuration re-run in the Lab — see "Next task" above for acceptance criteria.
