/**
 * "What just happened?" - the persistent explanation panel.
 *
 * Every event in this product has to answer four questions, and this component is
 * the only place that is allowed to ask them:
 *
 *   STATE - what the machine looked like before this
 *   EVENT - what actually happened
 *   WHY   - why it happened
 *   NEXT  - what happens next
 *
 * The text arrives fully formed from `lib/eventPresentation.ts`. This component
 * does not phrase anything, because if two screens phrased it differently the
 * explanation would be the thing that taught differently on each screen - and an
 * explanation that differs between pages is not an explanation, it is a rumour.
 *
 * `aria-live="polite"` is deliberate and not decoration. The whole point of the
 * panel is that a screen-reader user who pressed Step learns what happened; an
 * explanation that is not announced is silence. `polite` rather than `assertive`
 * because stepping through events is the user's own action and must not interrupt.
 */

import type { JSX } from "react";

import { Icon } from "../Icon";
import type { IconName } from "../Icon";
import { StatusBadge } from "../feedback";
import type { BadgeTone } from "../feedback";
import { cx } from "../cx";

/**
 * The shape an event's presentation must have.
 *
 * Declared here, next to the component that consumes it, so that adding an event
 * to `eventPresentation.ts` without giving it all four answers is a TYPE ERROR
 * rather than a silent blank panel in production.
 */
export interface PresentedEvent {
  /** Short label, e.g. "TLB MISS". */
  readonly title: string;
  /** Where the machine was before this event. */
  readonly state: string;
  /** What happened, in one sentence. */
  readonly what: string;
  /** Why it happened. */
  readonly why: string;
  /** What happens next - the most useful line for a beginner. */
  readonly next: string;
  readonly tone: BadgeTone;
  readonly icon: IconName;
  /** Raw values, shown in Technical mode. */
  readonly facts: readonly { readonly label: string; readonly value: string }[];
}

export function EventExplanation({
  event,
  showFacts = false,
  className,
  testId = "event-explanation",
}: {
  /** `null` means the visitor has not done anything yet: show the prompt, not a blank. */
  event: PresentedEvent | null;
  showFacts?: boolean;
  className?: string;
  testId?: string;
}): JSX.Element {
  if (event === null) {
    return (
      <div
        data-testid={testId}
        className={cx(
          "flex flex-col items-center gap-2 rounded-panel border border-dashed border-line bg-surface/70 px-5 py-8 text-center",
          className,
        )}
      >
        <span className="grid size-11 place-items-center rounded-[0.8rem] bg-primary-soft text-primary-strong">
          <Icon name="bolt" size={22} />
        </span>
        <h3 className="text-base font-bold text-ink">Your first memory access</h3>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          Enter an address to start watching the translation process.
        </p>
      </div>
    );
  }

  return (
    <section
      data-testid={testId}
      data-tone={event.tone}
      aria-live="polite"
      aria-atomic="true"
      className={cx(
        "flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          What just happened?
        </h2>
        <StatusBadge tone={event.tone} icon={event.icon}>
          {event.title}
        </StatusBadge>
      </header>

      {/* A real description list: the four answers are label/value pairs, and a
          screen reader should be able to jump between the labels. */}
      <dl className="flex flex-col gap-3">
        <Line label="State" text={event.state} />
        <Line label="What happened" text={event.what} strong />
        <Line label="Why" text={event.why} />
        <Line label="Next" text={event.next} tone={event.tone} />
      </dl>

      {showFacts && event.facts.length > 0 ? (
        <dl
          data-testid="event-facts"
          className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-line pt-3 sm:grid-cols-2"
        >
          {event.facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="shrink-0 text-muted">{fact.label}</dt>
              <dd className="num truncate text-right font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function Line({
  label,
  text,
  strong = false,
  tone,
}: {
  label: string;
  text: string;
  strong?: boolean;
  tone?: BadgeTone;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted sm:w-36">
        {label}
      </dt>
      <dd
        className={cx(
          "text-sm leading-relaxed",
          strong ? "font-semibold text-ink" : "text-muted",
          tone === "fault" && "text-fault",
          tone === "hit" && "text-hit",
        )}
      >
        {text}
      </dd>
    </div>
  );
}
