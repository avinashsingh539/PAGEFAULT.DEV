/**
 * A contextual, anchored tour: one real interface element at a time.
 *
 * No tour engine, no new dependency. A tour is a list of steps, each naming a
 * `data-testid` already on screen; the overlay draws a ring around the first
 * matching element and parks a small card beside it.
 *
 * Robustness rules, because a tour that breaks the page is worse than no tour:
 * - a missing anchor degrades to a centered card instead of an exception;
 * - the ring re-computes on scroll and resize, so the tour survives both;
 * - `Escape` and Skip dismiss immediately; the backdrop never blocks the page
 *   (clicks pass through except on the card itself);
 * - Back / Next / step dots bound the index; Finish fires `onFinish`;
 * - reduced motion removes the card transition; the information stays.
 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { JSX, ReactNode } from "react";

import { isTourSeen, markTourSeen } from "../lib/prefs";
import {
  autoStartIndex,
  finishTour,
  moveTourTo,
  openTour,
  skipTour,
} from "../lib/tourState";
import type { TourState } from "../lib/tourState";
import { Icon } from "./Icon";
import { cx } from "./cx";

/** One beat of a tour. `anchor` is a `data-testid` already on screen. */
export interface TourStep {
  readonly id: string;
  /** `null` renders a centered card (for beats about screens, not elements). */
  readonly anchor: string | null;
  readonly title: string;
  readonly body: ReactNode;
}

interface AnchorRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

function rectOf(anchor: string | null): AnchorRect | null {
  if (anchor === null || typeof document === "undefined") {
    return null;
  }
  const element = document.querySelector(`[data-testid="${anchor}"]`);
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) {
    return null;
  }
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    right: box.right,
    bottom: box.bottom,
  };
}

/** True when the element's full border box lies inside the visual viewport. */
function isElementFullyVisible(element: HTMLElement): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.top >= 0 &&
    box.left >= 0 &&
    box.bottom <= window.innerHeight &&
    box.right <= window.innerWidth
  );
}

/**
 * Where to park the tour card so it does not cover the active target.
 * Tries below, above, right, then left of the target, clamped to the viewport.
 * On narrow screens it falls back to a bottom sheet.
 */
function computeCardPlacement(
  rect: AnchorRect | null,
  viewportWidth: number,
  viewportHeight: number,
): React.CSSProperties {
  const CARD_WIDTH = 320;
  const CARD_HEIGHT_EST = 240;
  const PADDING = 12;

  // Narrow screens: bottom sheet spanning the width.
  if (rect === null || viewportWidth < 640) {
    let top = viewportHeight - CARD_HEIGHT_EST - PADDING;
    if (rect !== null) {
      top = Math.min(Math.max(PADDING, rect.top - 8), viewportHeight - CARD_HEIGHT_EST - PADDING);
    }
    return {
      position: "fixed",
      top: Math.max(PADDING, Math.min(top, viewportHeight - CARD_HEIGHT_EST - PADDING)),
      left: PADDING,
      width: viewportWidth - 2 * PADDING,
    };
  }

  let top = 0;
  let left = 0;

  // Below the target.
  if (rect.bottom + PADDING + CARD_HEIGHT_EST <= viewportHeight) {
    top = rect.bottom + PADDING;
    left = rect.left;
  }
  // Above the target.
  else if (rect.top - PADDING - CARD_HEIGHT_EST >= 0) {
    top = rect.top - PADDING - CARD_HEIGHT_EST;
    left = rect.left;
  }
  // Right of the target.
  else if (rect.right + PADDING + CARD_WIDTH <= viewportWidth) {
    top = rect.top;
    left = rect.right + PADDING;
  }
  // Left of the target.
  else if (rect.left - PADDING - CARD_WIDTH >= 0) {
    top = rect.top;
    left = rect.left - PADDING - CARD_WIDTH;
  }
  // Centered fallback.
  else {
    top = (viewportHeight - CARD_HEIGHT_EST) / 2;
    left = (viewportWidth - CARD_WIDTH) / 2;
  }

  // Clamp so the card never leaves the viewport.
  top = Math.max(PADDING, Math.min(top, viewportHeight - CARD_HEIGHT_EST - PADDING));
  left = Math.max(PADDING, Math.min(left, viewportWidth - CARD_WIDTH - PADDING));

  return {
    position: "fixed",
    top,
    left,
    width: CARD_WIDTH,
  };
}

/**
 * The lifecycle of one product tour: auto-start on the first visit, remember
 * completion, and let the visitor reopen it at will.
 *
 * This hook is only the *adapter*. Every decision - when a tour appears, how far
 * Next and Back may move, what Skip and Finish persist - is a pure function in
 * `lib/tourState`, so it is pinned by the unit suite. All that lives here is the
 * two things a unit test cannot reach: React state, and `localStorage` (via
 * `prefs`, which swallows storage failures, so a private window with blocked
 * storage still gets a working - just forgetful - tour instead of a crash).
 */
export function useTour(
  tourId: string,
  totalSteps: number,
): {
  /** `null` when the tour is closed; otherwise the current step index. */
  readonly index: number | null;
  readonly start: () => void;
  readonly overlayProps: {
    readonly tourId: string;
    readonly index: number;
    readonly onIndexChange: (index: number) => void;
    readonly onFinish: () => void;
    readonly onSkip: () => void;
  } | null;
} {
  const [state, setState] = useState<TourState>({ index: null });

  // Auto-start on first visit only. Reading the flag in an effect (not during
  // render) keeps this SSR-safe and avoids a storage read on every render.
  useEffect(() => {
    const index = autoStartIndex(isTourSeen(window.localStorage, tourId));
    if (index !== null) {
      setState({ index });
    }
  }, [tourId]);

  // Reopen ignores the seen flag entirely: a "Take the tour" button that
  // sometimes does nothing would be a lie.
  const start = useCallback(() => setState(openTour()), []);

  // Skip and Finish share this path on purpose - both count as "seen".
  const dismiss = useCallback(
    (close: { readonly state: TourState; readonly markSeen: boolean }): void => {
      if (close.markSeen) {
        markTourSeen(window.localStorage, tourId);
      }
      setState(close.state);
    },
    [tourId],
  );

  const moveTo = useCallback(
    (next: number) => setState((current) => moveTourTo(current, next, totalSteps)),
    [totalSteps],
  );

  if (state.index === null) {
    return { index: null, start, overlayProps: null };
  }

  return {
    index: state.index,
    start,
    overlayProps: {
      tourId,
      index: state.index,
      onIndexChange: moveTo,
      onFinish: () => dismiss(finishTour()),
      onSkip: () => dismiss(skipTour()),
    },
  };
}


export function TourOverlay({
  tourId,
  steps,
  index,
  onIndexChange,
  onFinish,
  onSkip,
}: {
  tourId: string;
  steps: readonly TourStep[];
  index: number;
  onIndexChange: (index: number) => void;
  onFinish: () => void;
  onSkip: () => void;
}): JSX.Element | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const step = steps[index] ?? null;

  const measure = useCallback(() => {
    setRect(rectOf(step === null ? null : step.anchor));
  }, [step]);

  // Scroll the active target into view whenever the step changes, so the
  // element the beat describes is always visible without manual scrolling.
  useEffect(() => {
    const anchor = step?.anchor ?? null;
    if (anchor !== null && typeof document !== "undefined") {
      const element = document.querySelector(`[data-testid="${anchor}"]`);
      if (element instanceof HTMLElement && !isElementFullyVisible(element)) {
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "center",
          inline: "center",
        });
      }
    }
  }, [step]);

  // Re-measure after scrolling settles so the ring and card land correctly.
  useEffect(() => {
    const timer = window.setTimeout(measure, 400);
    return () => window.clearTimeout(timer);
  }, [step, measure]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  if (step === null) {
    return null;
  }

  const atFirst = index === 0;
  const atLast = index === steps.length - 1;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardStyle = computeCardPlacement(rect, window.innerWidth, window.innerHeight);

  return (
    <div data-testid={tourId} role="presentation">
      {/* Spotlight overlay strips: dim everything except the active target.
          pointer-events-none lets clicks pass through to the page underneath. */}
      {rect !== null && (
        <>
          <div
            className="fixed z-[68] pointer-events-none"
            style={{
              backgroundColor: "rgba(23, 33, 43, 0.55)",
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: Math.max(0, rect.top - 12),
            }}
          />
          <div
            className="fixed z-[68] pointer-events-none"
            style={{
              backgroundColor: "rgba(23, 33, 43, 0.55)",
              top: rect.bottom + 12,
              left: 0,
              width: window.innerWidth,
              height: Math.max(0, window.innerHeight - rect.bottom - 12),
            }}
          />
          <div
            className="fixed z-[68] pointer-events-none"
            style={{
              backgroundColor: "rgba(23, 33, 43, 0.55)",
              top: rect.top - 12,
              left: 0,
              width: Math.max(0, rect.left - 12),
              height: rect.height + 24,
            }}
          />
          <div
            className="fixed z-[68] pointer-events-none"
            style={{
              backgroundColor: "rgba(23, 33, 43, 0.55)",
              top: rect.top - 12,
              left: rect.right + 12,
              width: Math.max(0, window.innerWidth - rect.right - 12),
              height: rect.height + 24,
            }}
          />

          {/* Prominent highlight ring around the active target. */}
          <div
            className="pointer-events-none fixed z-[69] transition-all duration-300"
            style={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
            }}
          >
            <div
              className="inset-0 rounded-lg border-2 border-primary shadow-[0_0_0_6px_rgba(21,151,212,0.35)]"
            />
          </div>
        </>
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${tourId}-title`}
        data-testid={`${tourId}-card`}
        className={cx(
          "z-[71] rounded-panel border border-line bg-surface p-4 shadow-raised transition-opacity",
          prefersReduced ? "duration-0" : "duration-300",
        )}
        style={cardStyle}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary-strong">
          Guided tour · {index + 1} / {steps.length}
        </p>
        <h2 id={`${tourId}-title`} className="mt-1 text-base font-bold text-ink">
          {step.title}
        </h2>
        <div className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</div>

        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {steps.map((entry, dotIndex) => (
            <span
              key={entry.id}
              className={cx(
                "h-1.5 rounded-full",
                dotIndex === index ? "w-5 bg-primary" : "w-1.5 bg-line",
              )}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            disabled={atFirst}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors enabled:hover:bg-surface-soft disabled:opacity-40"
          >
            Back
          </button>
          {atLast ? (
            <button
              type="button"
              data-testid={`${tourId}-finish`}
              onClick={onFinish}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary"
            >
              <Icon name="check" size={15} />
              Finish
            </button>
          ) : (
            <button
              type="button"
              data-testid={`${tourId}-next`}
              onClick={() => onIndexChange(index + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary"
            >
              Next
              <Icon name="arrowRight" size={15} />
            </button>
          )}
          <button
            type="button"
            data-testid={`${tourId}-skip`}
            onClick={onSkip}
            className="ml-auto inline-flex min-h-11 items-center px-2 py-2 text-sm font-semibold text-muted hover:text-ink"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
