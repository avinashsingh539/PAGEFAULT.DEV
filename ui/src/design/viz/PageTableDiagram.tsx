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
 * Page-table lookup with present/absent outcomes. viewBox: 0 0 560 520
 *
 * Layout:
 *   Virtual Page Number: 1
 *           ↓
 *       ┌─────────────┐
 *       │ Page Table  │
 *       ├─────────────┤
 *       │ VPN 0 → 3   │
 *       │ VPN 1 → 7   │  ◀ selected
 *       │ VPN 2 → 1   │
 *       │ VPN 6 → –   │
 *       └─────────────┘
 *           ↓
 *       Present?
 *      /        \
 *    Yes         No
 *    ↓           ↓
 * [Frame 7]   [Page Fault]
 *    ↓
 * → Physical Address
 */
export function PageTableDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Page table lookup"
      desc="The page table maps virtual page numbers to physical frames. A present entry names the frame; an absent entry triggers page-fault handling. The page table is the source of truth after a TLB miss."
      viewBox="0 0 560 520"
      height={420}
    >
      {/* Top: input */}
      <DiagramLabel
        x={280}
        y={30}
        text="Virtual Page Number: 1"
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="var(--color-ink)"
      />
      <DiagramArrow fromX={280} fromY={50} toX={280} toY={70} />

      {/* Page Table title area */}
      <DiagramBox
        x={160}
        y={75}
        width={240}
        height={40}
        label="Page Table"
        fill="var(--color-info-soft)"
        stroke="var(--color-info)"
        fontSize={14}
      />

      {/* Table entries as aligned rows */}
      <DiagramBox
        x={180}
        y={125}
        width={200}
        height={24}
        label="VPN 0 → Frame 3  (present)"
        fill="var(--color-surface)"
        stroke="var(--color-line)"
        fontSize={10}
      />
      <DiagramBox
        x={180}
        y={153}
        width={200}
        height={24}
        label="VPN 1 → Frame 7  (present)"
        fill="var(--color-primary-soft)"
        stroke="var(--color-primary-strong)"
        fontSize={10}
      />
      <DiagramBox
        x={180}
        y={181}
        width={200}
        height={24}
        label="VPN 2 → Frame 1  (present)"
        fill="var(--color-surface)"
        stroke="var(--color-line)"
        fontSize={10}
      />
      <DiagramBox
        x={180}
        y={209}
        width={200}
        height={24}
        label="VPN 6 → absent"
        fill="var(--color-surface-soft)"
        stroke="var(--color-line-strong)"
        fontSize={10}
      />

      {/* Arrow down from table */}
      <DiagramArrow fromX={280} fromY={243} toX={280} toY={263} />

      {/* Decision */}
      <DiagramBox
        x={210}
        y={268}
        width={140}
        height={50}
        label="Present?"
        fill="var(--color-info-soft)"
        stroke="var(--color-info)"
        fontSize={13}
      />

      {/* Yes path (left) */}
      <DiagramArrow fromX={210} fromY={298} toX={110} toY={328} />
      <DiagramLabel x={155} y={315} text="Yes" textAnchor="middle" fontSize={10} fill="var(--color-hit)" />
      <DiagramBox
        x={20}
        y={338}
        width={160}
        height={50}
        label="Get Frame 7"
        fill="var(--color-hit-soft)"
        stroke="var(--color-hit)"
        fontSize={12}
      />

      {/* No path (right) */}
      <DiagramArrow fromX={350} fromY={298} toX={450} toY={328} />
      <DiagramLabel x={405} y={315} text="No" textAnchor="middle" fontSize={10} fill="var(--color-fault)" />
      <DiagramBox
        x={380}
        y={338}
        width={160}
        height={50}
        label="Page Fault"
        fill="var(--color-error-soft)"
        stroke="var(--color-error)"
        fontSize={12}
      />

      {/* Outcome: physical address */}
      <DiagramArrow fromX={100} fromY={393} toX={100} toY={413} />
      <DiagramLabel
        x={280}
        y={428}
        text="→ Physical Address"
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="var(--color-ink)"
      />
    </DiagramSvg>
  );
}
