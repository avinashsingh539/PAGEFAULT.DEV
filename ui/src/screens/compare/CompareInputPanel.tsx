/**
 * The exercise: one reference string, one frame count, one RUN.
 *
 * The reference string is the hero of this screen, so it gets the widest field and
 * a hint that says what the documented run is. `#referenceString`, `#compareFrames`,
 * `run-compare`, `reset-compare` and `compare-error` keep their names, because the
 * E2E suite drives this screen entirely through them.
 */

import type { JSX } from "react";

import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";

export function CompareInputPanel({
  referenceText,
  onReferenceTextChange,
  frameText,
  onFrameTextChange,
  onRun,
  onReset,
  error,
  accessCount,
}: {
  referenceText: string;
  onReferenceTextChange: (text: string) => void;
  frameText: string;
  onFrameTextChange: (text: string) => void;
  onRun: () => void;
  onReset: () => void;
  error: string | null;
  /** How many pages the current string holds, so the summary is honest. */
  accessCount: number | null;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="referenceString"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Reference string
        </label>
        <textarea
          id="referenceString"
          value={referenceText}
          onChange={(event) => onReferenceTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onRun();
            }
          }}
          rows={2}
          spellCheck={false}
          aria-describedby="reference-help"
          className="num w-full resize-y rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary"
        />
        <p id="reference-help" className="text-xs leading-relaxed text-muted">
          Page numbers, separated by spaces or commas. The default is the classic 20-access
          textbook string; with 3 frames it gives FIFO 15 faults, LRU 12 and Optimal 9.
          {accessCount === null ? null : (
            <>
              {" "}
              <span className="num font-semibold text-ink">{accessCount}</span> accesses typed.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-48">
        <label
          htmlFor="compareFrames"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Physical frames
        </label>
        <input
          id="compareFrames"
          value={frameText}
          onChange={(event) => onFrameTextChange(event.target.value)}
          spellCheck={false}
          inputMode="numeric"
          className="num w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary"
        />
      </div>

      {error === null ? null : (
        <p
          data-testid="compare-error"
          role="alert"
          className="flex items-start gap-1.5 rounded-control bg-error-soft px-3 py-2 text-xs font-medium text-error"
        >
          <Icon name="alert" size={14} className="mt-px" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          data-testid="run-compare"
          onClick={onRun}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control bg-primary-strong px-5 text-sm font-bold uppercase tracking-wide text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.99]"
        >
          <Icon name="play" size={16} />
          Run
        </button>
        <button
          type="button"
          data-testid="reset-compare"
          onClick={onReset}
          className="min-h-12 flex-1 rounded-control border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft sm:flex-none"
        >
          Reset
        </button>
      </div>

      <p className={cx("text-xs text-muted", error === null && "text-muted")}>
        Same input, three ways through it. The algorithms differ; the exercise does not.
      </p>
    </section>
  );
}
