/**
 * The policy of a product tour, as pure functions.
 *
 * WHY THIS IS ITS OWN MODULE: `useTour` (in `design/Tour.tsx`) is React state and
 * effects, which the unit suite cannot reach - it runs in plain Node with no DOM.
 * Every *decision* a tour makes is lifted out here instead, so progression bounds,
 * first-visit auto-start, and the persistence rule are all pinned by ordinary unit
 * tests, and the hook becomes a thin adapter that only touches storage and React.
 * This is the same split the project already uses for the lesson's keyboard rules
 * (`lessonCommandFor`) - the rule is testable without a browser, and the DOM half
 * is a few lines that just calls it.
 *
 * THE THREE RULES, spelled out because they are the whole point:
 * - AUTO-START: a tour opens itself exactly once - on the first visit. A visitor
 *   who has already finished or dismissed it is never nagged again.
 * - PROGRESSION: Next cannot walk past the last step, Back cannot go before the
 *   first, and a tour that is closed ignores movement entirely.
 * - DISMISSAL: Skip and Finish behave identically for persistence - both count as
 *   "seen". A visitor who dismissed the tour does not deserve it jumping back on
 *   the next visit. Reopening is the only way back in, and it never consults the
 *   seen flag - a "Take the tour" button that sometimes does nothing would be a lie.
 */

/** What a tour is doing right now. `index: null` means closed. */
export interface TourState {
  readonly index: number | null;
}

/** The resting state: closed. */
export const CLOSED_TOUR: TourState = { index: null };

/**
 * Should the tour open itself on this visit? Returns the step to open at, or
 * `null` for "stay closed because it has already been seen".
 */
export function autoStartIndex(alreadySeen: boolean): number | null {
  return alreadySeen ? null : 0;
}

/** Open (or reopen) at the first step, ignoring whether it was ever seen. */
export function openTour(): TourState {
  return { index: 0 };
}

/** Move to a specific step, clamped into `[0, totalSteps - 1]`. */
export function moveTourTo(state: TourState, index: number, totalSteps: number): TourState {
  if (state.index === null || totalSteps <= 0) {
    return state;
  }
  const bounded = Math.min(Math.max(Math.trunc(index), 0), totalSteps - 1);
  return { index: bounded };
}

/** Next step, clamped so the last step cannot be stepped past. */
export function advanceTour(state: TourState, totalSteps: number): TourState {
  if (state.index === null) {
    return state;
  }
  return moveTourTo(state, state.index + 1, totalSteps);
}

/** Previous step, clamped at the first step. */
export function retreatTour(state: TourState): TourState {
  if (state.index === null) {
    return state;
  }
  return moveTourTo(state, state.index - 1, 1);
}

/** The outcome of closing a tour: the new state, plus whether to remember it. */
export interface TourClose {
  readonly state: TourState;
  /** Skip and Finish both persist; the rule is data so a test can assert it. */
  readonly markSeen: boolean;
}

/** Skip: dismiss without finishing. Still counts as seen - see the rules above. */
export function skipTour(): TourClose {
  return { state: CLOSED_TOUR, markSeen: true };
}

/** Finish: the visitor completed every step. Counts as seen, like Skip. */
export function finishTour(): TourClose {
  return { state: CLOSED_TOUR, markSeen: true };
}
