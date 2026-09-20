/**
 * Drawing a replacement run: one card of totals per algorithm, and one row per access
 * showing all three algorithms moving through the SAME reference string.
 *
 * Every number, page and frame below comes out of the engine's `ReferenceStringRun`
 * (via `lib/compare.ts`). The only thing decided here is which Tailwind class a hit or
 * a fault gets, and which frame to highlight - and the frame to highlight is itself a
 * diff of two engine snapshots, not a guess about what "should" have changed.
 */

import type { JSX } from "react";

import type { CompareColumn, CompareStep } from "../lib/compare";
import { changedFrame } from "../lib/compare";

/** A page-cell in the frame strip: empty, or holding a page. */
function FrameChip({ pageNumber, changed }: { pageNumber: number | null; changed: boolean }): JSX.Element {
  return (
    <span
      className={`num inline-flex min-w-7 justify-center rounded border px-1 py-0.5 text-[11px] ${
        changed
          ? "border-amber-400/70 bg-amber-400/15 text-amber-100"
          : pageNumber === null
            ? "border-slate-800 bg-slate-950 text-slate-600"
            : "border-slate-700 bg-slate-900 text-slate-300"
      }`}
    >
      {pageNumber === null ? "·" : `p${pageNumber}`}
    </span>
  );
}

/** The frame strip after one access, with the frame that changed highlighted. */
function FrameStrip({
  frames,
  previous,
}: {
  frames: readonly (number | null)[];
  previous: readonly (number | null)[] | null;
}): JSX.Element {
  const changed = changedFrame(previous, frames);
  return (
    <span className="flex flex-wrap gap-1">
      {frames.map((pageNumber, frameNumber) => (
        <FrameChip key={frameNumber} pageNumber={pageNumber} changed={changed === frameNumber} />
      ))}
    </span>
  );
}

function outcomeBadge(step: CompareStep): JSX.Element {
  return step.outcome === "HIT" ? (
    <span className="rounded border border-emerald-400/50 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
      hit
    </span>
  ) : (
    <span className="rounded border border-rose-400/50 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-rose-200">
      fault
    </span>
  );
}

/** One algorithm's headline numbers at the end of a run. */
export function AlgorithmCard({
  column,
  frameCount,
}: {
  column: CompareColumn;
  frameCount: number;
}): JSX.Element {
  const tone =
    column.algorithm === "FIFO"
      ? "border-sky-400/40"
      : column.algorithm === "LRU"
        ? "border-violet-400/40"
        : "border-emerald-400/40";

  return (
    <section
      data-testid={`column-${column.algorithm}`}
      className={`rounded-2xl border bg-slate-900/60 p-4 ${tone}`}
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
          {column.algorithm}
        </h3>
        <span className="text-xs text-slate-500">{frameCount} frames</span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-widest text-slate-500">faults</dt>
          <dd
            data-testid={`faults-${column.algorithm}`}
            className="num text-lg font-semibold text-rose-200"
          >
            {column.pageFaults}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-widest text-slate-500">hits</dt>
          <dd
            data-testid={`hits-${column.algorithm}`}
            className="num text-lg font-semibold text-emerald-200"
          >
            {column.hits}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-widest text-slate-500">evictions</dt>
          <dd data-testid={`evictions-${column.algorithm}`} className="num text-lg font-semibold text-amber-200">
            {column.evictions}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-xs uppercase tracking-widest text-slate-500">fault rate</dt>
          <dd data-testid={`fault-rate-${column.algorithm}`} className="num text-lg font-semibold text-slate-200">
            {(column.faultRate * 100).toFixed(1)}%
          </dd>
        </div>
      </dl>

      <p className="mb-1 mt-3 text-xs uppercase tracking-widest text-slate-500">final frames</p>
      <div data-testid={`final-frames-${column.algorithm}`}>
        <FrameStrip frames={column.finalFrames} previous={null} />
      </div>
    </section>
  );
}


/**
 * All three algorithms moving through the SAME reference string, one row per access.
 *
 * Reading a row left to right is the whole lesson: the same page is referenced, and
 * the three columns disagree about what it cost. A row where every column says "hit"
 * is a row where memory was big enough; a row where they disagree is a row where the
 * eviction policy mattered.
 */
export function ReplacementTimeline({
  columns,
  referenceString,
}: {
  columns: readonly CompareColumn[];
  referenceString: readonly number[];
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-baseline justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          The same reference string, step by step
        </h2>
        <span className="text-xs text-slate-500">{referenceString.length} accesses</span>
      </header>

      <div className="slim-scroll max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">page</th>
              {columns.map((column) => (
                <th key={column.algorithm} className="px-3 py-2 font-medium">
                  {column.algorithm}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {referenceString.map((pageNumber, accessIndex) => (
              <tr
                key={accessIndex}
                data-testid={`access-row-${accessIndex}`}
                className="border-t border-slate-800/60"
              >
                <td className="num px-3 py-1.5 text-slate-500">{accessIndex}</td>
                <td className="num px-3 py-1.5 text-slate-200">
                  <span data-testid={`access-page-${accessIndex}`}>{pageNumber}</span>
                </td>
                {columns.map((column) => {
                  const step = column.steps[accessIndex];
                  if (step === undefined) {
                    return (
                      <td key={column.algorithm} className="px-3 py-1.5 text-slate-600">
                        —
                      </td>
                    );
                  }
                  const previous =
                    accessIndex === 0 ? null : (column.steps[accessIndex - 1]?.frames ?? null);

                  return (
                    <td key={column.algorithm} className="px-3 py-1.5 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {outcomeBadge(step)}
                        <span className="num text-[10px] text-slate-500">
                          frame {step.frameNumber}
                        </span>
                        {step.evictedPageNumber === null ? null : (
                          <span
                            data-testid={`evicted-${column.algorithm}-${accessIndex}`}
                            className="num rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200"
                          >
                            evicted p{step.evictedPageNumber}
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <FrameStrip frames={step.frames} previous={previous} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {referenceString.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          The reference string is empty, so no algorithm had anything to do.
        </p>
      ) : null}
    </section>
  );
}
