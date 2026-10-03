/**
 * The Lab's access controls: what to touch, and the button that touches it.
 *
 * The address box is the same `#address` input the E2E suite has always filled,
 * and ACCESS is still a button whose accessible name is exactly "ACCESS" - the
 * redesign changes how these look, not what they are.
 *
 * PRESETS ARE NOT A NEW MECHANISM. Each one fills the SAME address input and then
 * presses the SAME access button the visitor would press; a preset is a shortcut
 * for a sequence of real actions, so nothing it does can produce a state the
 * manual controls could not have produced. "Warm up the TLB", "trigger a page
 * fault" and "fill RAM" are therefore descriptions of what will happen, not a
 * parallel code path that makes it happen.
 */

import type { JSX } from "react";

import { Icon } from "../../design/Icon";
import { InlineError } from "../../design/feedback";
import { cx } from "../../design/cx";

/** A one-click sequence of ordinary accesses, described in learner language. */
export interface LabPreset {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

export function LabControls({
  addressText,
  onAddressTextChange,
  accessKind,
  onAccessKindChange,
  onAccess,
  presets,
  onPreset,
  presetBusy,
  error,
}: {
  addressText: string;
  onAddressTextChange: (text: string) => void;
  accessKind: "read" | "write";
  onAccessKindChange: (kind: "read" | "write") => void;
  onAccess: () => void;
  presets: readonly LabPreset[];
  onPreset: (preset: LabPreset) => void;
  /** True while a multi-access preset is still running, so the buttons lock. */
  presetBusy: boolean;
  error: string | null;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="address" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Virtual address
        </label>
        <input
          id="address"
          value={addressText}
          onChange={(event) => onAddressTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAccess();
            }
          }}
          spellCheck={false}
          inputMode="text"
          aria-describedby="address-help"
          placeholder="0x1345"
          className="num w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary"
        />
        <p id="address-help" className="text-xs text-muted">
          Decimal (4933) or hex (0x1345).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Access type</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Access type">
          {(["read", "write"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={accessKind === kind}
              onClick={() => onAccessKindChange(kind)}
              className={cx(
                "min-h-11 rounded-control border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                accessKind === kind
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-line bg-surface text-muted hover:bg-surface-soft",
              )}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onAccess}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary-strong px-4 text-base font-bold uppercase tracking-wide text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.99]"
      >
        <Icon name="bolt" size={18} />
        Access
      </button>

      {error === null ? null : (
        <InlineError>
          {error}
        </InlineError>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Try one of these
        </span>
        <ul className="flex flex-col gap-1.5">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                data-testid={`preset-${preset.id}`}
                disabled={presetBusy}
                onClick={() => onPreset(preset)}
                className="flex w-full items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-soft disabled:opacity-50"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-chip bg-primary-soft text-primary-strong">
                  <Icon name="sparkle" size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {preset.label}
                  </span>
                  <span className="block truncate text-xs text-muted">{preset.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
