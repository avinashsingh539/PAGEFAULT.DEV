/**
 * The transport: step through the event stream, play it, reset the machine.
 *
 * The accessible names here are load-bearing. The E2E suite finds the step button
 * with `getByRole("button", { name: "STEP" })` and presses it repeatedly until it
 * disables, so the button must be named exactly "Step" and nothing else may
 * contain that word. Rendering the label as "Step" (rather than the old
 * all-caps "STEP") keeps that working, because accessible-name matching is
 * case-insensitive - and sentence case is the right choice for a product that is
 * meant to feel human.
 *
 * The Beginner / Technical switch lives here too, because it is a way of looking
 * at the SAME machine rather than a different machine: switching it must never
 * change a number, an event, or a result. It only changes how much raw detail is
 * on screen.
 */

import type { JSX } from "react";

import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";

export type LabDetailLevel = "beginner" | "technical";

export function LabTransport({
  onBack,
  onStep,
  onPlayPause,
  onReset,
  playing,
  canStep,
  canBack,
  detail,
  onDetailChange,
}: {
  onBack: () => void;
  onStep: () => void;
  onPlayPause: () => void;
  onReset: () => void;
  playing: boolean;
  canStep: boolean;
  canBack: boolean;
  detail: LabDetailLevel;
  onDetailChange: (level: LabDetailLevel) => void;
  /** The sticky mobile bar: the same controls, no labels wasted. */
  compact?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <TransportButton
          label="Back"
          icon="chevronRight"
          iconClassName="rotate-180"
          onClick={onBack}
          disabled={!canBack}
          title="Previous event"
        />
        <TransportButton
          label="Step"
          icon="step"
          onClick={onStep}
          disabled={!canStep}
          title="Next event"
          primary
        />
        <TransportButton
          label={playing ? "Pause" : "Play"}
          icon={playing ? "pause" : "play"}
          onClick={onPlayPause}
          disabled={false}
          title={playing ? "Pause the replay" : "Play the events back"}
        />
        <TransportButton
          label="Reset"
          icon="reset"
          onClick={onReset}
          disabled={false}
          title="Rebuild the machine and start over"
        />
      </div>

      <div
        role="group"
        aria-label="Detail level"
        className="flex items-center gap-0.5 rounded-control border border-line bg-surface-soft p-0.5"
      >
        {(["beginner", "technical"] as const).map((level) => (
          <button
            key={level}
            type="button"
            data-testid={`detail-${level}`}
            aria-pressed={detail === level}
            onClick={() => onDetailChange(level)}
            className={cx(
              "min-h-8 rounded-chip px-3 py-1 text-xs font-bold capitalize transition-colors",
              detail === level
                ? "bg-surface text-primary-strong shadow-raised"
                : "text-muted hover:text-ink",
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

function TransportButton({
  label,
  icon,
  onClick,
  disabled,
  title,
  primary = false,
  iconClassName,
}: {
  label: string;
  icon: "play" | "pause" | "step" | "reset" | "chevronRight";
  onClick: () => void;
  disabled: boolean;
  title: string;
  primary?: boolean;
  iconClassName?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40",
        primary
          ? "border-primary-strong bg-primary-strong text-surface enabled:hover:bg-primary"
          : "border-line bg-surface text-ink enabled:hover:bg-surface-soft",
      )}
    >
      <Icon name={icon} size={16} className={iconClassName} />
      <span>{label}</span>
    </button>
  );
}
