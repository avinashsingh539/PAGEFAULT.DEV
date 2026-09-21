/**
 * The translation pipeline: one column per stage, coloured by the cursor.
 *
 * This component owns no logic beyond picking a Tailwind class for a status; the
 * statuses come from `stageStatuses()` and the payloads shown in the active column
 * come from the event under the cursor.
 *
 * `focus` is optional and used by Learn Mode: when it names a stage, that row becomes
 * the subject of the screen and every other row is dimmed, with a connector naming the
 * next station in the chain. Leaving it out (as the Experiment screen does) changes
 * nothing about how the pipeline is drawn.
 */

import type { JSX } from "react";

import type { PipelineStage, SessionRecord, SessionView } from "../lib";
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

export function Pipeline({
  view,
  record,
  focus = null,
}: {
  view: SessionView;
  record: SessionRecord | null;
  /** Learn Mode: the stage this step is about. `null` keeps every row at full strength. */
  focus?: PipelineStage | null;
}): JSX.Element {
  const statuses = stageStatuses(record, view);
  const focusIndex = focus === null ? -1 : PIPELINE_COLUMNS.indexOf(focus);
  // `fault` ends the translation: after it there is no next station to name.
  const nextStage =
    focusIndex === -1 || focus === "fault"
      ? null
      : (PIPELINE_COLUMNS[focusIndex + 1] ?? null);

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
          const isFocus = stage === focus;
          const dimmed = focus !== null && !isFocus;

          return (
            <li
              key={stage}
              data-testid={`stage-${stage}`}
              data-status={status}
              data-focus={isFocus ? "true" : "false"}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-opacity duration-200 ${STATUS_CLASSES[status]} ${
                dimmed ? "opacity-35" : ""
              } ${isFocus ? "ring-2 ring-sky-400/70" : ""}`}
            >
              <span className="text-sm font-medium">{stageTitle(stage)}</span>
              <span className="num text-xs uppercase tracking-widest">{STATUS_BADGES[status]}</span>
            </li>
          );
        })}
      </ol>

      {focusIndex === -1 ? null : (
        <p className="mt-3 text-xs text-slate-500" data-testid="pipeline-connector">
          {focus === "fault"
            ? "Translation stopped: the access never reaches fill, frame, physical or RAM."
            : nextStage === null
              ? `${stageTitle(focus ?? "cpu")} is the end of the line: the CPU has its byte.`
              : `↓ continues to ${stageTitle(nextStage)}`}
        </p>
      )}
    </section>
  );
}
