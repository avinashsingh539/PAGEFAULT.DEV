/**
 * The Experiment screen's configuration panel: page size, TLB capacity, frame count
 * and replacement algorithm, plus the two maintenance actions.
 *
 * This component owns NO validation rules of its own. It renders the exact text the
 * user typed, shows the messages `validateExperimentConfig` produced for each field,
 * and reports changes upward. The engine remains the only thing that decides whether a
 * configuration is legal - this panel only makes the refusal visible next to the field
 * that caused it.
 */

import type { JSX } from "react";

import { REPLACEMENT_ALGORITHMS } from "../../../engine";
import { EXPERIMENT_FRAME_COUNT_OPTIONS, EXPERIMENT_PAGE_SIZE_OPTIONS } from "../lib/experiment";
import type { ExperimentFieldErrors, ExperimentFormText } from "../lib/experiment";

export interface ConfigPanelProps {
  readonly form: ExperimentFormText;
  readonly fieldErrors: ExperimentFieldErrors;
  readonly formError: string | null;
  readonly onFieldChange: (field: keyof ExperimentFormText, value: string) => void;
  readonly onApply: () => void;
  readonly onReset: () => void;
  readonly tlbEnabled: boolean;
  readonly tlbOccupied: number;
  /** Pages offered for the maintenance actions, in ascending order. */
  readonly maintenancePages: readonly number[];
  readonly onClearTlb: () => void;
  readonly onUnmapPage: (pageNumber: number) => void;
}

/** A labelled input with its own error line, so a refusal is never a mystery. */
function Field({
  id,
  label,
  value,
  error,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  hint?: string;
}): JSX.Element {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        className={`num w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ${
          error === undefined
            ? "border-slate-700 focus:border-sky-400"
            : "border-rose-500 focus:border-rose-400"
        }`}
      />
      {error === undefined ? (
        hint === undefined ? null : (
          <p className="mt-1 text-xs text-slate-600">{hint}</p>
        )
      ) : (
        <p id={`${id}-error`} data-testid={`error-${id}`} className="mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function ConfigPanel(props: ConfigPanelProps): JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        Experiment configuration
      </h2>

      <Field
        id="pageSize"
        label="page size (bytes)"
        value={props.form.pageSize}
        error={props.fieldErrors.pageSize}
        onChange={(value) => props.onFieldChange("pageSize", value)}
        hint={`presets: ${EXPERIMENT_PAGE_SIZE_OPTIONS.join(", ")}`}
      />

      <Field
        id="tlbCapacity"
        label="TLB entries (or none)"
        value={props.form.tlbCapacity}
        error={props.fieldErrors.tlbCapacity}
        onChange={(value) => props.onFieldChange("tlbCapacity", value)}
      />

      <Field
        id="frameCount"
        label="physical frames"
        value={props.form.frameCount}
        error={props.fieldErrors.frameCount}
        onChange={(value) => props.onFieldChange("frameCount", value)}
        hint={`presets: ${EXPERIMENT_FRAME_COUNT_OPTIONS.join(", ")}`}
      />

      <div className="mb-3">
        <span className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
          replacement algorithm
        </span>
        <div className="flex gap-2" role="group" aria-label="replacement algorithm">
          {REPLACEMENT_ALGORITHMS.map((algorithm) => (
            <button
              key={algorithm}
              type="button"
              data-testid={`algorithm-${algorithm}`}
              aria-pressed={props.form.algorithm === algorithm}
              onClick={() => props.onFieldChange("algorithm", algorithm)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold tracking-widest transition-colors ${
                props.form.algorithm === algorithm
                  ? "border-sky-400 bg-sky-500/15 text-sky-200"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"
              }`}
            >
              {algorithm}
            </button>
          ))}
        </div>
        {props.fieldErrors.algorithm === undefined ? null : (
          <p data-testid="error-algorithm" className="mt-1 text-xs text-rose-300">
            {props.fieldErrors.algorithm}
          </p>
        )}
      </div>

      {props.formError === null ? null : (
        <p
          data-testid="config-error"
          className="mb-2 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          {props.formError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="apply-config"
          onClick={props.onApply}
          className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition-colors hover:bg-sky-400"
        >
          apply
        </button>
        <button
          type="button"
          data-testid="reset-experiment"
          onClick={props.onReset}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-slate-500"
        >
          reset
        </button>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">maintenance</p>
        <button
          type="button"
          data-testid="clear-tlb"
          onClick={props.onClearTlb}
          disabled={!props.tlbEnabled}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-violet-200 transition-colors enabled:hover:border-violet-400/70 disabled:opacity-40"
        >
          clear TLB {props.tlbEnabled ? `(${props.tlbOccupied} cached)` : "(no TLB)"}
        </button>

        <p className="mb-2 mt-3 text-xs uppercase tracking-widest text-slate-500">unmap a page</p>
        <div className="flex flex-wrap gap-1.5">
          {props.maintenancePages.map((page) => (
            <button
              key={page}
              type="button"
              data-testid={`unmap-page-${page}`}
              onClick={() => props.onUnmapPage(page)}
              title={`remove the mapping for page ${page}`}
              className="num rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:border-rose-400/60 hover:text-rose-200"
            >
              p{page}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
