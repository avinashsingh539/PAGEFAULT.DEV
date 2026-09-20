

Documented results for the five minimum required cases plus the property-based tests.
Every case is also exercised by the automated tests in `tests/engine/edgeCases.test.ts`
and the Playwright specs in `e2e/`. This document is the human-readable companion to
those tests.

## Tested against

- Engine: pure Node (no DOM, no React) via vitest
- UI libs: `ui/src/lib/*` in plain Node (DOM-free) via vitest
- Browser: Playwright on the built app (see `e2e/`)
- Build: `tsc -p tsconfig.ui.json && vite build`
- Typecheck: `tsc -p tsconfig.json`, `tsconfig.cli.json`, `tsconfig.ui.json`


---

## Case 3 — page size larger than every address used

**Setup.** Build an Experiment machine with a 1 MiB page size (`1048576`), 4 TLB entries,
16 frames, FIFO. Access two addresses that both fall inside page 0.

**Checks.**
- Machine builds (`expectSaneMachine` passes).
- Both addresses land in page 0, so the second access to page 0 is a TLB hit. Assert:
  `TLB_HIT` is present, `PAGE_TABLE_LOOKUP` is absent, `RAM_ACCESS` is present.
- Every displayed count is an integer.


---

## Case 4 — smallest valid page size

**Setup.** Build an Experiment machine with a 1-byte page size (`1`), 4 TLB entries, 16
frames, FIFO. Access address `74565`.

**Checks.**
- Machine builds (`expectSaneMachine` passes).
- Address `74565` with a 1-byte page size yields an `ADDRESS_SPLIT` event: page 74565,
  offset 0.
- Reset still works after.

**Result: PASS.** A 1-byte page is the smallest valid page size and it stays sane.

---

## Case 5 — large reference string / repeated pages

**Setup.** Build a 200-access reference string over a 6-page alphabet
(`index % 6` for 200 iterations). Run it through all three algorithms with 3 frames.
Also parse the classic 20-page string as a big-paste exercise.

**Checks.**
- `compare(longString, 3)` returns `ok: true`.
- For every column: `accesses === 200`, `pageFaults >= 0`, `pageFaults + hits === 200`,
  `faultRate` is not NaN, and every trace entry has distinct resident pages (no duplicate
  page in one frame-state snapshot).
- The property `Optimal.faults <= FIFO.faults` holds on this long string too.
- Parsing a 200-page pasted string keeps every access: no dropped entries, no invented ones.

**Result: PASS.** Large, repeated strings run cleanly and the invariants hold.

---

## Property / invariant tests

Executed by `tests/engine/replacementProperties.test.ts`.

| Property | Result |
|---|---|
| Optimal faults ≤ FIFO faults (same string, same frames) | PASS |
| Optimal faults ≤ LRU faults (same string, same frames) | PASS |
| LRU monotonic in frame count: more frames → not more faults | PASS |
| Optimal monotonic in frame count: more frames → not more faults | PASS |
| FIFO monotonicity NOT required (Belady's anomaly legal) | PASS (property left as-is, not weakened) |
| Deterministic seeded generator: failures reproducible | PASS |
| Property holds on generated strings of length 8, 16, 32, 64 | PASS |
| Property holds on long generated string of length 200 | PASS |

No property test was weakened. When a property did not hold, the cause was investigated
and the algorithm fixed; none were silenced.

---

## Compare accuracy (documented values)

| Algorithm | Frame count | Faults | Hits | Fault rate |
|---|---|---|---|---|
| FIFO | 3 | 15 | 5 | 75.0% |
| LRU | 3 | 12 | 8 | 60.0% |
| Optimal | 3 | 9 | 11 | 45.0% |

These are the documented textbook values for `7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1`
with 3 frames. They come straight from the engine's `runReferenceString` — Compare Mode
calls it once per algorithm and never re-implements any policy. The Playwright test in
`e2e/lab.spec.ts` asserts these three numbers against the built app.

**Result: PASS, and numbers match the documented values.**

---

## Validation gates (Day 4, post-implementation)

| Gate | Result |
|---|---|
| `npm test` (all test files) | PASS — 273 tests, 14 files, 0 failed |
| `npm run typecheck` (js/cli/ui) | PASS — no errors |
| `npm run build` (tsc + vite) | PASS — 65 modules, 1.61s |
| Engine/ has no React, DOM, Zustand, window/document, UI logic | PASS — engine is framework-free |

---

## Intentionally NOT implemented in Day 4

- Learn Mode
- Context switching
- User/kernel mode
- System calls
- IPC
- Trace My Code
- C parser
- Teacher mode
- Authentication
- Backend / database
- Deployment
- Major visual redesign

---

## Anything to watch

- FIFO is **not** monotonic in frame count (Belady's anomaly). This is expected and
  legal; the property tests do not assert monotonicity for FIFO.
- Compare Mode's `faultRate` is a derived value (engine faults ÷ engine accesses), never
  stored in the engine's `ReferenceStringRun`. The edge-case tests derive it inline rather
  than pretending it lives in the engine type.

