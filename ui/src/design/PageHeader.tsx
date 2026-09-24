/**
 * The page title block.
 *
 * Every routed page needs exactly one `<h1>` that says what the page IS, and the
 * old shell's `PAGEFAULT.DEV / MemoryLab` line was doing that job badly - it
 * named the app and the screen in one heading, so the screen had no heading of its
 * own. Page identity now belongs to the page.
 *
 * `eyebrow` and `lede` are optional so a screen can stay visually quiet (Compare is
 * dense and does not want a paragraph above it) without losing its `<h1>`.
 */

import type { JSX, ReactNode } from "react";

import { cx } from "./cx";

export function PageHeader({
  title,
  eyebrow,
  lede,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  lede?: string;
  actions?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {eyebrow === undefined ? null : (
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-strong">
            {eyebrow}
          </span>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {lede === undefined ? null : (
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
            {lede}
          </p>
        )}
      </div>
      {actions === undefined ? null : <div className="shrink-0">{actions}</div>}
    </div>
  );
}
