/**
 * Diagram D: Page Table
 *
 * Shows the page table as the authoritative map from virtual page to
 * physical frame. A present entry names the frame; an absent entry
 * triggers page-fault handling.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * Page-table lookup with present/absent outcomes. viewBox: 0 0 560 420
 */
export function PageTableDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Page table lookup"
      desc="The page table maps virtual page numbers to physical frames. A present entry names the frame; an absent entry triggers page-fault handling. The page table is the source of truth after a TLB miss."
      viewBox="0 0 560 420"
      height={340}
    >
      {/* Top: input */}
      <DiagramLabel x={280} y={30} text="Virtual Page Number: 1" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)" />
      <DiagramArrow fromX={280} fromY={50} toX={280} toY={70} />

      {/* Page table box */}
      <DiagramBox x={160} y={75} width={240} height={120} label="Page Table" fill="var(--color-info-soft)" stroke="var(--color-info)" fontSize={16} />

      {/* Table rows inside */}
      <DiagramLabel x={190} y={105} text="VPN 0 → Frame 3 (present)" textAnchor="start" fontSize={11} fill="var(--color-ink)" />
      <DiagramLabel x={190} y={125} text="VPN 1 → Frame 7 (present)" textAnchor="start" fontSize={11} fill="var(--color-ink)" />
      <DiagramLabel x={190} y={145} text="VPN 2 → Frame 1 (present)" textAnchor="start" fontSize={11} fill="var(--color-ink)" />
      <DiagramLabel x={190} y={165} text="VPN 6 → absent" textAnchor="start" fontSize={11} fill="var(--color-muted)" />

      {/* Arrows out */}
      <DiagramArrow fromX={280} fromY={205} toX={280} toY={240} />

      {/* Branch: present vs absent */}
      <DiagramBox x={210} y={245} width={140} height={50} label="Present?" fill="var(--color-info-soft)" stroke="var(--color-info)" fontSize={13} />

      {/* Yes path (left) */}
      <DiagramArrow fromX={210} fromY={270} toX={120} toY={300} />
      <DiagramLabel x={160} y={280} text="Yes" textAnchor="middle" fontSize={10} fill="var(--color-hit)" />

      <DiagramBox x={30} y={310} width={160} height={50} label="Get Frame 7" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramArrow fromX={110} fromY={365} toX={110} toY={385} />
      <DiagramLabel x={260} y={405} text="→ Physical Address" textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-ink)" />

      {/* No path (right) */}
      <DiagramArrow fromX={350} fromY={270} toX={440} toY={300} />
      <DiagramLabel x={400} y={280} text="No" textAnchor="middle" fontSize={10} fill="var(--color-fault)" />

      <DiagramBox x={370} y={310} width={160} height={50} label="Page Fault" fill="var(--color-error-soft)" stroke="var(--color-error)" fontSize={12} />
    </DiagramSvg>
  );
}
