/**
 * The machine settings, and the two maintenance actions.
 *
 * Every id here is part of an existing contract: #pageSize, #tlbCapacity and
 * #frameCount are the fields the E2E suite fills, apply-config is the button it
 * presses, and clear-tlb must keep reporting "(N cached)" in its own text because
 * that is how the suite checks a flush actually happened.
 *
 * NOTE ON ids: page size used to exist TWICE - a <select id="pageSize"> in the
 * access controls and an <input id="pageSize"> here - so element lookups had to
 * disambiguate with `input#pageSize`. Two elements claiming one id is invalid HTML
 * and it made the label association on one of them ambiguous. Consolidating on the
 * single text input below removes the defect rather than working around it, and
 * `input#pageSize` still resolves.
 */

import type { JSX } from "react";

import { REPLACEMENT_ALGORITHMS } from "../../../../engine";
import type { ReplacementAlgorithm } from "../../../../engine";

import { Icon } from "../../design/Icon";
import { InlineError } from "../../design/feedback";
import { cx } from "../../design/cx";
import {
  EXPERIMENT_FRAME_COUNT_OPTIONS,
  EXPERIMENT_PAGE_SIZE_OPTIONS,
} from "../../lib/experiment";
import type { ExperimentFieldErrors, ExperimentFormText } from "../../lib/experiment";

export function LabSettings({
  form,
  fieldErrors,
  formError,
  onFieldChange,
  onApply,
  onReset,
  tlbEnabled,
  tlbOccupied,
  maintenancePages,
  onClearTlb,
  onUnmapPage,
  onInvalidate,
}: {
  form: ExperimentFormText;
  fieldErrors: ExperimentFieldErrors;
  formError: string | null;
  onFieldChange: (field: keyof ExperimentFormText, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  tlbEnabled: boolean;
  tlbOccupied: number;
  maintenancePages: readonly number[];
  onClearTlb: () => void;
  onUnmapPage: (pageNumber: number) => void;
  onInvalidate: (pageNumber: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <NumberField
        id="pageSize"
        label="Page size (bytes)"
        hint="How big one page is. Changing this rebuilds the machine."
        value={form.pageSize}
        error={fieldErrors.pageSize}
        onChange={(value) => onFieldChange("pageSize", value)}
        list="page-size-options"
      />
      <datalist id="page-size-options">
        {EXPERIMENT_PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size} />
        ))}
      </datalist>

      <NumberField
        id="tlbCapacity"
        label="TLB entries"
        hint={'"none" builds a machine with no cache in front of the page table.'}
        value={form.tlbCapacity}
        error={fieldErrors.tlbCapacity}
        onChange={(value) => onFieldChange("tlbCapacity", value)}
      />

      <NumberField
        id="frameCount"
        label="Physical frames"
        hint="How much RAM the machine has. One page fits in one frame."
        value={form.frameCount}
        error={fieldErrors.frameCount}
        onChange={(value) => onFieldChange("frameCount", value)}
        list="frame-count-options"
      />
      <datalist id="frame-count-options">
        {EXPERIMENT_FRAME_COUNT_OPTIONS.map((count) => (
          <option key={count} value={count} />
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Replacement algorithm
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {REPLACEMENT_ALGORITHMS.map((algorithm: ReplacementAlgorithm) => (
            <button
              key={algorithm}
              type="button"
              data-testid={`algorithm-${algorithm}`}
              aria-pressed={form.algorithm === algorithm}
              onClick={() => onFieldChange("algorithm", algorithm)}
              className={cx(
                "min-h-11 rounded-control border px-2 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                form.algorithm === algorithm
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-line bg-surface text-muted hover:bg-surface-soft",
              )}
            >
              {algorithm === "OPTIMAL" ? "Optimal" : algorithm}
            </button>
          ))}
        </div>
        {fieldErrors.algorithm === undefined ? null : (
          <InlineError>{fieldErrors.algorithm}</InlineError>
        )}
      </fieldset>

      {formError === null ? null : (
        <p
          data-testid="config-error"
          role="alert"
          className="flex items-start gap-1.5 rounded-control bg-error-soft px-2.5 py-2 text-xs font-medium text-error"
        >
          <Icon name="alert" size={14} className="mt-px" />
          <span>{formError}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="apply-config"
          onClick={onApply}
          className="min-h-11 rounded-control bg-primary-strong px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-primary"
        >
          Apply
        </button>
        <button
          type="button"
          data-testid="reset-experiment"
          onClick={onReset}
          className="min-h-11 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Maintenance
        </span>
        <button
          type="button"
          data-testid="clear-tlb"
          disabled={!tlbEnabled}
          onClick={onClearTlb}
          className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
        >
          <span>Clear the TLB ({tlbOccupied} cached)</span>
          <Icon name="reset" size={16} />
        </button>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">
            Invalidate one cached translation (it will miss next time)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {maintenancePages.map((page) => (
              <button
                key={page}
                type="button"
                data-testid={`invalidate-page-${page}`}
                onClick={() => onInvalidate(page)}
                title={`invalidate the cached translation for page ${page}`}
                className="num min-h-9 min-w-11 rounded-chip border border-line bg-surface px-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-soft hover:text-ink"
              >
                p{page}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Unmap a page so the next access faults</span>
          <div className="flex flex-wrap gap-1.5">
            {maintenancePages.map((page) => (
              <button
                key={page}
                type="button"
                data-testid={`unmap-page-${page}`}
                onClick={() => onUnmapPage(page)}
                title={`unmap page ${page}`}
                className="num min-h-9 min-w-11 rounded-chip border border-line bg-surface px-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-soft hover:text-ink"
              >
                p{page}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A labelled text field that keeps its own error wired to the input. */
function NumberField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  list,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  list?: string;
}): JSX.Element {
  // `error-<field>`, matching the id convention the E2E suite reads.
  const errorId = `error-${id}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        list={list}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={cx(
          "num w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors",
          error === undefined ? "border-line focus:border-primary" : "border-error",
        )}
      />
      <p className="text-xs text-muted">{hint}</p>
      {error === undefined ? null : (
        <p
          id={errorId}
          data-testid={errorId}
          role="alert"
          className="text-xs font-medium text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
