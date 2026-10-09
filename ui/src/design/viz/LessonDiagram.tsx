/**
 * The lesson's focused diagram: a PRESENTATION VARIANT of the pipeline.
 *
 * WHY THIS IS NOT `MemoryPipeline`. The Lab draws all seven stations at once,
 * because there the learner is inspecting the whole machine. A lesson is about
 * ONE station at a time, so this component shows only the subject and the little
 * context that led to it, and hides the rest - the "reveal one step" teaching
 * model. It reuses the SAME node boxes (`CpuNode`, `TlbNode`, ...) so the learner
 * meets exactly the drawing they will meet in the Lab; it derives no fact and it
 * emits the same `stage-*` test ids, so the Lab and the lesson cannot disagree.
 *
 * WHICH nodes to show is a presentation choice per focus, expressed as data
 * (`LESSON_NODES`) rather than as scattered conditionals. The full detail - the
 * TLB, page table, RAM and the event log - lives behind the Learn screen's
 * "Technical details" disclosure, not here.
 */

import type { JSX, ReactNode } from "react";

import { Icon } from "../Icon";
import { cx } from "../cx";
import {
  CpuNode,
  FrameNode,
  PageFaultNode,
  PageTableNode,
  RamNode,
  TlbNode,
  VirtualAddressNode,
} from "./nodes";
import type { PipelineData, PipelineNodeKey } from "./MemoryPipeline";
import { FocusProvider } from "./NodeShell";

/** All seven stations, in hardware order: shown whole by the chain/timeline steps. */
const ALL_NODES: readonly PipelineNodeKey[] = [
  "cpu",
  "virtual",
  "tlb",
  "pageTable",
  "fault",
  "frame",
  "ram",
];

/**
 * The nodes a step shows, in order, keyed by the station the step is about.
 *
 * The subject is the last stop; the nodes before it are the context that led
 * there. `null` (the timeline / chain / lesson focuses) shows the whole chain,
 * because those steps are about the translation as a whole rather than one box.
 */
const LESSON_NODES: Record<PipelineNodeKey, readonly PipelineNodeKey[]> = {
  cpu: ["cpu"],
  virtual: ["cpu", "virtual"],
  tlb: ["cpu", "tlb"],
  pageTable: ["tlb", "pageTable"],
  fault: ["tlb", "pageTable", "fault"],
  frame: ["virtual", "frame", "ram"],
  ram: ["pageTable", "frame", "ram"],
};

/** The nodes to draw for a focus. `null` shows the whole chain. */
export function lessonNodesFor(focus: PipelineNodeKey | null): readonly PipelineNodeKey[] {
  return focus === null ? ALL_NODES : LESSON_NODES[focus];
}

/** Draw one station's box from the already-derived pipeline facts. */
function renderNode(key: PipelineNodeKey, data: PipelineData): ReactNode {
  switch (key) {
    case "cpu":
      return (
        <CpuNode
          status={data.cpu.status}
          accessKind={data.cpu.accessKind}
          address={data.cpu.address}
          pid={data.cpu.pid}
        />
      );
    case "virtual":
      return (
        <VirtualAddressNode
          status={data.virtual.status}
          address={data.virtual.address}
          pageSize={data.virtual.pageSize}
          pageNumber={data.virtual.pageNumber}
          offset={data.virtual.offset}
        />
      );
    case "tlb":
      return (
        <TlbNode
          status={data.tlb.status}
          entries={data.tlb.entries}
          capacity={data.tlb.capacity}
          activePage={data.tlb.activePage}
        />
      );
    case "pageTable":
      return (
        <PageTableNode
          status={data.pageTable.status}
          entries={data.pageTable.entries}
          activePage={data.pageTable.activePage}
          pageSize={data.pageTable.pageSize}
        />
      );
    case "fault":
      return (
        <PageFaultNode
          status={data.fault.status}
          pageNumber={data.fault.pageNumber}
          reason={data.fault.reason}
        />
      );
    case "frame":
      return (
        <FrameNode
          status={data.frame.status}
          pageNumber={data.frame.pageNumber}
          frameNumber={data.frame.frameNumber}
        />
      );
    case "ram":
      return (
        <RamNode
          status={data.ram.status}
          frameNumber={data.ram.frameNumber}
          physicalAddress={data.ram.physicalAddress}
          accessKind={data.ram.accessKind}
        />
      );
  }
}

export function LessonDiagram({
  data,
  focus,
  caption = null,
}: {
  /** The already-derived pipeline facts, straight from `buildLabView`. */
  data: PipelineData;
  /** The station this step is about; `null` lights nothing in particular. */
  focus: PipelineNodeKey | null;
  /** The read-on caption, e.g. "↓ continues to Page Table". */
  caption?: ReactNode;
}): JSX.Element {
  const nodes = lessonNodesFor(focus);

  return (
    <div data-testid="lesson-diagram" className="flex flex-col">
      {nodes.map((key, index) => (
        <div key={key}>
          {index === 0 ? null : <Connector />}
          {/* Only the subject gets `data-focus="true"`; the context around it is
              shown at full strength because the learner is meant to see it too. */}
          <FocusProvider focused={focus !== null && focus === key}>
            <div className="transition-opacity duration-300">{renderNode(key, data)}</div>
          </FocusProvider>
        </div>
      ))}
      {caption === null ? null : <div className="mt-2">{caption}</div>}
    </div>
  );
}

/** The gap between two stations: decorative only, so `aria-hidden`. */
function Connector(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex justify-center py-1">
      <span
        className={cx(
          "flex size-6 items-center justify-center rounded-full bg-surface-soft text-line-strong",
        )}
      >
        <Icon name="arrowDown" size={14} />
      </span>
    </div>
  );
}
