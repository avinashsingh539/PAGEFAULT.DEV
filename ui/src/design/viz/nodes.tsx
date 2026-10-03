/**
 * The six pipeline components, as reusable pieces.
 *
 * These are used by the Lab, the lesson diagram, the landing hero and the Learn
 * index, and they are built ONCE here precisely so those four places cannot drift
 * into four different pictures of the same hardware. A learner who has seen the TLB
 * drawn in the lesson must meet the same box in the Lab.
 *
 * Every value below is passed in. None of these components derives a page number,
 * a frame, a hit or a miss; they render what the engine already decided.
 */

import type { JSX } from "react";

import { Icon } from "../Icon";
import { NodeFact, NodeShell } from "./NodeShell";
import type { NodeStatus } from "./NodeShell";
import { cx } from "../cx";

/** "—" is the app-wide "this has not happened yet" marker, never a blank cell. */
const NOT_YET = "—";

export function CpuNode({
  status,
  accessKind,
  address,
  pid,
}: {
  status: NodeStatus;
  accessKind: "read" | "write";
  address: string;
  pid: number | null;
}): JSX.Element {
  return (
    <NodeShell title="CPU" subtitle="issues the access" icon="cpu" status={status} testId="stage-cpu">
      <NodeFact label="access" value={accessKind === "write" ? "write" : "read"} />
      <NodeFact label="address" value={address} testId="node-cpu-address" />
      <NodeFact label="process" value={pid === null ? NOT_YET : `pid ${pid}`} />
    </NodeShell>
  );
}

export function VirtualAddressNode({
  status,
  address,
  pageSize,
  pageNumber,
  offset,
}: {
  status: NodeStatus;
  address: string;
  pageSize: number | null;
  pageNumber: string;
  offset: string;
}): JSX.Element {
  return (
    <NodeShell
      title="Virtual address"
      subtitle="what the program asked for"
      icon="route"
      status={status}
      testId="stage-virtual"
    >
      <NodeFact label="address" value={address} testId="node-virtual-address" />
      <NodeFact label="page size" value={pageSize === null ? NOT_YET : `${pageSize} B`} />
      <div className="mt-1 flex items-center gap-2 rounded-control bg-surface-soft/70 px-2.5 py-1.5">
        <span className="num text-xs font-semibold text-primary-strong">{pageNumber}</span>
        <span className="text-[0.6875rem] uppercase tracking-wide text-muted">page</span>
        <span aria-hidden="true" className="text-line-strong">
          +
        </span>
        <span className="num text-xs font-semibold text-primary-strong">{offset}</span>
        <span className="text-[0.6875rem] uppercase tracking-wide text-muted">offset</span>
      </div>
    </NodeShell>
  );
}

export function FrameNode({
  status,
  pageNumber,
  frameNumber,
}: {
  status: NodeStatus;
  pageNumber: string;
  frameNumber: string;
}): JSX.Element {
  return (
    <NodeShell
      title="Physical frame"
      subtitle="where the page really lives"
      icon="table"
      status={status}
      testId="stage-frame"
    >
      <NodeFact label="page" value={pageNumber} testId="node-frame-page" />
      <NodeFact label="frame" value={frameNumber} testId="node-frame-number" />
    </NodeShell>
  );
}

export function RamNode({
  status,
  frameNumber,
  physicalAddress,
  accessKind,
}: {
  status: NodeStatus;
  frameNumber: string;
  physicalAddress: string;
  accessKind: "read" | "write";
}): JSX.Element {
  return (
    <NodeShell
      title="RAM"
      subtitle="the access finally lands here"
      icon="memory"
      status={status}
      testId="stage-ram"
    >
      <NodeFact label="frame" value={frameNumber} testId="node-ram-frame" />
      <NodeFact
        label="physical address"
        value={physicalAddress}
        testId="node-ram-physical"
      />
      <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-chip bg-surface-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
        <Icon name={accessKind === "write" ? "arrowDown" : "arrowRight"} size={12} />
        {accessKind}
      </span>
    </NodeShell>
  );
}

/**
 * A TLB slot as the UI draws it: a page -> frame pair.
 *
 * A SHAPE, not an engine type. The engine's `TlbEntry` is passed straight into
 * `TlbNode` as `entries` and mapped here, so the engine type never leaks a
 * rendering concern and this component never has to know the engine exists.
 */
export function TlbNode({
  status,
  entries,
  capacity,
  activePage,
}: {
  status: NodeStatus;
  /** Read straight off engine state; the UI adds no meaning to these. */
  entries: readonly { readonly pageNumber: number; readonly frameNumber: number }[];
  capacity: number | null;
  /** The page the cursor is currently looking at, so it can be called out. */
  activePage: number | null;
}): JSX.Element {
  if (capacity === null) {
    return (
      <NodeShell
        title="TLB"
        subtitle="this machine has none"
        icon="layers"
        status="skipped"
        testId="node-tlb"
      >
        <p className="text-xs text-muted">
          There is no cache in front of the page table on this machine, so every access
          checks the page table.
        </p>
      </NodeShell>
    );
  }

  return (
    <NodeShell
      title="TLB"
      subtitle="cache of recent translations"
      icon="layers"
      status={status}
      testId="stage-tlb"
    >
      <NodeFact
        label="used"
        value={`${entries.length} of ${capacity}`}
        testId="node-tlb-occupancy"
      />
      {entries.length === 0 ? (
        <p className="text-xs text-muted">Empty — every lookup will miss.</p>
      ) : (
        <ul className="slim-scroll flex max-h-40 flex-col gap-1 overflow-y-auto" data-testid="node-tlb-entries">
          {entries.map((entry) => (
            <li
              key={`tlb-${entry.pageNumber}-${entry.frameNumber}`}
              data-testid={`tlb-entry-${entry.pageNumber}`}
              className={cx(
                "num flex items-center justify-between rounded-chip px-2 py-1 text-xs",
                activePage === entry.pageNumber
                  ? "bg-primary-soft font-bold text-primary-strong ring-1 ring-primary/40"
                  : "bg-surface-soft text-muted",
              )}
            >
              <span>page {entry.pageNumber}</span>
              <span aria-hidden="true" className="text-line-strong">
                &rarr;
              </span>
              <span>frame {entry.frameNumber}</span>
            </li>
          ))}
        </ul>
      )}
    </NodeShell>
  );
}

export function PageTableNode({
  status,
  entries,
  activePage,
  pageSize,
}: {
  status: NodeStatus;
  /** Read straight off engine state. `present: false` means "not in RAM". */
  entries: readonly {
    readonly pageNumber: number;
    readonly present: boolean;
    readonly frameNumber: number | null;
  }[];
  activePage: number | null;
  pageSize: number;
}): JSX.Element {
  return (
    <NodeShell
      title="Page table"
      subtitle="which frame each page uses"
      icon="table"
      status={status}
      testId="stage-pageTable"
    >
      <NodeFact label="page size" value={`${pageSize} B`} />
      {entries.length === 0 ? (
        <p className="text-xs text-muted">This process has no mappings.</p>
      ) : (
        <ul
          className="slim-scroll flex max-h-44 flex-col gap-1 overflow-y-auto"
          data-testid="node-pagetable-entries"
        >
          {entries.map((entry) => (
            <li
              key={`pt-${entry.pageNumber}`}
              data-testid={`pt-entry-${entry.pageNumber}`}
              className={cx(
                "num flex items-center justify-between rounded-chip px-2 py-1 text-xs",
                activePage === entry.pageNumber
                  ? "bg-primary-soft font-bold text-primary-strong ring-1 ring-primary/40"
                  : entry.present
                    ? "bg-surface-soft text-muted"
                    : "bg-fault-soft text-fault",
              )}
            >
              <span>page {entry.pageNumber}</span>
              <span className="flex items-center gap-1.5">
                {entry.present ? (
                  <>
                    <Icon name="check" size={12} />
                    frame {entry.frameNumber}
                  </>
                ) : (
                  <>
                    <Icon name="alert" size={12} />
                    not in RAM
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </NodeShell>
  );
}


/**
 * The terminal station: translation stopped here.
 *
 * It is not a step the access passes through. On a successful access it is drawn
 * dashed and dark, because "this access never reached here" is itself the
 * information a learner needs; on a faulting access it lights up and the stations
 * after it stay dashed. That is the whole teaching point of a page fault, and it
 * is why the station exists in the chain at all.
 */
export function PageFaultNode({
  status,
  pageNumber,
  reason,
}: {
  status: NodeStatus;
  pageNumber: string;
  reason: string | null;
}): JSX.Element {
  const faulted = status === "fault";
  return (
    <NodeShell
      title="Page fault"
      subtitle={faulted ? "translation stops here" : "not reached on this access"}
      icon="alert"
      status={status}
      testId="stage-fault"
    >
      <NodeFact label="page" value={pageNumber} testId="node-fault-page" />
      <NodeFact
        label="reason"
        value={reason === null ? NOT_YET : reason === "PAGE_NOT_PRESENT" ? "not in RAM" : reason}
      />
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {faulted
          ? "The CPU cannot complete this access. No frame, no physical address and no RAM access are produced."
          : "Nothing to report: this access never looked for a page that was missing."}
      </p>
    </NodeShell>
  );
}