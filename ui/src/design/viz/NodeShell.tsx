/**
 * The shared box every pipeline component is drawn with.
 *
 * THE RULE OF THIS FILE: a node PAINTS a fact, it never DERIVES one.
 *
 * Everything shown here arrives as a prop that some other module read off an
 * engine event or off engine state. This file does not know what a TLB is, does
 * not split an address, and does not decide whether a lookup hit or missed. If it
 * did, the Lab and the lesson could disagree with each other and with the engine,
 * which is the one failure mode this codebase treats as unacceptable.
 *
 * STATUS IS NEVER COLOUR ALONE. Each state changes border style, background,
 * an icon and a word - so the pipeline is still readable in greyscale, to someone
 * who is colour-blind, and to a screen reader that never sees the colour.
 */

import { createContext, useContext } from "react";
import type { JSX, ReactNode } from "react";

import { Icon } from "../Icon";
import type { IconName } from "../Icon";
import { cx } from "../cx";

/**
 * Whether the station this node is drawing is the one a lesson step is about.
 *
 * A context rather than a seventh prop on all seven nodes: the value is the same
 * for every node in the pipeline and changes only when the step does, so passing
 * it down by hand would be seven signatures saying the same thing. It has to
 * land on the NODE element itself, because `data-focus` is part of the contract
 * the E2E suite reads alongside `data-testid="stage-..."`.
 */
const FocusContext = createContext(false);

export function FocusProvider({
  focused,
  children,
}: {
  focused: boolean;
  children: ReactNode;
}): JSX.Element {
  return <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>;
}

/**
 * How one component looks at the current cursor position.
 *
 * These are the same five states the old `StageStatus` used, kept identical on
 * purpose: a stage is idle before it is reached, active now, done once passed,
 * skipped when the access never reaches it, and fault when the translation died.
 */
export type NodeStatus = "idle" | "active" | "done" | "skipped" | "fault";

interface StatusStyle {
  readonly box: string;
  readonly badge: string;
  readonly label: string;
  readonly icon: IconName;
}

const STATUS_STYLES: Readonly<Record<NodeStatus, StatusStyle>> = {
  idle: {
    box: "border-line bg-surface",
    badge: "text-muted",
    label: "waiting",
    icon: "info",
  },
  active: {
    box: "border-primary bg-primary-soft ring-2 ring-primary/45",
    badge: "text-primary-strong",
    label: "now",
    icon: "bolt",
  },
  done: {
    box: "border-hit/35 bg-hit-soft",
    badge: "text-hit",
    label: "done",
    icon: "check",
  },
  fault: {
    box: "border-fault/45 bg-fault-soft ring-2 ring-fault/40",
    badge: "text-fault",
    label: "stopped",
    icon: "alert",
  },
  // Dashed, which is a SHAPE difference: "not on this path" is not the same
  // statement as "not started yet", and the border has to say so.
  skipped: {
    box: "border-dashed border-line bg-surface-soft opacity-70",
    badge: "text-muted",
    label: "skipped",
    icon: "close",
  },
};

export function nodeStatusStyle(status: NodeStatus): StatusStyle {
  return STATUS_STYLES[status];
}

export function NodeShell({
  title,
  subtitle,
  icon,
  status,
  testId,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  status: NodeStatus;
  /** Stable hook for E2E and for the focus dimming used by lessons. */
  testId?: string;
  children?: ReactNode;
  className?: string;
}): JSX.Element {
  const style = STATUS_STYLES[status];
  const focused = useContext(FocusContext);

  return (
    <div
      data-testid={testId}
      data-status={status}
      data-focus={focused ? "true" : "false"}
      data-viz-node={title.toLowerCase().replace(/\s+/g, "-")}
      className={cx(
        "relative flex min-w-0 flex-col gap-2 rounded-card border px-4 py-3 transition-[background-color,border-color,box-shadow,opacity] duration-300",
        style.box,
        status === "active" && "shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cx(
              "grid size-9 shrink-0 place-items-center rounded-[0.7rem]",
              status === "active"
                ? "bg-primary text-surface"
                : status === "done"
                  ? "bg-hit text-surface"
                  : status === "fault"
                    ? "bg-fault text-surface"
                    : "bg-surface-soft text-muted",
            )}
          >
            <Icon name={icon} size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{title}</p>
            {subtitle === undefined ? null : (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            )}
          </div>
        </div>

        <span
          className={cx(
            "flex shrink-0 items-center gap-1 rounded-chip bg-surface/70 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
            style.badge,
          )}
        >
          <Icon name={style.icon} size={12} />
          {style.label}
        </span>
      </div>

      {children}
    </div>
  );
}

/** A `label: value` line inside a node. Values are monospace by default. */
export function NodeFact({
  label,
  value,
  testId,
  mono = true,
}: {
  label: string;
  value: string;
  testId?: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted">{label}</span>
      <span
        data-testid={testId}
        className={cx(
          "truncate text-right font-semibold text-ink",
          mono && "num",
        )}
      >
        {value}
      </span>
    </div>
  );
}
