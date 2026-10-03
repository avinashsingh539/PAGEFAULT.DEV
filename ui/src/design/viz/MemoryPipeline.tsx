/**
 * The memory pipeline: the visual spine of the whole product.
 *
 * ONE component draws the CPU -> virtual address -> TLB -> page table -> frame ->
 * RAM chain, and four different places use it: the Lab's hero, the lesson
 * diagram, the landing page's live illustration, and Compare. That is the entire
 * point. A learner who meets the TLB in a lesson and then in the Lab must be
 * looking at the same six boxes drawn the same way, or the second meeting teaches
 * the drawing instead of the subject.
 *
 * The data arrives as a `PipelineData` bundle of already-computed facts. This file
 * chooses LAYOUT and EMPHASIS only: which box is lit, which are dimmed, and where
 * the request sits. It derives nothing about memory.
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
import type { NodeStatus } from "./NodeShell";
import { FocusProvider } from "./NodeShell";

/**
 * The seven stations, in hardware order.
 *
 * `fault` is a TERMINAL station, not a step: it sits where a translation can stop
 * and is drawn dark on every access that completes. The stage ids (`stage-cpu`,
 * `stage-tlb`, `stage-fault`, ...) are the contract the E2E suite already uses on
 * both the Lab and the lesson, so they are emitted here rather than invented.
 */
export type PipelineNodeKey =
  | "cpu"
  | "virtual"
  | "tlb"
  | "pageTable"
  | "fault"
  | "frame"
  | "ram";

/** Everything the six boxes need, as facts read elsewhere. Never derived here. */
export interface PipelineData {
  readonly cpu: {
    readonly status: NodeStatus;
    readonly accessKind: "read" | "write";
    readonly address: string;
    readonly pid: number | null;
  };
  readonly virtual: {
    readonly status: NodeStatus;
    readonly address: string;
    readonly pageSize: number | null;
    readonly pageNumber: string;
    readonly offset: string;
  };
  readonly tlb: {
    readonly status: NodeStatus;
    readonly entries: readonly { readonly pageNumber: number; readonly frameNumber: number }[];
    readonly capacity: number | null;
    readonly activePage: number | null;
  };
  readonly pageTable: {
    readonly status: NodeStatus;
    readonly entries: readonly {
      readonly pageNumber: number;
      readonly present: boolean;
      readonly frameNumber: number | null;
    }[];
    readonly activePage: number | null;
    readonly pageSize: number;
  };
  readonly fault: {
    readonly status: NodeStatus;
    readonly pageNumber: string;
    readonly reason: string | null;
  };
  readonly frame: {
    readonly status: NodeStatus;
    readonly pageNumber: string;
    readonly frameNumber: string;
  };
  readonly ram: {
    readonly status: NodeStatus;
    readonly frameNumber: string;
    readonly physicalAddress: string;
    readonly accessKind: "read" | "write";
  };
}

export function MemoryPipeline({
  data,
  layout = "stack",
  focus = null,
  request = null,
  caption = null,
}: {
  data: PipelineData;
  /** `stack` reads top-to-bottom like the hardware. `row` is for wide, quiet spots. */
  layout?: "stack" | "row";
  /** Lesson mode: light this box and dim the rest. `null` lights nothing in particular. */
  focus?: PipelineNodeKey | null;
  /** The single travelling request, or `null` before the first access. */
  request?: { readonly address: string; readonly accessKind: "read" | "write" } | null;
  caption?: ReactNode;
}): JSX.Element {
  const dimmed = (key: PipelineNodeKey): boolean => focus !== null && focus !== key;
  const isStack = layout === "stack";

  return (
    <div data-testid="memory-pipeline" data-layout={layout} className="flex flex-col">
      <Slot dimmed={dimmed("cpu")} focus={focus} focusedKey="cpu">
        <CpuNode
          status={data.cpu.status}
          accessKind={data.cpu.accessKind}
          address={data.cpu.address}
          pid={data.cpu.pid}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("virtual")} focus={focus} focusedKey="virtual">
        <VirtualAddressNode
          status={data.virtual.status}
          address={data.virtual.address}
          pageSize={data.virtual.pageSize}
          pageNumber={data.virtual.pageNumber}
          offset={data.virtual.offset}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("tlb")} focus={focus} focusedKey="tlb">
        <TlbNode
          status={data.tlb.status}
          entries={data.tlb.entries}
          capacity={data.tlb.capacity}
          activePage={data.tlb.activePage}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("pageTable")} focus={focus} focusedKey="pageTable">
        <PageTableNode
          status={data.pageTable.status}
          entries={data.pageTable.entries}
          activePage={data.pageTable.activePage}
          pageSize={data.pageTable.pageSize}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("fault")} focus={focus} focusedKey="fault">
        <PageFaultNode
          status={data.fault.status}
          pageNumber={data.fault.pageNumber}
          reason={data.fault.reason}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("frame")} focus={focus} focusedKey="frame">
        <FrameNode
          status={data.frame.status}
          pageNumber={data.frame.pageNumber}
          frameNumber={data.frame.frameNumber}
        />
      </Slot>
      {isStack ? <Connector /> : null}

      <Slot dimmed={dimmed("ram")} focus={focus} focusedKey="ram">
        <RamNode
          status={data.ram.status}
          frameNumber={data.ram.frameNumber}
          physicalAddress={data.ram.physicalAddress}
          accessKind={data.ram.accessKind}
        />
      </Slot>

      {request === null ? null : (
        <div className="mt-3 flex justify-center">
          <span
            data-testid="pipeline-request"
            className="inline-flex items-center gap-2 rounded-chip border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong shadow-raised"
          >
            <Icon name="bolt" size={13} />
            <span className="num">{request.address}</span>
            <span className="text-[0.6875rem] font-bold uppercase tracking-wide opacity-80">
              {request.accessKind}
            </span>
          </span>
        </div>
      )}
      {caption === null ? null : <div className="mt-2">{caption}</div>}
    </div>
  );
}

/**
 * The gap between two stations: decorative only.
 *
 * It is `aria-hidden`, because a screen reader should hear the stations in order,
 * not "down-arrow down-arrow". The ORDER carries the meaning; the arrows only
 * help the eye follow it.
 */
function Connector(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex justify-center py-1">
      <span className="flex size-6 items-center justify-center rounded-full bg-surface-soft text-line-strong">
        <Icon name="arrowDown" size={14} />
      </span>
    </div>
  );
}

function Slot({
  dimmed,
  focus,
  focusedKey,
  children,
}: {
  dimmed: boolean;
  focus: PipelineNodeKey | null;
  /** Which station this slot is: needed to decide whether it is THE focused one. */
  focusedKey: PipelineNodeKey;
  children: ReactNode;
}): JSX.Element {
  return (
    <FocusProvider focused={focus !== null && focus === focusedKey}>
      <div className={cx("transition-opacity duration-300", dimmed && "opacity-30 saturate-50")}>
        {children}
      </div>
    </FocusProvider>
  );
}
