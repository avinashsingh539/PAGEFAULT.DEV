

## What PAGEFAULT.DEV does

PAGEFAULT.DEV is an interactive computer-systems laboratory focused exclusively on virtual memory. Instead of reading about paging, TLB lookups, and page faults, you see them happen:

- Send any virtual address through the CPU to TLB to page table to frame to RAM pipeline
- Watch TLB hits and misses in real time
- Observe page faults when a mapping is absent
- Compare FIFO, LRU, and Optimal page replacement side by side
- Step through a 12-step guided lesson that explains each access event by event

Every number on screen comes from the simulation engine — nothing is faked or pre-rendered.
# PAGEFAULT.DEV

**Don't just learn how computers work. Watch memory work.**


## Key features

| Feature | Description |
|---|---|
| Virtual address translation | Watch any address split into page number + offset and translate to a physical address |
| Page number and offset | See exactly how a virtual address divides by page size |
| Translation Lookaside Buffer (TLB) | Observe TLB lookups, hits, and misses in real time |
| TLB hits and misses | Understand when the page table is skipped vs. consulted |
| Page-table mappings | View present and absent page-table entries |
| Physical memory frames | See RAM organized into fixed-size frames |
| Page faults | Observe what happens when a mapping is absent — translation stops before RAM |
| FIFO page replacement | First-in, first-out eviction policy |
| LRU page replacement | Least-recently-used eviction policy |
| Optimal page replacement | Optimal (Belady's) eviction policy |
| Interactive Learn mode | A 12-step guided lesson explaining each access event by event |
| Experiment / Lab mode | Operate the machine yourself — pick addresses, read or write, step through events |
| Comparison mode | One reference string through FIFO, LRU, and Optimal side by side |
| Step-by-step replay and history | Step forward/back through the event stream with a persistent cursor |


## Visual tour

**Memory Lab — desktop**

![Memory Lab desktop](shots/t4-lab-1280.png)

**Memory Lab — mobile (360px)**

![Memory Lab mobile](shots/t4-lab-390-fresh.png)

**Translation pipeline — narration view**


## Problem it solves

Virtual memory is one of the most abstract topics in operating systems. Textbook explanations describe page tables, TLBs, and frame offsets in prose, but learners cannot observe what actually happens when the CPU issues an address like 0x1345.

PAGEFAULT.DEV makes these mechanisms visible:

- You issue an address and watch it travel through each hardware stage
- The TLB either hits (cached frame) or misses (page table lookup follows)
- A page fault stops the access before RAM is ever touched
- Frame number plus preserved offset forms the physical address
- Page replacement algorithms evict and load frames in real time

## How virtual memory works

Here is the step-by-step path of a single memory access:

1. **CPU request** — the program issues a virtual address (e.g. 0x1345)
2. **Address splitting** — the MMU divides the address into a virtual page number and an offset, based on page size
3. **TLB lookup** — the Translation Lookaside Buffer is checked first for a cached translation
4. **Page-table lookup** — on a TLB miss, the page table is consulted for the frame number
5. **Physical frame** — the present mapping names the physical frame
6. **Physical address** — frame number × page size + offset gives the final address
7. **RAM access** — the read or write occurs at the physical address

### TLB hit vs. TLB miss

A **TLB hit** means the translation is already cached: the page table lookup is skipped entirely, and the frame is returned immediately. A **TLB miss** means the entry is not in the cache — the machine must continue to the page table. A TLB miss is **not** a page fault; it only means the cache did not have the answer.



## Architecture

### Layer responsibilities

1. **Simulation engine** (engine/) — Pure TypeScript. No React, no DOM, no CSS, no animations. Exports step(state, action) which returns the next state plus an ordered list of factual events (e.g. CPU_MEMORY_ACCESS, VIRTUAL_ADDRESS_GENERATED, ADDRESS_SPLIT, TLB_LOOKUP, TLB_HIT, TLB_MISS, PAGE_TABLE_LOOKUP, PAGE_TABLE_HIT, TLB_FILL, FRAME_RESOLVED, PHYSICAL_ADDRESS_GENERATED, RAM_ACCESS, PAGE_FAULT).

2. **Event / state layer** (ui/src/lib/) — Reads engine events and state, formats them for presentation. Never recomputes page numbers, TLB hits, faults, or physical addresses independently.

3. **UI components** (ui/src/design/, ui/src/screens/) — React + Tailwind presentation. Renders engine results using shared components like MemoryPipeline so learners see the same diagram everywhere.

4. **Learning and documentation experiences** (ui/src/screens/) — Learn (guided lesson), Lab (interactive experiment), Compare (replacement algorithms), Docs (concept reference), and six concept pages with SVG diagrams.

5. **Tests** (tests/, e2e/) — Vitest unit/integration suites in plain Node; Playwright end-to-end specs against the built bundle.

The engine is deterministic: same input always produces identical events. No Date.now(), no Math.random(), no global mutable state.


## Project structure

PAGEFAULT.DEV/

- engine/ — Pure deterministic simulation engine (types, memory, TLB, machine, step)
- scripts/ — Developer tooling: demo, bench, engine purity gate
- tests/ — Vitest unit/integration suites (plain Node, 374 tests)
- e2e/ — Playwright end-to-end specs (110 tests, against built bundle)
- ui/ — React + Tailwind frontend (imports engine only)
  - src/
    - design/ — Shared layout: AppShell, TopNav, SiteFooter, primitives, icons
    - screens/ — Landing, Learn, Lab (Experiment), Compare, Docs, Concept screens
    - lib/ — Routes, URL state, LabView, session, stages, experiment, concept data
    - viz/ — MemoryPipeline, node components, diagram primitives, concept diagrams
- docs/ — Architecture, deployment, performance, reference-values, test-matrix
- shots/ — Application screenshots
- .github/workflows/ — CI workflow (purity, typecheck, test, build, e2e)
- README.md — This file
- package.json — Scripts and dependencies

## Getting started

```bash
git clone https://github.com/avinashsingh539/PAGEFAULT.DEV.git
cd PAGEFAULT.DEV
npm ci
npm run dev
```

The development server opens at http://localhost:5173 (Vite default).

## Verification



## Project limitations

PAGEFAULT.DEV is a learning tool, not a production operating-system memory manager:

- Page-fault handling (disk/swap, kernel, backing store) is detected but not simulated — translation stops at the fault
- CPU scheduling, networking, and other OS topics are out of scope by design
- No user/kernel mode — one machine, executing memory accesses
- No persistence — session state lives in the URL only

## Roadmap

Planned improvements (not yet implemented):

1. Live configuration re-run in the Lab — change settings and replay recorded addresses
2. Guided interactive experiments in Learn modules
3. Landing-page interactivity — change a setting, watch faults change

## Deployment

PAGEFAULT.DEV is a pure static frontend. It can be hosted on Vercel, Netlify, Cloudflare Pages, or any static host with SPA fallback support.

Vercel deployment:

- Framework: Vite
- Root directory: repository root
- Build command: npm run build
- Output directory: dist
- SPA rewrite: rewrite all unmatched paths to /index.html (so /docs/virtual-address, /lab/experiment, etc. work on refresh)
- GitHub integration: connect this repository for automatic deploys on push to main

No live deployment URL exists yet — do not link to one until a deployment is created.

## License

No license has been added to this repository. The project is not currently offered under any open-source license. Do not assume MIT or any other license.

## Author

**Avinash Singh**
GitHub: https://github.com/avinashsingh539
Repository: https://github.com/avinashsingh539/PAGEFAULT.DEV

PAGEFAULT.DEV — built for learning, not for production workloads.
Every change is verified by five gates:

| Command | What it checks |
|---|---|
| npm run check:purity | Engine imports nothing it doesn't own; no DOM, clock, entropy, timers, console, or UI assets |
| npm run typecheck | Three TypeScript passes: DOM-free engine, CLI, and UI |
| npm test | 374 unit and integration tests (20 test files) |
| npm run build | Type-checks the UI and bundles it into dist/ |
| npm run e2e | Builds, then runs 110 Playwright tests in a real browser against the bundle |

All gates pass on main.

## Technology stack

| Category | Technology |
|---|---|
| Frontend | React 19, ReactDOM |
| Language | TypeScript 5.6 (strict) |
| Build tooling | Vite 5 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest (unit), Playwright (end-to-end) |
| Fonts | Inter, Manrope, JetBrains Mono |
### Page fault

When the page table has no present entry for the virtual page, translation stops and a page fault is raised. No RAM access occurs for that address.

### Worked example

Virtual address: 0x1345
Page size: 4096 bytes
Virtual page number: 1 (0x1345 ÷ 4096)
Offset: 0x345 (837 decimal — preserved unchanged)
Example physical frame: 7
Physical address: 0x7345 (frame 7 × 4096 + offset 837)

The frame number 7 is an illustrative example, not a guaranteed live simulation result.
![Translation pipeline](shots/narration-full-desktop.png)

**Guided learning — Learn mode**

![Learn mode](shots/t6-learn-1440.png)

**Concept documentation — Docs page**

![Docs concept pages](shots/t6-docs-1440.png)

**TLB hit — narration view**

![TLB hit](shots/narration-tlhit-desktop.png)

Screenshots are preserved in [shots/](shots/). They show the application as built from this repository.
| Guided tours | First-visit tours walk through Lab and Learn beats |
| Detailed concept documentation | Six concept pages with educational diagrams (Virtual Address, Address Split, TLB, Page Table, Physical Memory, RAM Access) |

Every number on screen comes from the simulation engine — nothing is faked or pre-rendered.

An interactive virtual memory learning platform that makes operating-system memory management understandable through visual simulations and hands-on experiments.

[![CI](https://github.com/avinashsingh539/PAGEFAULT.DEV/actions/workflows/ci.yml/badge.svg)](https://github.com/avinashsingh539/PAGEFAULT.DEV/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06b6d4)](https://tailwindcss.com/)

[View Source](https://github.com/avinashsingh539/PAGEFAULT.DEV) · [Report a Bug](https://github.com/avinashsingh539/PAGEFAULT.DEV/issues)