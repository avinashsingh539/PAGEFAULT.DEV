/**
 * The request that travels down the pipeline.
 *
 * It is the one moving element in the whole product, and the design brief allows
 * exactly one: a single request chip that sits on whichever component is currently
 * being worked on. More than one moving thing at a time turns a translation into
 * noise, and the learner stops being able to say "that is where we are".
 *
 * Under reduced motion the chip does not travel and does not pulse - it simply
 * appears on the active component, which is exactly where it would have landed.
 */

import type { JSX } from "react";

import { Icon } from "../Icon";
import { cx } from "../cx";
import { usePrefersReducedMotion } from "../motion";

export function MemoryRequest({
  address,
  accessKind,
  visible,
}: {
  /** The address the engine is translating, as already formatted by the caller. */
  address: string;
  accessKind: "read" | "write";
  /** False before the first access, so an idle pipeline shows no phantom request. */
  visible: boolean;
}): JSX.Element | null {
  const reduced = usePrefersReducedMotion();

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="memory-request"
      className="pointer-events-none sticky bottom-3 z-20 flex justify-center lg:static lg:justify-end"
    >
      <span
        className={cx(
          "inline-flex items-center gap-2 rounded-chip border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong shadow-card",
          !reduced && "animate-pulse",
        )}
      >
        <Icon name="bolt" size={13} />
        <span className="num">{address}</span>
        <span className="text-[0.6875rem] font-bold uppercase tracking-wide opacity-80">
          {accessKind}
        </span>
      </span>
    </div>
  );
}
