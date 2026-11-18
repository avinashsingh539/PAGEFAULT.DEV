/**
 * Diagram B: Page Number + Offset
 *
 * Shows how a virtual address is split into page number and offset,
 * how only the page number is translated, and how the offset is
 * preserved unchanged into the physical address.
 *
 * Example: 0x1345 with 4096-byte pages → page 1, offset 0x345 → frame 7 → 0x7345.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * Address-splitting diagram. viewBox: 0 0 520 420
 */
export function AddressSplitDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Page number and offset split"
      desc="A virtual address (0x1345) splits into virtual page number (1) and offset (0x345). Only the page number is translated (to frame 7); the offset is preserved unchanged, giving physical address 0x7345."
      viewBox="0 0 520 420"
      height={320}
    >
      {/* Top: input address */}
      <DiagramLabel x={260} y={30} text="Virtual Address: 0x1345" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)" />

      {/* Arrow down to split box */}
      <DiagramArrow fromX={260} fromY={50} toX={260} toY={70} />

      {/* Split box: two halves */}
      <DiagramBox x={60} y={75} width={200} height={70} label="Virtual Page No. 1" fill="var(--color-primary-soft)" stroke="var(--color-primary-strong)" fontSize={13} />
      <DiagramBox x={260} y={75} width={200} height={70} label="Offset: 0x345" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={13} />

      {/* Left path: translate page */}
      <DiagramArrow fromX={160} fromY={155} toX={160} toY={195} />
      <DiagramLabel x={160} y={185} text="Translate page" textAnchor="middle" fontSize={10} fill="var(--color-muted)" />

      {/* Right path: unchanged offset */}
      <DiagramLabel x={330} y={140} text="unchanged" textAnchor="middle" fontSize={10} fill="var(--color-muted)" />
      <DiagramArrow fromX={360} fromY={145} toX={360} toY={265} />

      {/* Bottom: physical address */}
      <DiagramBox x={60} y={270} width={200} height={70} label="Physical Frame 7" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={13} />
      <DiagramBox x={260} y={270} width={200} height={70} label="Offset: 0x345" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={13} />

      {/* Arrow down to physical address */}
      <DiagramArrow fromX={160} fromY={350} toX={160} toY={370} />
      <DiagramLabel x={260} y={395} text="Physical Address: 0x7345" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)" />
    </DiagramSvg>
  );
}
