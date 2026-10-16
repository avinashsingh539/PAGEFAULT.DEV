/**
 * First-visit persistence, with no assumptions about the environment.
 *
 * Tours, onboarding and any future "remember this choice" state read and write
 * through here. `localStorage` can be unavailable (private windows, blocked
 * storage, SSR-adjacent tests): the storage wrapper swallows those failures so a
 * denied preference write never breaks the screen, while the pure
 * `parseSeenKeys` keeps every rule unit-testable without a DOM.
 */

const NAMESPACE = "pagefault";

function key(name: string): string {
  return `${NAMESPACE}:${name}`;
}

/** Parse a stored "seen" list; garbage in means "nothing seen", never a throw. */
export function parseSeenKeys(raw: string | null): readonly string[] {
  if (raw === null || raw.trim() === "") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/** Has this named tour been completed or dismissed? */
export function isTourSeen(storage: Pick<Storage, "getItem">, tour: string): boolean {
  try {
    // Every tour shares ONE list under `pagefault:tours`; a per-tour key here would
    // never be written by `markTourSeen`, so the tour would restart on every visit.
    return parseSeenKeys(storage.getItem(key("tours"))).includes(tour);
  } catch {
    return false;
  }
}

/** Remember a tour as seen. Swallows storage failures; the UI must never crash. */
export function markTourSeen(storage: Pick<Storage, "setItem" | "getItem">, tour: string): void {
  try {
    const seen = new Set(parseSeenKeys(storage.getItem(key("tours"))));
    seen.add(tour);
    storage.setItem(key("tours"), JSON.stringify([...seen]));
  } catch {
    // A blocked or full store is not the learner's problem.
  }
}

/** Forget one tour (used by tests and by any future "reset onboarding" control). */
export function clearTourSeen(storage: Pick<Storage, "setItem" | "getItem">, tour: string): void {
  try {
    const seen = new Set(parseSeenKeys(storage.getItem(key("tours"))));
    seen.delete(tour);
    storage.setItem(key("tours"), JSON.stringify([...seen]));
  } catch {
    // Same guarantee as above: preferences never break the screen.
  }
}

export const TOUR_LEARN = "tour-learn";
export const TOUR_LAB = "tour-lab";
