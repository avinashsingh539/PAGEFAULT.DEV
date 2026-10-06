/**
 * The session event log: one row per event of the whole session, clickable.
 *
 * The verdict badge comes from the record's outcome (RAM address or faulted page),
 * which itself was read off the events - nothing here classifies anything.
 */

import type { JSX } from "react";

import type { SessionCursor, TimelineEntry, TimelineOutcome } from "../lib";

const OUTCOME_BADGES = {
  ram: "border-hit/50 bg-hit-soft text-hit",
  fault: "border-error/60 bg-error-soft text-error",
  invalidate: "border-violet-400/50 bg-violet-400/10 text-info",
  unmap: "border-fault/50 bg-fault-soft text-fault",
  flush: "border-violet-400/50 bg-violet-400/10 text-info",
  none: "border-line bg-surface-soft text-muted",
} as const;

/** The badge text for one record outcome, read off the outcome the session derived. */
function outcomeLabel(outcome: TimelineOutcome): string {
  switch (outcome.kind) {
    case "ram":
      return `RAM 0x${outcome.physicalAddress.toString(16)}`;
    case "fault":
      return `fault p${outcome.pageNumber}`;
    case "invalidate":
      return `drop p${outcome.pageNumber}`;
    case "unmap":
      return `unmap p${outcome.pageNumber} (f${outcome.frameNumber})`;
    case "flush":
      return `flushed ${outcome.dropped}`;
    case "none":
      return "—";
  }
}

export function Timeline({
  entries,
  cursor,
  onSelect,
}: {
  entries: readonly TimelineEntry[];
  cursor: SessionCursor | null;
  onSelect: (entry: TimelineEntry) => void;
}): JSX.Element {
  return (
    <section className="rounded-card border border-line bg-surface shadow-raised">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          Event log
        </h2>
        <span className="text-xs text-muted">
          {cursor === null ? "no position" : `cursor at event ${cursor.eventIndex + 1} of action ${cursor.recordIndex + 1}`}
        </span>
      </header>
      <ol className="slim-scroll max-h-64 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted">
            The log is empty. Run an access and every event will land here.
          </li>
        ) : (
          entries.map((entry) => {
            const active =
              cursor !== null &&
              cursor.recordIndex === entry.recordIndex &&
              cursor.eventIndex === entry.eventIndex;
            return (
              <li key={`${entry.recordIndex}-${entry.eventIndex}`}>
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                    active ? "bg-primary-soft text-primary-strong" : "text-ink hover:bg-line/60"
                  }`}
                >
                  <span className="num w-10 text-muted">#{entry.event.sequence}</span>
                  <span className="flex-1 font-medium">{entry.event.type}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${OUTCOME_BADGES[entry.outcome.kind]}`}
                  >
                    {outcomeLabel(entry.outcome)}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}
