/**
 * The tour policy, pinned.
 *
 * `lib/tourState` holds every decision a tour makes - auto-start, progression
 * bounds, and what Skip/Finish persist - as pure functions, precisely so they can
 * be asserted here in plain Node. `prefs` is tested alongside because the policy
 * is only meaningful if "seen" round-trips through real storage: the two belong
 * together, since a policy that says "remember" and a store that forgets is the
 * same bug as no policy at all.
 *
 * The DOM half (`useTour`, `TourOverlay`) is deliberately NOT covered here - this
 * suite has no browser. Its behaviour is pinned by `e2e/tourLearn.spec.ts` and
 * `e2e/tourLab.spec.ts`, which drive the real overlay in a real page.
 */

import { describe, expect, it } from "vitest";

import {
  CLOSED_TOUR,
  advanceTour,
  autoStartIndex,
  finishTour,
  moveTourTo,
  openTour,
  retreatTour,
  skipTour,
} from "../../ui/src/lib/tourState";
import {
  TOUR_LAB,
  TOUR_LEARN,
  clearTourSeen,
  isTourSeen,
  markTourSeen,
  parseSeenKeys,
} from "../../ui/src/lib/prefs";

/** The smallest storage double that satisfies the `Pick<Storage, ...>` shapes. */
function memoryStorage(
  seed: Record<string, string> = {},
): { getItem(key: string): string | null; setItem(key: string, value: string): void; readonly map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    map,
  };
}

/** The exact key `prefs` persists the seen list under - asserted, not assumed. */
const TOURS_KEY = "pagefault:tours";

describe("tour auto-start", () => {
  it("opens on the first step for a first-time visitor", () => {
    expect(autoStartIndex(false)).toBe(0);
  });

  it("stays closed for a visitor who has already seen it", () => {
    expect(autoStartIndex(true)).toBeNull();
  });
});

describe("tour progression", () => {
  it("starts at the first step when opened", () => {
    expect(openTour()).toEqual({ index: 0 });
  });

  it("advances one step at a time", () => {
    const first = openTour();
    const second = advanceTour(first, 5);
    expect(second.index).toBe(1);
    expect(advanceTour(second, 5).index).toBe(2);
  });

  it("cannot advance past the last step", () => {
    expect(advanceTour({ index: 4 }, 5).index).toBe(4);
  });

  it("cannot retreat before the first step", () => {
    expect(retreatTour({ index: 0 }).index).toBe(0);
    expect(retreatTour({ index: 1 }).index).toBe(0);
  });

  it("clamps an out-of-range jump into the tour", () => {
    expect(moveTourTo(openTour(), 99, 5).index).toBe(4);
    expect(moveTourTo(openTour(), -3, 5).index).toBe(0);
  });

  it("ignores movement while closed", () => {
    expect(advanceTour(CLOSED_TOUR, 5)).toBe(CLOSED_TOUR);
    expect(retreatTour(CLOSED_TOUR)).toBe(CLOSED_TOUR);
    expect(moveTourTo(CLOSED_TOUR, 2, 5)).toBe(CLOSED_TOUR);
  });

  it("ignores movement when there are no steps to show", () => {
    expect(moveTourTo(openTour(), 1, 0).index).toBe(0);
  });
});

describe("tour dismissal", () => {
  it("closes on Skip", () => {
    expect(skipTour().state).toBe(CLOSED_TOUR);
  });

  it("closes on Finish", () => {
    expect(finishTour().state).toBe(CLOSED_TOUR);
  });

  it("persists BOTH Skip and Finish as seen - a dismissed tour must not nag", () => {
    expect(skipTour().markSeen).toBe(true);
    expect(finishTour().markSeen).toBe(true);
  });

  it("reopen starts at the first step regardless of how it was closed", () => {
    skipTour();
    expect(openTour().index).toBe(0);
  });
});

describe("prefs: the seen list round-trips", () => {
  it("remembers a tour after markTourSeen", () => {
    const storage = memoryStorage();
    expect(isTourSeen(storage, TOUR_LEARN)).toBe(false);

    markTourSeen(storage, TOUR_LEARN);

    expect(isTourSeen(storage, TOUR_LEARN)).toBe(true);
    // The regression this pins: `isTourSeen` once read a per-tour key that
    // `markTourSeen` never wrote, so a finished tour restarted every visit.
    expect(storage.map.get(TOURS_KEY)).toBe(JSON.stringify([TOUR_LEARN]));
  });

  it("keeps the two tours independent", () => {
    const storage = memoryStorage();
    markTourSeen(storage, TOUR_LEARN);

    // Finishing the Learn tour must not silently swallow the Lab tour.
    expect(isTourSeen(storage, TOUR_LAB)).toBe(false);

    markTourSeen(storage, TOUR_LAB);

    expect(isTourSeen(storage, TOUR_LEARN)).toBe(true);
    expect(isTourSeen(storage, TOUR_LAB)).toBe(true);
  });

  it("forgets exactly one tour on clearTourSeen", () => {
    const storage = memoryStorage();
    markTourSeen(storage, TOUR_LEARN);
    markTourSeen(storage, TOUR_LAB);

    clearTourSeen(storage, TOUR_LEARN);

    expect(isTourSeen(storage, TOUR_LEARN)).toBe(false);
    expect(isTourSeen(storage, TOUR_LAB)).toBe(true);
  });

  it("treats blocked storage as 'not seen' instead of throwing", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("SecurityError: storage is disabled");
      },
      setItem: (): void => {
        throw new Error("SecurityError: storage is disabled");
      },
    };

    expect(isTourSeen(blocked, TOUR_LEARN)).toBe(false);
    // A private window must not crash when the tour is dismissed either.
    expect(() => markTourSeen(blocked, TOUR_LEARN)).not.toThrow();
    expect(() => clearTourSeen(blocked, TOUR_LEARN)).not.toThrow();
  });

  it("survives garbage in the store", () => {
    const storage = memoryStorage({ [TOURS_KEY]: "not json at all" });
    expect(isTourSeen(storage, TOUR_LEARN)).toBe(false);

    const wrongType = memoryStorage({ [TOURS_KEY]: '{"a":1}' });
    expect(isTourSeen(wrongType, TOUR_LEARN)).toBe(false);

    const mixed = memoryStorage({ [TOURS_KEY]: '[42,"tour-learn",null]' });
    expect(isTourSeen(mixed, TOUR_LEARN)).toBe(true);
  });
});

describe("parseSeenKeys", () => {
  it("reads a well-formed list", () => {
    expect(parseSeenKeys('["a","b"]')).toEqual(["a", "b"]);
  });

  it("drops non-string entries", () => {
    expect(parseSeenKeys('[1,"keep",null,{}]')).toEqual(["keep"]);
  });

  it("treats null, empty and non-array input as 'nothing seen'", () => {
    expect(parseSeenKeys(null)).toEqual([]);
    expect(parseSeenKeys("")).toEqual([]);
    expect(parseSeenKeys("   ")).toEqual([]);
    expect(parseSeenKeys("{}")).toEqual([]);
    expect(parseSeenKeys("[[[")).toEqual([]);
  });
});
