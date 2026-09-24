/**
 * The event timeline: every event of the current session, in order, selectable.
 *
 * Two jobs. It lets a learner jump back to any step they have already seen - the
 * record of a run should be walkable in both directions, not just replayable
 * forwards. And in Technical mode it is where the raw event stream lives, so a
 * developer can read exactly which events fired rather than trusting a summary.
 *
 * It scrolls INSIDE ITSELF (`slim-scroll` + `overflow-y-auto`) with a bounded
 * height. A timeline that grows the page forever is the classic way a dense tool
 * becomes unusable on a laptop, and it is also the surest way to produce a
 * horizontal scrollbar on a phone.
 */

import type { JSX } from "react";

import { Icon } from "../Icon";
import { cx } from "../cx";
import { StatusBadge } from "../feedback";
import type { PresentedEvent } from "./EventExplanation";

/** One selectable stop on the timeline. */
export interface TimelineStop {
  readonly recordIndex: number;
  readonly eventIndex: number;
  readonly event: PresentedEvent;
}

export function EventTimeline({
  stops,
  active,
  onSelect,
  maxHeightClass = "max-h-80",
  className,
}: {
  stops: readonly TimelineStop[];
  /** The `{recordIndex, eventIndex}` currently under the cursor, or `null`. */
  active: { readonly recordIndex: number; readonly eventIndex: number } | null;
  onSelect: (stop: TimelineStop) => void;
  maxHeightClass?: string;
  className?: string;
}): JSX.Element {
  if (stops.length === 0) {
    return (
      <div
        data-testid="event-timeline"
        className={cx(
          "rounded-card border border-dashed border-line bg-surface/70 px-4 py-6 text-center text-sm text-muted",
          className,
        )}
      >
        Nothing has happened yet. Every event your machine produces will be listed here.
      </div>
    );
  }

  return (
    <ol
      data-testid="event-timeline"
      className={cx("slim-scroll flex flex-col gap-1 overflow-y-auto pr-1", maxHeightClass, className)}
    >
      {stops.map((stop) => {
        const isActive =
          active !== null &&
          stop.recordIndex === active.recordIndex &&
          stop.eventIndex === active.eventIndex;

        return (
          <li key={`${stop.recordIndex}-${stop.eventIndex}`}>
            <button
              type="button"
              data-testid={`timeline-stop-${stop.recordIndex}-${stop.eventIndex}`}
              onClick={() => onSelect(stop)}
              aria-current={isActive ? "true" : undefined}
              className={cx(
                "flex w-full items-center gap-3 rounded-control border px-3 py-2.5 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary-soft"
                  : "border-transparent hover:border-line hover:bg-surface-soft",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "num grid size-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold",
                  isActive ? "bg-primary text-surface" : "bg-surface-soft text-muted",
                )}
              >
                {stop.eventIndex + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-ink">
                  {stop.event.title}
                </span>
                <span className="block truncate text-xs text-muted">{stop.event.next}</span>
              </span>

              <StatusBadge tone={stop.event.tone} icon={stop.event.icon} className="shrink-0">
                {stop.event.tone === "fault" ? "stop" : stop.event.tone === "hit" ? "ok" : "info"}
              </StatusBadge>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** A heading + the timeline, used by every screen that shows one. */
export function EventTimelinePanel({
  stops,
  active,
  onSelect,
  title = "Event timeline",
}: {
  stops: readonly TimelineStop[];
  active: { readonly recordIndex: number; readonly eventIndex: number } | null;
  onSelect: (stop: TimelineStop) => void;
  title?: string;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="layers" size={16} className="text-primary" />
          {title}
        </h2>
        <span className="num text-xs text-muted">
          {stops.length} event{stops.length === 1 ? "" : "s"}
        </span>
      </header>
      <EventTimeline stops={stops} active={active} onSelect={onSelect} />
    </section>
  );
}
