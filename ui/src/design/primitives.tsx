/**
 * Layout primitives: the handful of layout shapes every screen reuses.
 *
 * These exist so that page rhythm is decided ONCE. A screen that invents its own
 * container, card padding or button height is how a product drifts into looking
 * assembled rather than designed, so those three things are exported here and
 * used everywhere instead.
 *
 * Nothing here knows anything about memory, paging or the engine: these are
 * boxes and spacing, nothing more.
 */

import type { JSX, ReactNode } from "react";

import { cx } from "./cx";

/**
 * The responsive container.
 *
 * `wide` is for the full-bleed lab working area; the default is for prose and
 * marketing sections. The `px` is deliberately generous at 360px so nothing ever
 * touches the bezel, and the max width caps the line length on 1920px instead of
 * letting content stretch into unreadable ribbons.
 */
export function Container({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: "default" | "wide" | "narrow";
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cx(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-6xl",
        width === "wide" && "max-w-[100rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vertical rhythm between major page sections. */
export function Section({
  children,
  className,
  id,
  spacing = "default",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  spacing?: "tight" | "default" | "loose";
}): JSX.Element {
  return (
    <section
      id={id}
      className={cx(
        spacing === "tight" && "py-10 sm:py-12",
        spacing === "default" && "py-14 sm:py-20",
        spacing === "loose" && "py-20 sm:py-28",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A titled band: eyebrow + heading + optional lede, aligned with the page grid. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
  headingLevel = 2,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  className?: string;
  headingLevel?: 2 | 3;
}): JSX.Element {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cx(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow === undefined ? null : (
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-strong">
          {eyebrow}
        </span>
      )}
      <Heading
        className={cx(
          "text-balance font-bold text-ink",
          headingLevel === 2 ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl",
        )}
      >
        {title}
      </Heading>
      {lede === undefined ? null : (
        <p
          className={cx(
            "text-pretty text-base leading-relaxed text-muted",
            align === "center" ? "max-w-2xl" : "max-w-2xl",
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

/**
 * The card: the default raised surface for grouped content.
 *
 * `interactive` adds the hover lift used by anything that is genuinely clickable,
 * so decorative cards do not invite a click they cannot honour.
 */
export function Card({
  children,
  className,
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "article" | "li" | "section";
}): JSX.Element {
  return (
    <Tag
      className={cx(
        "rounded-card border border-line bg-surface shadow-raised",
        interactive &&
          "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** A hairline divider that matches the token border. */
export function Divider({ className }: { className?: string }): JSX.Element {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}
