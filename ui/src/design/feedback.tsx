/**
 * Feedback primitives: status, explanation, emptiness, loading and errors.
 *
 * These are the pieces every screen reaches for when it needs to tell the truth
 * about what just happened, what is missing, or what went wrong. They are shared
 * because the single most common way a product like this loses trust is saying
 * the same thing three different ways on three different screens.
 *
 * The accessibility rule they all obey: STATUS IS NEVER COLOUR ALONE. Every badge
 * carries an icon and a word, so the meaning survives greyscale, colour blindness
 * and a screen reader that never sees the colour at all.
 */

import type { JSX, ReactNode } from "react";

import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { cx } from "./cx";

export type BadgeTone = "hit" | "fault" | "error" | "info" | "neutral" | "primary";

const TONE_STYLES: Readonly<Record<BadgeTone, { readonly box: string; readonly icon: IconName }>> = {
  hit: { box: "bg-hit-soft text-hit", icon: "check" },
  fault: { box: "bg-fault-soft text-fault", icon: "alert" },
  error: { box: "bg-error-soft text-error", icon: "alert" },
  info: { box: "bg-info-soft text-info", icon: "info" },
  primary: { box: "bg-primary-soft text-primary-strong", icon: "bolt" },
  neutral: { box: "bg-surface-soft text-muted", icon: "info" },
};

export function StatusBadge({
  tone,
  children,
  className,
  icon,
  testId,
}: {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Override only when the default icon would misdescribe the status. */
  icon?: IconName;
  testId?: string;
}): JSX.Element {
  const style = TONE_STYLES[tone];
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        style.box,
        className,
      )}
    >
      <Icon name={icon ?? style.icon} size={13} />
      {children}
    </span>
  );
}

/**
 * A titled block of explanation.
 *
 * `headingLevel` defaults to 3 because an ExplanationCard almost always sits
 * inside a page that already owns the `<h1>` and the section `<h2>`; making it a
 * heading at all is what lets a screen-reader user jump between explanations.
 */
export function ExplanationCard({
  title,
  children,
  actions,
  headingLevel = 3,
  tone = "neutral",
  className,
  testId,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  tone?: BadgeTone;
  className?: string;
  testId?: string;
}): JSX.Element {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  return (
    <section
      data-testid={testId}
      className={cx(
        "flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading className="text-sm font-bold text-ink">{title}</Heading>
        {actions}
      </div>
      <div className={cx("text-sm leading-relaxed text-muted", tone === "neutral" && "")}>
        {children}
      </div>
    </section>
  );
}

/**
 * What a screen shows when it has nothing to show yet.
 *
 * An empty dashboard is the failure this component exists to prevent: blank grids
 * and dashes teach nothing. An empty state always names what will appear here and
 * gives the visitor a way to make it appear - here, a button.
 */
export function EmptyState({
  icon = "bolt",
  title,
  children,
  action,
  testId,
  className,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  testId?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      data-testid={testId}
      className={cx(
        "flex flex-col items-center gap-3 rounded-panel border border-dashed border-line bg-surface/70 px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-[0.9rem] bg-primary-soft text-primary-strong"
      >
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {children === undefined ? null : (
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * A loading placeholder.
 *
 * Shaped like the content it stands in for, so the layout does not jump when the
 * real thing arrives. It is `aria-hidden` and paired with a live region by whoever
 * renders it, because a skeleton is decoration, not an announcement.
 */
export function Skeleton({
  className,
  lines = 1,
}: {
  className?: string;
  lines?: number;
}): JSX.Element {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-chip bg-surface-soft"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

/**
 * An error attached to a field or to a form.
 *
 * The message is wired to its control with `aria-describedby` and the control is
 * marked `aria-invalid` by the caller, so the pairing is announced rather than
 * merely drawn next to each other.
 */
export function InlineError({
  children,
  id,
  className,
}: {
  children: ReactNode;
  /** Must be the id of the element this describes. */
  id?: string;
  className?: string;
}): JSX.Element {
  return (
    <p
      id={id}
      role="alert"
      data-testid="inline-error"
      className={cx(
        "flex items-start gap-1.5 rounded-control bg-error-soft px-2.5 py-1.5 text-xs font-medium text-error",
        className,
      )}
    >
      <Icon name="alert" size={14} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}
