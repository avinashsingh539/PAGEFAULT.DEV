import type { MachineState, TlbEntry } from "../../../engine";
import type {
  MaintenanceRecord,
  PipelineStage,
  SessionCursor,
  SessionRecord,
  SessionView,
  TimelineEntry,
  TimelineOutcome,
} from "./session";
import {
  ADDRESS_PRESETS,
  DEMO_PAGE_SIZE,
  MAX_RECORDS,
  appendAccess,
  appendInvalidation,
  appendMaintenance,
  cursorBackward,
  cursorForEntry,
  cursorForNewRecord,
  cursorForward,
  pageTableRows,
  stageForEvent,
  timelineEntries,
  viewForCursor,
} from "./session";

export {
  ADDRESS_PRESETS,
  DEMO_PAGE_SIZE,
  MAX_RECORDS,
  appendAccess,
  appendInvalidation,
  appendMaintenance,
  cursorBackward,
  cursorForEntry,
  cursorForNewRecord,
  cursorForward,
  pageTableRows,
  stageForEvent,
  timelineEntries,
  viewForCursor,
};
export type {
  MachineState,
  MaintenanceRecord,
  PipelineStage,
  SessionCursor,
  SessionRecord,
  SessionView,
  TimelineEntry,
  TimelineOutcome,
  TlbEntry,
};
export { eventDrilldown } from "./facts";
export { PIPELINE_COLUMNS, stageTitle, stageStatuses } from "./stages";
export type { StageStatus } from "./stages";
