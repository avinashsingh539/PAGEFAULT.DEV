/**
 * One algorithm's column: the whole run, and its state at the selected access.
 *
 * Each card is a run of the SAME reference string. When an access is selected on
 * the trace below, every card shows its state AT that access - the page that was
 * asked for, whether it was a hit or a fault, what RAM held at that moment, and
 * the running fault count. That is the comparison made visual: three different
 * answers to the same access, at the same instant.
 *
 * With nothing selected the cards show the totals for the finished run, which is
 * where the published FIFO 15 / LRU 12 / Optimal 9 live.
 *
 * Every number here is read from the engine's `ReferenceStringRun` via
 * `lib/compare`. The running fault count is the number of FAULT outcomes among the
 * first N steps - arithmetic on engine values, not a simulation.
 */

import type { JSX } from "react";

import type { CompareColumn } from "../../lib/compare";

import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";
import { StatusBadge } from "../../design/feedback";

export function CompareColumnCard({
  column,
  frameCount,
  selectedIndex,
}: {
  column: CompareColumn;
  frameCount: number;
  /** `null` means "show the finished run" rather than a particular access. */
  selectedIndex: number | null;
}): JSX.Element {
  const step =
    selectedIndex === null
      ? null
      : (column.steps.find((candidate) => candidate.accessIndex === selectedIndex) ?? null);

  const requestedPage = step === null ? null : step.pageNumber;
  const outcome = step === null ? null : step.outcome;

  // Faults counted over the steps UP TO the selected one, so the running count is
  // the count at that moment rather than the count at the end of the run.
  const stepsSoFar =
    selectedIndex === null
      ? column.steps
      : column.steps.filter((s) => s.accessIndex <= selectedIndex);
  const runningFaults = stepsSoFar.filter((s) => s.outcome === "FAULT").length;
  const runningHits = stepsSoFar.filter((s) => s.outcome === "HIT").length;
  const runningEvictions = stepsSoFar.filter((s) => s.evictedPageNumber !== null).length;
  const frames = step === null ? column.finalFrames : step.frames;

  return (
    <section
      data-testid={`column-${column.algorithm}`}
      className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 shadow-raised"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold tracking-tight text-ink">
          {column.algorithm === "OPTIMAL" ? "Optimal" : column.algorithm}
        </h3>
        {outcome === null ? (
          <StatusBadge tone="neutral">finished</StatusBadge>
        ) : outcome === "HIT" ? (
          <StatusBadge tone="hit">hit</StatusBadge>
        ) : (
          <StatusBadge tone="fault">fault</StatusBadge>
        )}
      </header>

      <div className="flex items-baseline justify-between gap-2 rounded-control bg-surface-soft px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">requested page</span>
        <span
          data-testid={`requested-${column.algorithm}`}
          className="num text-lg font-bold text-ink"
        >
          {requestedPage === null ? "—" : requestedPage}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          RAM ({frameCount} frames)
        </span>
        <ul data-testid={`finalFrames-${column.algorithm}`} className="flex flex-wrap gap-1.5">
          {frames.map((page, frameNumber) => (
            <li
              key={frameNumber}
              data-testid={`frame-${column.algorithm}-${frameNumber}`}
              className={cx(
                "num grid size-11 place-items-center rounded-chip border text-sm font-bold",
                page === null
                  ? "border-dashed border-line bg-surface-soft text-muted"
                  : "border-hit/35 bg-hit-soft text-hit",
              )}
              title={
                page === null ? `frame ${frameNumber}: free` : `frame ${frameNumber}: page ${page}`
              }
            >
              {page === null ? <span className="text-xs font-normal">free</span> : page}
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Figure
          label="faults"
          value={String(step === null ? column.pageFaults : runningFaults)}
          testId={`faults-${column.algorithm}`}
          tone="text-fault"
        />
        <Figure
          label="hits"
          value={String(step === null ? column.hits : runningHits)}
          testId={`hits-${column.algorithm}`}
          tone="text-hit"
        />
        <Figure
          label="evictions"
          value={String(step === null ? column.evictions : runningEvictions)}
          testId={`evictions-${column.algorithm}`}
          tone="text-muted"
        />
        <Figure
          label="fault rate"
          value={`${Math.round(column.faultRate * 100)}%`}
          testId={`fault-rate-${column.algorithm}`}
          tone="text-ink"
        />
      </dl>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <Icon name="info" size={13} className="mt-px shrink-0" />
        {step === null
          ? `Totals for all ${column.accesses} accesses.`
          : step.outcome === "HIT"
            ? `Access ${step.accessIndex + 1} was already in RAM: frame ${step.frameNumber} served it, and nothing was evicted.`
            : step.evictedPageNumber === null
              ? `Access ${step.accessIndex + 1} faulted and a frame was free, so nothing was evicted.`
              : `Access ${step.accessIndex + 1} faulted, so page ${step.evictedPageNumber} had to leave frame ${step.frameNumber} to make room.`}
      </p>
    </section>
  );
}

/** A labelled figure. The test id is part of the E2E contract for the totals. */
function Figure({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: string;
  testId: string;
  tone: string;
}): JSX.Element {
  return (
    <div className="rounded-control border border-line bg-surface-soft px-3 py-2">
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted">{label}</dt>
      <dd data-testid={testId} className={cx("num text-xl font-bold", tone)}>
        {value}
      </dd>
    </div>
  );
}