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
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * The lifecycle of one product tour: auto-start on the first visit, remember
 * completion, and let the visitor reopen it at will.
 *
 * WHY THIS EXISTS: `TourOverlay` is deliberately dumb - it draws whatever step it
 * is handed and reports Back/Next/Skip/Finish. The *policy* (when does a tour
 * appear, how is "seen" remembered, can it be replayed) is the part every screen
 * needs identically, so it lives here once instead of being re-derived twice and
 * drifting.
 *
 * The rules, spelled out because they are the whole point:
 * - FIRST VISIT: the tour opens itself once. `isTourSeen` reads the persisted
 *   list, so a returning visitor is never nagged.
 * - SKIP and FINISH both count as "seen": a visitor who dismissed the tour does
 *   not deserve it jumping back at them on the next visit.
 * - REOPEN: `start()` ignores the seen flag entirely - the button that offers a
 *   replay must always work, or it is a lie.
 * - The storage reads/writes go through `prefs`, which swallows storage
 *   failures, so a private window with blocked storage still gets a working
 *   (just forgetful) tour instead of a crash.
 */
export function useTour(tourId: string): {
  /** `null` when the tour is closed; otherwise the current step index. */
  readonly index: number | null;
  readonly start: () => void;
  readonly close: () => void;
  readonly moveTo: (index: number) => void;
  readonly overlayProps: {
    readonly tourId: string;
    readonly index: number;
    readonly onIndexChange: (index: number) => void;
    readonly onFinish: () => void;
    readonly onSkip: () => void;
  } | null;
} {
  const [index, setIndex] = useState<number | null>(null);

  // Auto-start on first visit only. Reading the flag in an effect (not during
  // render) keeps this SSR-safe and avoids a storage read on every render.
  useEffect(() => {
    if (isTourSeen(window.localStorage, tourId)) {
      return;
    }
    setIndex(0);
  }, [tourId]);

  const start = useCallback(() => setIndex(0), []);
  const close = useCallback(() => {
    markTourSeen(window.localStorage, tourId);
    setIndex(null);
  }, [tourId]);
  const moveTo = useCallback((next: number) => setIndex(next), []);

  if (index === null) {
    return { index: null, start, close, moveTo, overlayProps: null };
  }

  return {
    index,
    start,
    close,
    moveTo,
    overlayProps: { tourId, index, onIndexChange: moveTo, onFinish: close, onSkip: close },
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

  // Card placement: beside the anchor on roomy screens, and a pinned bottom
  // sheet when there is no anchor or no horizontal room.
  const anchored = rect !== null && rect.left + rect.width < window.innerWidth - 340;
  const cardStyle =
    rect !== null && anchored
      ? {
          position: "fixed" as const,
          top: Math.min(Math.max(12, rect.top - 8), window.innerHeight - 220),
          left: Math.min(rect.left + rect.width + 12, window.innerWidth - 340),
          width: 320,
        }
      : undefined;

  return (
    <div data-testid={`tour-${tourId}`} role="presentation">
      {rect === null ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[70] rounded-xl border-2 border-dashed border-primary transition-all"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={`tour-${tourId}-title`}
        data-testid={`tour-${tourId}-card`}
        className={cx(
          "z-[71] rounded-panel border border-line bg-surface p-4 shadow-raised",
          cardStyle === undefined
            ? "fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80"
            : "",
        )}
        style={cardStyle}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary-strong">
          Guided tour · {index + 1} / {steps.length}
        </p>
        <h2 id={`tour-${tourId}-title`} className="mt-1 text-base font-bold text-ink">
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
              data-testid={`tour-${tourId}-finish`}
              onClick={onFinish}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary"
            >
              <Icon name="check" size={15} />
              Finish
            </button>
          ) : (
            <button
              type="button"
              data-testid={`tour-${tourId}-next`}
              onClick={() => onIndexChange(index + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary"
            >
              Next
              <Icon name="arrowRight" size={15} />
            </button>
          )}
          <button
            type="button"
            data-testid={`tour-${tourId}-skip`}
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
