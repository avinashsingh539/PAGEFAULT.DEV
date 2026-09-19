/**
 * The translation pipeline: one column per stage, coloured by the cursor.
 *
 * This component owns no logic beyond picking a Tailwind class for a status; the
 * statuses come from `stageStatuses()` and the payloads shown in the active column
 * come from the event under the cursor.
 */

import type { JSX } from "react";

import type { SessionRecord, SessionView } from "../lib";
import type { StageStatus } from "../lib/stages";
import { PIPELINE_COLUMNS, stageStatuses, stageTitle } from "../lib/stages";

const STATUS_CLASSES: Record<StageStatus, string> = {
  idle: "border-slate-800 bg-slate-900/40 text-slate-500",
  done: "border-slate-700 bg-slate-800/70 text-slate-300",
  active: "border-sky-400 bg-sky-500/15 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.25)]",
  skipped: "border-slate-800 bg-slate-950 text-slate-600 border-dashed",
  fault: "border-rose-400 bg-rose-500/15 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.25)]",
};

const STATUS_BADGES: Record<StageStatus, string> = {
  idle: "",
  done: "done",
  active: "now",
  skipped: "skipped",
  fault: "fault",
};

export function Pipeline({ view, record }: { view: SessionView; record: SessionRecord | null }): JSX.Element {
  const statuses = stageStatuses(record, view);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Translation pipeline
        </h2>
        <span className="text-xs text-slate-500">
          {view.event === null ? "waiting for an access" : `event ${view.eventPosition ?? "?"} of this access`}
        </span>
      </header>

      <ol className="flex flex-col gap-2">
        {PIPELINE_COLUMNS.map((stage) => {
          const status = statuses[stage];
          return (
            <li
              key={stage}
              data-testid={`stage-${stage}`}
              data-status={status}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-200 ${STATUS_CLASSES[status]}`}
            >
              <span className="text-sm font-medium">{stageTitle(stage)}</span>
              <span className="num text-xs uppercase tracking-widest">{STATUS_BADGES[status]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
