/**
 * The walk through the string: one access at a time, with each algorithm's answer.
 *
 * Clicking an access moves the three column cards to their state at that instant,
 * which is the clearest way to ask the question this screen exists for: at access
 * 7, what did each algorithm do?
 *
 * A NOTE ON THE PHASE FLOW, because it is easy to fake. NEW PAGE, RAM FULL, SELECT
 * VICTIM, EVICT and LOAD are drawn from what the engine actually recorded for that
 * access: whether it was a fault, and whether a page had to leave to make room. A
 * phase that did not happen is drawn dashed and struck through rather than played.
 * Animating a victim being chosen when the engine chose none would be a nicer
 * animation and a lie.
 */

import { useState } from "react";
import type { JSX } from "react";

import type { CompareColumn, CompareResult } from "../../lib/compare";

import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";

const PHASES = [
  { id: "new", label: "New page" },
  { id: "full", label: "RAM full" },
  { id: "victim", label: "Select victim" },
  { id: "evict", label: "Evict" },
  { id: "load", label: "Load" },
] as const;

export function CompareTrace({
  result,
  selectedIndex,
  onSelect,
}: {
  result: CompareResult;
  selectedIndex: number | null;
  onSelect: (accessIndex: number) => void;
}): JSX.Element {
  const [flowAlgorithm, setFlowAlgorithm] = useState<CompareColumn["algorithm"]>("FIFO");
  const column =
    result.columns.find((candidate) => candidate.algorithm === flowAlgorithm) ?? result.columns[0];
  const step =
    selectedIndex === null
      ? null
      : (column?.steps.find((candidate) => candidate.accessIndex === selectedIndex) ?? null);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Same input</h2>
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="num rounded-control border border-line bg-surface-soft px-4 py-2 text-center text-sm font-semibold text-ink">
            {result.referenceString.length} accesses, {result.frameCount} frames
          </div>
          <Icon name="arrowDown" size={18} className="text-line-strong" />
          <div className="grid w-full grid-cols-3 gap-2">
            {result.columns.map((candidate) => (
              <div
                key={candidate.algorithm}
                className="rounded-control border border-primary/35 bg-primary-soft px-2 py-2 text-center text-xs font-bold text-primary-strong"
              >
                {candidate.algorithm === "OPTIMAL" ? "Optimal" : candidate.algorithm}
              </div>
            ))}
          </div>
          <Icon name="arrowDown" size={18} className="text-line-strong" />
          <div className="rounded-control border border-line bg-surface-soft px-4 py-2 text-center text-sm font-semibold text-ink">
            RAM
          </div>
        </div>
      </section>
      <section className="rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">What happens when RAM runs out</h2>
          <div
            role="group"
            aria-label="Show the flow for"
            className="flex gap-1 rounded-control border border-line bg-surface-soft p-0.5"
          >
            {result.columns.map((candidate) => (
              <button
                key={candidate.algorithm}
                type="button"
                aria-pressed={flowAlgorithm === candidate.algorithm}
                onClick={() => setFlowAlgorithm(candidate.algorithm)}
                className={cx(
                  "rounded-chip px-2.5 py-1 text-xs font-bold transition-colors",
                  flowAlgorithm === candidate.algorithm
                    ? "bg-surface text-primary-strong shadow-raised"
                    : "text-muted hover:text-ink",
                )}
              >
                {candidate.algorithm === "OPTIMAL" ? "Optimal" : candidate.algorithm}
              </button>
            ))}
          </div>
        </div>

        {step === null ? (
          <p className="mt-3 text-sm text-muted">
            Pick an access below to see how {flowAlgorithm} handled it.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-5" data-testid="phase-flow">
            {PHASES.map((phase) => {
              const reached = phaseReached(phase.id, step.outcome, step.evictedPageNumber);
              return (
                <li
                  key={phase.id}
                  data-phase={phase.id}
                  data-reached={reached}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-control border px-2 py-2.5 text-center",
                    reached
                      ? "border-primary/40 bg-primary-soft"
                      : "border-dashed border-line bg-surface-soft",
                  )}
                >
                  <Icon
                    name={reached ? "check" : "close"}
                    size={14}
                    className={reached ? "text-primary-strong" : "text-muted"}
                  />
                  <span
                    className={cx(
                      "text-xs font-bold",
                      reached ? "text-ink" : "text-muted line-through",
                    )}
                  >
                    {phase.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5">
        <h2 className="text-sm font-bold text-ink">Access by access</h2>
        <ol className="slim-scroll mt-3 flex max-h-96 flex-col gap-1 overflow-y-auto" data-testid="access-list">
          {result.referenceString.map((page, accessIndex) => {
            const selected = selectedIndex === accessIndex;
            return (
              <li key={accessIndex}>
                <button
                  type="button"
                  data-testid={`access-row-${accessIndex}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(accessIndex)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-transparent hover:bg-surface-soft",
                  )}
                >
                  <span className="num w-8 shrink-0 text-xs text-muted">{accessIndex + 1}</span>
                  <span className="num text-sm font-bold text-ink">
                    page <span data-testid={`access-page-${accessIndex}`}>{page}</span>
                  </span>
                  <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                    {result.columns.map((candidate) => (
                      <AccessChip
                        key={candidate.algorithm}
                        algorithm={candidate.algorithm}
                        accessIndex={accessIndex}
                        steps={candidate.steps}
                      />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/**
 * Whether a phase actually happened, decided only by what the engine recorded.
 *
 * A hit needs none of the replacement work. A fault into a free frame needs the
 * load but never reaches RAM FULL, because there was still room.
 */
function phaseReached(
  phase: (typeof PHASES)[number]["id"],
  outcome: "HIT" | "FAULT",
  evictedPageNumber: number | null,
): boolean {
  const faulted = outcome === "FAULT";
  const evicted = faulted && evictedPageNumber !== null;
  switch (phase) {
    case "new":
      return true;
    case "full":
    case "victim":
    case "evict":
      return evicted;
    case "load":
      return faulted;
    default:
      return false;
  }
}

/**
 * What one algorithm did on one access, as a single readable chip.
 *
 * Three words, because that is all the state really is: the page was already
 * there (`hit`), the page was missing and a frame was free (`free`), or the page
 * was missing and this page had to leave to make room (`evict N`). The colour
 * repeats the word rather than replacing it.
 */
function AccessChip({
  algorithm,
  accessIndex,
  steps,
}: {
  algorithm: CompareColumn["algorithm"];
  accessIndex: number;
  steps: readonly {
    readonly accessIndex: number;
    readonly outcome: "HIT" | "FAULT";
    readonly evictedPageNumber: number | null;
  }[];
}): JSX.Element {
  const step = steps.find((candidate) => candidate.accessIndex === accessIndex);
  const hit = step?.outcome === "HIT";
  const evicted = step?.evictedPageNumber ?? null;

  const label = hit ? "hit" : evicted === null ? "free" : `evict ${evicted}`;
  const name = algorithm === "OPTIMAL" ? "Optimal" : algorithm;

  return (
    <span
      data-testid={`evicted-${algorithm}-${accessIndex}`}
      title={`${name}: ${hit ? "hit" : evicted === null ? "fault, a frame was free" : `fault, evicted page ${evicted}`}`}
      className={cx(
        "num rounded-chip px-2 py-0.5 text-[0.6875rem] font-bold",
        hit
          ? "bg-hit-soft text-hit"
          : evicted === null
            ? "bg-fault-soft text-fault"
            : "bg-error-soft text-error",
      )}
    >
      {name} {label}
    </span>
  );
}