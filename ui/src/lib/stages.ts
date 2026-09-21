/**
 * Lab pipeline stage labels and small presentational helpers.
 *
 * Labels are the UI's own vocabulary for its columns; they never rename engine
 * facts (those stay in the event payloads and tooltips). Everything here is a
 * string choice, not a simulation fact.
 *
 * `fault` stands in the chain where it happens: after the page-table lookup, in place of
 * the fill/frame/physical/RAM stages that a faulting access never reaches.
 */

import type { PipelineStage, SessionRecord, SessionView } from "./session";

/** The pipeline columns, in hardware order. */
export const PIPELINE_COLUMNS: readonly PipelineStage[] = [
  "cpu",
  "virtual",
  "split",
  "tlb",
  "pageTable",
  "fault",
  "fill",
  "frame",
  "physical",
  "ram",
];

const STAGE_TITLES: Record<PipelineStage, string> = {
  cpu: "CPU",
  virtual: "Virtual Address",
  split: "Split",
  tlb: "TLB",
  pageTable: "Page Table",
  fault: "Page Fault",
  fill: "TLB Fill",
  frame: "Frame",
  physical: "Physical Addr",
  ram: "RAM",
};

export function stageTitle(stage: PipelineStage): string {
  return STAGE_TITLES[stage];
}

/** How one column is painted at this cursor position. */
export type StageStatus = "idle" | "done" | "active" | "skipped" | "fault";

/**
 * PRESENTATION ONLY: colour every column for the cursor.
 *
 * The statuses are derived from the position of the event under the cursor and from
 * which events the record contains - never from a second computation of what the
 * hardware "should" have done.
 *
 * The teaching rules encoded here, in order of importance:
 *
 *   - a record that contains a TLB_HIT keeps the page-table column dark for the
 *     whole record: that column is exactly what the cache spared;
 *   - a record that contains a PAGE_FAULT keeps fill, frame, physical and RAM dark
 *     for the whole record: those stages never happen on this access;
 *   - a machine without a TLB keeps the TLB column dark: it has nothing to consult.
 */
export function stageStatuses(
  record: SessionRecord | null,
  view: SessionView,
): Record<PipelineStage, StageStatus> {
  const statuses = Object.fromEntries(
    PIPELINE_COLUMNS.map((stage) => [stage, "idle" as StageStatus]),
  ) as Record<PipelineStage, StageStatus>;

  if (record === null || view.event === null || view.cursor === null) {
    return statuses;
  }

  const activeIndex = PIPELINE_COLUMNS.indexOf(view.stage);
  PIPELINE_COLUMNS.forEach((stage, index) => {
    if (index <= activeIndex) {
      statuses[stage] = "done";
    }
  });
  statuses[view.stage] = view.stage === "fault" ? "fault" : "active";

  const types = new Set(record.events.map((event) => event.type));

  if (!types.has("TLB_LOOKUP")) {
    statuses.tlb = "skipped";
  }

  if (types.has("TLB_HIT")) {
    statuses.pageTable = "skipped";
    statuses.fill = "skipped";
  }

  if (types.has("PAGE_FAULT")) {
    const faultReached = view.cursor.eventIndex >= record.events.findIndex(
      (event) => event.type === "PAGE_FAULT",
    );
    statuses.fault = faultReached ? (view.stage === "fault" ? "fault" : "done") : "idle";
    for (const stage of ["fill", "frame", "physical", "ram"] as const) {
      statuses[stage] = "skipped";
    }
  }

  if (record.kind === "invalidation") {
    statuses.pageTable = "skipped";
    statuses.frame = "skipped";
    statuses.physical = "skipped";
    statuses.ram = "skipped";
  }

  return statuses;
}
