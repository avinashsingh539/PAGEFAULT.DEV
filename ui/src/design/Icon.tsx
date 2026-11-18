/**
 * The icon set.
 *
 * Icons are drawn here rather than pulled from a package because the product needs
 * about twenty of them and because every status in the UI is required to be
 * "icon + text + colour", never colour alone. Owning the source means the stroke
 * weight, the corner radius and the optical size stay consistent, and it costs no
 * bundle weight.
 *
 * All icons are 24x24, stroked (never filled) so they read at the same weight as
 * the Inter body text, and they inherit `currentColor` so a parent decides the
 * colour. `aria-hidden` is the default: an icon is decoration beside a label, and a
 * decorative SVG must not be announced. Where an icon is the ONLY content of a
 * control, that control must supply its own `aria-label`.
 */

import type { JSX } from "react";

import { cx } from "./cx";

const PATHS = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  alert: (
    <>
      <path d="M12 4.5l8.5 15h-17L12 4.5z" />
      <path d="M12 10v4" />
      <path d="M12 16.8h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </>
  ),
  arrowRight: <path d="M5 12h13m-5-6l6 6-6 6" />,
  arrowDown: <path d="M12 5v13m-6-6l6 6 6-6" />,
  chevronRight: <path d="M9.5 5.5l7 6.5-7 6.5" />,
  play: <path d="M7 4.5l12 7.5-12 7.5z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  step: (
    <>
      <path d="M6 5.5l8 6.5-8 6.5z" />
      <path d="M18 5v14" />
    </>
  ),
  /** "Jump to latest": a play-head step arriving at a final bar. */
  skipToEnd: (
    <>
      <path d="M4.5 5.5l8.5 6.5-8.5 6.5z" />
      <path d="M19.5 5v14" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.5 4.5V10h5.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4l8 4-8 4-8-4 8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 3.5v3.5M14 3.5v3.5M10 17v3.5M14 17v3.5" />
      <path d="M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" />
    </>
  ),
  memory: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 17v3M12 17v3M17 17v3" />
      <path d="M7 11v2M11 11v2M15 11v2" />
    </>
  ),
  bolt: <path d="M13.5 3L5.5 13.5H11l-.5 7.5 8-10.5H13l.5-7.5z" />,
  route: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17M10 10v9" />
    </>
  ),
  sparkle: <path d="M12 4l1.8 4.7L18.5 10.5 13.8 12.3 12 17l-1.8-4.7L5.5 10.5l4.7-1.8L12 4z" />,
  github: (
    <>
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C-4.42 20.803-4.66 20.55-4.66 20.55-3.57 19.53-1.39 19.57-1.39 19.57 1.48 19.35 2.27 19.54 2.27 19.54 3.14 19.75 4.75 19.33 5.55 18.81 6.45 17.72 7.05 17.53 7.95 7.25 8.03 7.32 7.95 8.99 6.32 9.28 9.12 9.42 10.19 9.42 10.7 10.19 10.7 11.8 10.28 12.28 10.77 12.42 11.25 11.93 12.27 11.7 12.42 12.41 11.5 13.08 11.74 12.66 12.72 11.18 12.54 12.81 12.04 12.96 12.74 13.24 13.49 10.77 14.23 11.09 15.28 10.21 15.75 9.53 16.07 8.81 16.07 7.16 16.07 5.69 15.78 4.75 14.84 5.06 14.73 5.06 14.73 4.33 13.68 4.85 13.12 5.62 12.86 6.54 12.24 7.86 12.04 9.44 11.43 10.07 11.43 10.61 11.96 11.28 12.35 11.76 12.29 12.56 11.98 12.89 12.34 12.59 12.89 12.89 13.27 13.27 13.65 12.89 14.13 12.55 14.49 13.32 14.13 14.85 13.58 14.85 13.58 14.23 14.37 14.7 14.94 14.7 15.38c0 .319.21.69.825.582C17.56 21.797 21 17.297 21 12.297c0-6.627-5.373-12-12-12"
      />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  size = 20,
  title,
}: {
  name: IconName;
  className?: string;
  size?: number;
  /** Supply only when the icon stands alone; otherwise it is decorative. */
  title?: string;
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
      role={title === undefined ? "presentation" : "img"}
      aria-hidden={title === undefined ? true : undefined}
      focusable="false"
    >
      {title === undefined ? null : <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
