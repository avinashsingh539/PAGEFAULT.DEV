/**
 * The Lab's view model: one pure function from session facts to everything drawn.
 *
 *   (machine, records, cursor)  ->  LabView  ->  pipeline + explanation + timeline
 *
 * WHY THIS IS ITS OWN MODULE. The Lab, the lesson diagram and the landing hero all
 * need the same picture of the same session. If each screen assembled its own
 * PipelineData, the three would drift - one would forget to dim the page table on
 * a TLB hit, another would call a miss a fault - and the product would contradict
 * itself about the hardware. One adapter, one definition of "what is happening".
 *
 * THE RULE. This function reads. It takes whole engine states and whole engine
 * events that `session.ts` already folded, and it formats them. It never
 * re-derives an OS fact: the page number came from an ADDRESS_SPLIT event, the
 * frame from a PAGE_TABLE_HIT, the hit/miss/skip decision from the existing
 * `stageStatuses()` derivation. Nothing here is a second opinion about what the
 * hardware did.
 */

import type { MachineState } from "../../../engine";

import { pageTableRows } from "./session";
import type { SessionRecord, SessionView } from "./session";
import { stageStatuses } from "./stages";
import { presentEvent } from "./eventPresentation";

import type { PipelineData, PipelineNodeKey } from "../design/viz/MemoryPipeline";
import type { PresentedEvent } from "../design/viz/EventExplanation";
import type { TimelineStop } from "../design/viz/EventTimeline";

/** The em-dash the whole product uses for "this has not happened yet". */
const NOT_YET = "—";

function hex(value: number | null): string {
  return value === null ? NOT_YET : `0x${value.toString(16)}`;
}

/** The virtual address the record under the cursor was for, if it was an access. */
function addressOf(record: SessionRecord | null): number | null {
  return record !== null && record.kind === "access" ? record.address : null;
}

function accessKindOf(record: SessionRecord | null): "read" | "write" {
  return record !== null && record.kind === "access" ? record.accessKind : "read";
}

/** The page-fault reason for this record, when it faulted at all. */
function faultReasonOf(record: SessionRecord | null): string | null {
  if (record === null) {
    return null;
  }
  const fault = record.events.find((event) => event.type === "PAGE_FAULT");
  return fault === undefined ? null : fault.reason;
}

/** Every event of the session, in order, already phrased for a human. */
function timelineStops(records: readonly SessionRecord[]): readonly TimelineStop[] {
  const stops: TimelineStop[] = [];
  records.forEach((record, recordIndex) => {
    record.events.forEach((event, eventIndex) => {
      stops.push({ recordIndex, eventIndex, event: presentEvent(event) });
    });
  });
  return stops;
}

export interface LabView {
  readonly pipeline: PipelineData;
  /** `null` before anything has happened, which is what shows the empty state. */
  readonly presentation: PresentedEvent | null;
  /** The station the current event is about, for lesson-style emphasis. */
  readonly focus: PipelineNodeKey | null;
  readonly stops: readonly TimelineStop[];
  /** The travelling request, or `null` when there is nothing travelling. */
  readonly request: { readonly address: string; readonly accessKind: "read" | "write" } | null;
  readonly hasSession: boolean;
}

/**
 * Build everything the Lab draws.
 *
 * The interesting decision is the `fault` station. `stageStatuses()` already knows
 * the teaching rules - a TLB hit keeps the page table dark, a fault keeps every
 * later stage dark - so this reuses it rather than restating them. The one thing
 * it adds is that a record with no fault in it marks the fault station `skipped`
 * instead of `idle`, because "this access never came near faulting" is a fact
 * worth drawing, not an empty box.
 */
export function buildLabView(
  machine: MachineState,
  records: readonly SessionRecord[],
  view: SessionView,
): LabView {
  const statuses = stageStatuses(view.record, view);
  const record = view.record;
  const address = addressOf(record);
  const accessKind = accessKindOf(record);
  const faulted = record !== null && record.events.some((event) => event.type === "PAGE_FAULT");

  const pipeline: PipelineData = {
    cpu: {
      status: statuses.cpu,
      accessKind,
      address: hex(address),
      pid: record !== null && record.kind === "access" ? 1 : null,
    },
    virtual: {
      status: statuses.virtual,
      address: hex(address),
      pageSize: machine.memory.pageSize,
      pageNumber: view.pageNumber === null ? NOT_YET : String(view.pageNumber),
      offset: view.offset === null ? NOT_YET : String(view.offset),
    },
    tlb: {
      status: statuses.tlb,
      entries: view.tlbEnabled
        ? view.tlbEntries.map((entry) => ({
            pageNumber: entry.pageNumber,
            frameNumber: entry.frameNumber,
          }))
        : [],
      capacity: view.tlbEnabled ? view.tlbCapacity : null,
      activePage: view.pageNumber,
    },
    pageTable: {
      status: statuses.pageTable,
      entries: pageTableRows(machine),
      activePage: view.pageNumber,
      pageSize: machine.memory.pageSize,
    },
    fault: {
      status: faulted ? statuses.fault : "skipped",
      pageNumber: view.pageNumber === null ? NOT_YET : String(view.pageNumber),
      reason: faultReasonOf(record),
    },
    frame: {
      status: statuses.frame,
      pageNumber: view.pageNumber === null ? NOT_YET : String(view.pageNumber),
      frameNumber: view.frameNumber === null ? NOT_YET : String(view.frameNumber),
    },
    ram: {
      status: statuses.ram,
      frameNumber: view.frameNumber === null ? NOT_YET : String(view.frameNumber),
      physicalAddress: hex(view.physicalAddress),
      accessKind,
    },
  };

  return {
    pipeline,
    presentation: view.event === null ? null : presentEvent(view.event),
    focus: view.event === null ? null : stageToNode(view.stage),
    stops: timelineStops(records),
    request: address === null ? null : { address: `0x${address.toString(16)}`, accessKind },
    hasSession: records.length > 0,
  };
}

/**
 * Map the session's ten-stage vocabulary onto the seven stations the pipeline draws.
 *
 * `split`, `fill` and `physical` are not stations of their own: the split is shown
 * inside the virtual-address box, the TLB fill inside the TLB box, and the
 * physical address inside the RAM box. Mapping them onto their parents keeps the
 * existing stage derivation - and its tests - intact while the diagram shows seven
 * boxes instead of ten thin ones.
 */
export function stageToNode(stage: string): PipelineNodeKey | null {
  switch (stage) {
    case "cpu":
      return "cpu";
    case "virtual":
    case "split":
      return "virtual";
    case "tlb":
    case "fill":
      return "tlb";
    case "pageTable":
      return "pageTable";
    case "fault":
      return "fault";
    case "frame":
    case "physical":
      return "frame";
    case "ram":
      return "ram";
    default:
      return null;
  }
}