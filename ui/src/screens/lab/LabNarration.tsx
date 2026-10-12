/**
 * The Lab's "what did this access do?" card.
 *
 * Sits ABOVE the per-event `EventExplanation` in the result column. The two
 * answer different questions and both are needed:
 *
 *   this card    - what the whole ACCESS did (outcome first, then the journey)
 *   explanation  - what the event under the Step cursor says right now
 *
 * After pressing Access the cursor is on `CPU_MEMORY_ACCESS`, which explains
 * only "the CPU issued a read..." - the outcome (TLB hit, page table fill,
 * RAM address, or page fault) is invisible until the user discovers Step.
 * This card makes the outcome the first thing visible.
 *
 * Presentation only: the content comes from `summarizeAccess`, which reads
 * engine events and never computes anything itself.
 */

import type { JSX } from "react";

import { StatusBadge } from "../../design/feedback";
import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";
import { summarizeAccess } from "../../lib/accessNarration";
import type { SessionRecord } from "../../lib/session";

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

export function LabNarration({ record }: { record: SessionRecord | null }): JSX.Element | null {
  if (record === null || record.kind !== "access") {
    return null;
  }
  const narration = summarizeAccess(record.events);
  if (narration === null) {
    return null;
  }

  const outcomeTitle =
    narration.outcome.kind === "ram"
      ? `Reached RAM at ${hex(narration.outcome.physicalAddress)}`
      : `Page fault on page ${narration.outcome.pageNumber}`;

  return (
    <section
      data-testid="access-narration"
      data-tone={narration.tone}
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          What did this access do?
        </h2>
        <StatusBadge tone={narration.tone} icon={narration.icon}>
          {outcomeTitle}
        </StatusBadge>
      </header>

      <ol className="flex flex-col gap-2.5">
        {narration.steps.map((step, index) => (
          <li key={step.label} data-testid="narration-step" className="flex gap-3">
            <span
              aria-hidden="true"
              className={cx(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-chip text-[0.65rem] font-bold",
                step.tone === "fault" && "bg-fault-soft text-fault",
                step.tone === "hit" && "bg-hit-soft text-hit",
                step.tone === "primary" && "bg-primary-soft text-primary-strong",
              )}
              data-tone={step.tone}
            >
              {step.tone === "fault" ? (
                <Icon name="close" size={13} />
              ) : step.tone === "hit" ? (
                <Icon name="check" size={13} />
              ) : (
                <span className="num">{index + 1}</span>
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold uppercase tracking-wide text-ink">
                {step.label}
              </span>
              <span
                className={
                  step.tone === "fault"
                    ? "text-sm leading-relaxed text-fault"
                    : "text-sm leading-relaxed text-muted"
                }
              >
                {step.detail}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
