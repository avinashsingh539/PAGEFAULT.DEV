/**
 * The session event log: one row per event of the whole session, clickable.
 *
 * The verdict badge comes from the record's outcome (RAM address or faulted page),
 * which itself was read off the events - nothing here classifies anything.
 */

import type { JSX } from "react";

import type { SessionCursor, TimelineEntry, TimelineOutcome } from "../lib";

const OUTCOME_BADGES = {
  ram: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
  fault: "border-rose-400/50 bg-rose-500/10 text-rose-200",
  invalidate: "border-violet-400/50 bg-violet-400/10 text-violet-200",
  unmap: "border-amber-400/50 bg-amber-400/10 text-amber-200",
  flush: "border-violet-400/50 bg-violet-400/10 text-violet-200",
  none: "border-slate-800 bg-slate-950/60 text-slate-500",
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Event log
        </h2>
        <span className="text-xs text-slate-500">
          {cursor === null ? "no position" : `cursor at event ${cursor.eventIndex + 1} of action ${cursor.recordIndex + 1}`}
        </span>
      </header>
      <ol className="slim-scroll max-h-64 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-500">
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
                    active ? "bg-sky-500/15 text-sky-100" : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="num w-10 text-slate-500">#{entry.event.sequence}</span>
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
