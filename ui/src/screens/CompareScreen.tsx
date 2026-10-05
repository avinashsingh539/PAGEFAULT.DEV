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

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { compare, parseCompareFrameCount } from "../lib/compare";
import { parseReferenceString } from "../lib/fields";
import { DEFAULT_COMPARE_FRAME_COUNT, DEFAULT_COMPARE_REFERENCE_TEXT } from "../lib/compare";
import type { CompareResult } from "../lib/compare";
import type { LabUrlConfig } from "../lib/url";

import { EmptyState } from "../design/feedback";
import { CompareColumnCard } from "./compare/CompareColumnCard";
import { CompareInputPanel } from "./compare/CompareInputPanel";
import { CompareTrace } from "./compare/CompareTrace";

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
// Which access the learner is inspecting. `null` means "no access selected", and
  // that is NOT the same as "the end of the run": the cards then show the totals,
  // which is where the published FIFO 15 / LRU 12 / Optimal 9 live.
  const [selectedAccess, setSelectedAccess] = useState<number | null>(null);

  const accessCount = useMemo(() => {
    const parsed = parseReferenceString(referenceText);
    return parsed.ok ? parsed.value.length : null;
  }, [referenceText]);

  // A fresh run invalidates the previous selection: an access index from the old
  // string may not exist in the new one, and pointing at it would be a lie.
  const runAndClearSelection = useCallback((): void => {
    setSelectedAccess(null);
    handleRun();
  }, [handleRun]);

  return (
    <div className="flex flex-col gap-5">
      <section className="mx-auto w-full max-w-3xl">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          What happens when RAM runs out?
        </h2>
        <p className="mt-2 text-pretty leading-relaxed text-muted">
          Give the same list of pages to three algorithms and watch where they disagree. They
          are all correct - they simply disagree about which page is worth throwing away.
        </p>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)]">
        <CompareInputPanel
          referenceText={referenceText}
          onReferenceTextChange={(text) => {
            setReferenceText(text);
            setError(null);
          }}
          frameText={frameText}
          onFrameTextChange={(text) => {
            setFrameText(text);
            setError(null);
          }}
          onRun={runAndClearSelection}
          onReset={handleReset}
          error={error}
          accessCount={accessCount}
        />
      </div>

      {result === null ? (
        <div className="mx-auto w-full max-w-3xl">
          <EmptyState icon="route" title="Nothing compared yet" testId="compare-empty">
            Run the exercise and all three columns appear together, with the same input feeding
            each of them. The classic string with three frames gives FIFO 15 faults, LRU 12 and
            Optimal 9.
          </EmptyState>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            {result.columns.map((column) => (
              <CompareColumnCard
                key={column.algorithm}
                column={column}
                frameCount={result.frameCount}
                selectedIndex={selectedAccess}
              />
            ))}
          </div>

          <CompareTrace
            result={result}
            selectedIndex={selectedAccess}
            onSelect={setSelectedAccess}
          />
        </div>
      )}
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
