/**
 * Compare Mode: the same reference string through FIFO, LRU and Optimal.
 *
 * This screen has no policy of its own. RUN calls the engine's one shared harness,
 * once per algorithm (`lib/compare.ts`'s `compare`, which calls `runReferenceString`),
 * and every table, badge and frame strip below is drawn from the three runs it
 * returns. When the classic string with 3 frames shows FIFO 15, LRU 12 and Optimal 9,
 * that agreement is the whole point of the screen - those numbers come from
 * `docs/reference-values.md`, never from anything stored beside the engine.
 */

import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";

import { AlgorithmCard, ReplacementTimeline } from "../components/ReplacementPanel";
import { compare, parseCompareFrameCount } from "../lib/compare";
import { parseReferenceString } from "../lib/fields";
import { DEFAULT_COMPARE_FRAME_COUNT, DEFAULT_COMPARE_REFERENCE_TEXT } from "../lib/compare";
import type { CompareResult } from "../lib/compare";
import type { LabUrlConfig } from "../lib/url";

export interface CompareScreenProps {
  readonly urlConfig: LabUrlConfig;
  readonly onUrlConfigChange: (next: LabUrlConfig) => void;
}

export default function CompareScreen({ urlConfig, onUrlConfigChange }: CompareScreenProps): JSX.Element {
  const [referenceText, setReferenceText] = useState<string>(urlConfig.referenceText);
  const [frameText, setFrameText] = useState<string>(String(urlConfig.frameCount));
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Persist the sharable comparison whenever it changes.
  useEffect(() => {
    onUrlConfigChange({
      ...urlConfig,
      mode: "compare",
      frameCount: frameCountFromText(frameText),
      referenceText,
    });
    // urlConfig intentionally omitted: it is the value being written, not read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceText, frameText]);

  /** Run the comparison: one shared engine call per algorithm, three columns back. */
  const handleRun = useCallback((): void => {
    const reference = parseReferenceString(referenceText);
    if (!reference.ok) {
      setError(`The reference string was rejected: ${reference.error}`);
      return;
    }
    const frames = parseCompareFrameCount(frameText);
    if (!frames.ok || frames.value === null) {
      setError(`The frame count was rejected: ${frames.ok ? "must be at least 1" : frames.error}`);
      return;
    }
    const compared = compare(reference.value, frames.value);
    if (!compared.ok) {
      setError(compared.error);
      return;
    }
    setError(null);
    setResult(compared.value);
  }, [referenceText, frameText]);

  const handleReset = useCallback((): void => {
    setReferenceText(DEFAULT_COMPARE_REFERENCE_TEXT);
    setFrameText(String(DEFAULT_COMPARE_FRAME_COUNT));
    setResult(null);
    setError(null);
  }, []);

  return (
    <div>
      <section className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            The exercise
          </h2>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
                htmlFor="referenceString"
              >
                reference string (page numbers, spaces or commas)
              </label>
              <input
                id="referenceString"
                value={referenceText}
                onChange={(event) => {
                  setReferenceText(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleRun();
                  }
                }}
                spellCheck={false}
                placeholder={DEFAULT_COMPARE_REFERENCE_TEXT}
                className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              />
              <p className="mt-1 text-xs text-slate-600">
                The default is the classic textbook string. Compare Mode also opens on it, with 3
                frames: FIFO 15 faults, LRU 12, Optimal 9.
              </p>
            </div>

            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
                htmlFor="compareFrames"
              >
                frames
              </label>
              <input
                id="compareFrames"
                value={frameText}
                onChange={(event) => {
                  setFrameText(event.target.value);
                  setError(null);
                }}
                spellCheck={false}
                className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {error === null ? null : (
            <p
              data-testid="compare-error"
              className="mt-3 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          )}

          <div className="mt-3 grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="run-compare"
              onClick={handleRun}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition-colors hover:bg-sky-400"
            >
              run
            </button>
            <button
              type="button"
              data-testid="reset-compare"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-slate-500"
            >
              reset
            </button>
          </div>
        </section>

        {result === null ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-500">
            Run the exercise and each algorithm&apos;s column will appear here - the same
            reference string, three ways through it.
          </section>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-4 md:grid-cols-3">
              {result.columns.map((column) => (
                <AlgorithmCard key={column.algorithm} column={column} frameCount={result.frameCount} />
              ))}
            </section>
            <ReplacementTimeline columns={result.columns} referenceString={result.referenceString} />
          </div>
        )}
      </section>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        The three columns are one engine call each, against the same reference string. The
        algorithms differ; the exercise does not.
      </footer>
    </div>
  );
}

/**
 * The frame count to keep in the URL while the user types: the typed number when it
 * parses, otherwise the screen's own default. The real check happens on RUN, where a
 * rejected frame count becomes an inline error instead of a broken run.
 */
function frameCountFromText(text: string): number {
  const parsed = parseCompareFrameCount(text);
  return parsed.ok && parsed.value !== null ? parsed.value : DEFAULT_COMPARE_FRAME_COUNT;
}

