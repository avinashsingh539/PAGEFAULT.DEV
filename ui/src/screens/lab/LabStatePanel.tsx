/**
 * The machine's raw state: RAM frames, counters, and the event timeline.
 *
 * This is what Technical mode adds. Beginner mode is not a DIFFERENT machine with
 * less in it - it is the same machine with fewer raw numbers on screen, so every
 * value here is the same value the pipeline is drawing, read from the same engine
 * state. Nothing on this panel is computed; the frame occupancy comes straight
 * from `machine.memory.frames` and the counters straight from the session view.
 */

import type { JSX } from "react";

import type { MachineState } from "../../../../engine";

import { Icon } from "../../design/Icon";
import { cx } from "../../design/cx";
import { EventTimeline } from "../../design/viz/EventTimeline";
import type { TimelineStop } from "../../design/viz/EventTimeline";
import type { SessionCursor, SessionView } from "../../lib/session";

export function LabStatePanel({
  machine,
  view,
  cursor,
  stops,
  onSelectStop,
}: {
  machine: MachineState;
  view: SessionView;
  cursor: SessionCursor | null;
  stops: readonly TimelineStop[];
  onSelectStop: (stop: TimelineStop) => void;
}): JSX.Element {
  const touchedFrame = view.event?.type === "RAM_ACCESS" ? view.frameNumber : null;
  const frameCount = machine.memory.frameCount;
  const occupied = machine.memory.frames.filter((frame) => frame.pageNumber !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="memory" size={16} className="text-primary" />
            Physical memory
          </h2>
          <span className="num text-xs text-muted">
            {occupied}/{frameCount} frames used
          </span>
        </header>
        <ul className="grid grid-cols-4 gap-1.5" data-testid="frame-grid">
          {machine.memory.frames.map((frame) => {
            const hot = frame.frameNumber === touchedFrame;
            const free = frame.pageNumber === null;
            return (
              <li
                key={frame.frameNumber}
                data-testid={`frame-${frame.frameNumber}`}
                data-state={free ? "free" : "used"}
                className={cx(
                  "num rounded-chip border px-1.5 py-1.5 text-center text-xs transition-colors",
                  hot
                    ? "border-primary bg-primary-soft font-bold text-primary-strong"
                    : free
                      ? "border-dashed border-line bg-surface-soft text-muted"
                      : "border-line bg-surface text-ink",
                )}
              >
                <span className="block text-[0.625rem] uppercase tracking-wide opacity-70">
                  f{frame.frameNumber}
                </span>
                <span className="block font-semibold">
                  {free ? "free" : `p${frame.pageNumber}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="layers" size={16} className="text-primary" />
          This session
        </h2>
        <dl className="grid grid-cols-2 gap-2">
          <Counter label="accesses" value={view.hits + view.misses + view.faults} />
          <Counter label="TLB hits" value={view.hits} tone="text-hit" />
          <Counter label="TLB misses" value={view.misses} tone="text-info" />
          <Counter label="page faults" value={view.faults} tone="text-fault" />
          <Counter label="events" value={view.totalEvents} />
          <Counter label="actions" value={view.records} />
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="layers" size={16} className="text-primary" />
            Event timeline
          </h2>
          <span className="num text-xs text-muted">
            {stops.length} event{stops.length === 1 ? "" : "s"}
          </span>
        </header>
        <EventTimeline stops={stops} active={cursor} onSelect={onSelectStop} />
      </section>
    </div>
  );
}

function Counter({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-control border border-line bg-surface-soft px-3 py-2">
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cx("num text-lg font-bold", tone)}>{value}</dd>
    </div>
  );
}
