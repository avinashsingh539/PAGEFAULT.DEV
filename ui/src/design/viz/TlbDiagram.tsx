/**
 * Diagram C: TLB
 *
 * Shows both branches of a TLB lookup: HIT returns a cached frame
 * immediately; MISS proceeds to the page table. A TLB miss is NOT
 * automatically a page fault - only an absent page-table entry faults.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramBranch, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * TLB lookup with HIT/MISS branches. viewBox: 0 0 560 520
 */
export function TlbDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="TLB lookup flow"
      desc="A TLB lookup either hits (cached frame, skip page table) or misses (continue to page table). A TLB miss is not a page fault: only an absent page-table entry causes a fault."
      viewBox="0 0 560 650"
      height={480}
    >
      {/* Top: input */}
      <DiagramLabel x={280} y={30} text="Virtual Address" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)" />
      <DiagramArrow fromX={280} fromY={50} toX={280} toY={70} />

      {/* TLB lookup */}
      <DiagramBox x={210} y={75} width={140} height={50} label="TLB Lookup" fill="var(--color-info-soft)" stroke="var(--color-info)" fontSize={13} />
      <DiagramBranch x={280} y={135} />

      {/* HIT branch (left) */}
      <DiagramArrow fromX={280} fromY={145} toX={160} toY={185} />
      <DiagramLabel x={220} y={160} text="HIT" textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-hit)" />

      <DiagramBox x={60} y={195} width={180} height={50} label="Cached Frame" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramArrow fromX={150} fromY={250} toX={150} toY={320} />

      {/* MISS branch (right) */}
      <DiagramArrow fromX={280} fromY={145} toX={400} toY={185} />
      <DiagramLabel x={340} y={160} text="MISS" textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-fault)" />

      <DiagramBox x={320} y={195} width={180} height={50} label="Page Table Lookup" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramArrow fromX={410} fromY={250} toX={410} toY={290} />

      {/* Valid mapping decision */}
      <DiagramBox x={290} y={295} width={140} height={50} label="Valid Mapping?" fill="var(--color-info-soft)" stroke="var(--color-info)" fontSize={12} />
      <DiagramBranch x={360} y={355} />

      {/* Yes path */}
      <DiagramArrow fromX={360} fromY={365} toX={280} toY={395} />
      <DiagramLabel x={320} y={375} text="Yes" textAnchor="middle" fontSize={10} fill="var(--color-hit)" />

      <DiagramBox x={190} y={405} width={180} height={50} label="Get Frame" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramArrow fromX={280} fromY={460} toX={280} toY={480} />

      {/* No path */}
      <DiagramArrow fromX={360} fromY={365} toX={440} toY={395} />
      <DiagramLabel x={400} y={375} text="No" textAnchor="middle" fontSize={10} fill="var(--color-fault)" />

      <DiagramBox x={410} y={405} width={130} height={50} label="Page Fault" fill="var(--color-error-soft)" stroke="var(--color-error)" fontSize={12} />

      {/* Final output */}
      <DiagramArrow fromX={280} fromY={480} toX={280} toY={495} />
      <DiagramBox x={220} y={500} width={120} height={40} label="Physical Address" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramArrow fromX={280} fromY={545} toX={280} toY={560} />
      <DiagramBox x={240} y={565} width={80} height={40} label="RAM" fill="var(--color-surface-soft)" stroke="var(--color-line-strong)" fontSize={12} />
    </DiagramSvg>
  );
}
