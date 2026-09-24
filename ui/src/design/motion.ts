/**
 * Motion utilities.
 *
 * Task 14 completes this file with the full reveal system (variants, scroll
 * triggers, hover/tap springs). The reduced-motion hook is here already because the
 * travelling request chip is not allowed to move for someone who has asked their
 * operating system to stop moving things - and a hook that only arrives in Task 14
 * would mean shipping an unconditional animation first.
 *
 * The rule this file exists to enforce:
 *
 *   ON REDUCED MOTION, NOTHING DISAPPEARS. Travelling elements stop travelling,
 *   highlights stay, every explanation stays, every value stays. Motion is
 *   removed; information is never removed.
 */

import { useEffect, useState } from "react";

/**
 * True when the visitor has asked for reduced motion.
 *
 * Starts `false` and corrects on mount rather than reading the media query during
 * render: the query is a browser API, and rendering must stay pure so that
 * server-side rendering and the first client render agree.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(query.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setPrefers(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return prefers;
}

/**
 * The reveal specification from the design brief, kept in one place so that every
 * section on every page arrives the same way.
 */
export const REVEAL = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
} as const;

/** The same reveal with the travel removed, for reduced motion. */
export const REVEAL_STATIC = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
} as const;
