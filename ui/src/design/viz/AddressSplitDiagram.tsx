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
 * Address-splitting diagram. viewBox: 0 0 520 500
 *
 * Layout:
 *   Virtual Address: 0x1345
 *           ↓
 *   [VPN: 1]          [Offset: 0x345]
 *       ↓   Translate page   ↓ unchanged
 *   [Frame 7]              [Offset: 0x345]
 *           ↓   +   ↓
 *   Physical Address: 0x7345
 */
export function AddressSplitDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Page number and offset split"
      desc="A virtual address (0x1345) splits into virtual page number (1) and offset (0x345). Only the page number is translated (to frame 7); the offset is preserved unchanged, giving physical address 0x7345."
      viewBox="0 0 520 500"
      height={420}
    >
      {/* Top: input address */}
      <DiagramLabel
        x={260}
        y={30}
        text="Virtual Address: 0x1345"
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="var(--color-ink)"
      />

      {/* Arrow down to split */}
      <DiagramArrow fromX={260} fromY={50} toX={260} toY={70} />

      {/* Split boxes - side by side */}
      <DiagramBox
        x={60}
        y={80}
        width={180}
        height={60}
        label="VPN: 1"
        fill="var(--color-primary-soft)"
        stroke="var(--color-primary-strong)"
        fontSize={13}
      />
      <DiagramBox
        x={280}
        y={80}
        width={180}
        height={60}
        label="Offset: 0x345"
        fill="var(--color-surface)"
        stroke="var(--color-line)"
        fontSize={13}
      />

      {/* Down arrows from each box */}
      <DiagramArrow fromX={150} fromY={150} toX={150} toY={210} />
      <DiagramArrow fromX={370} fromY={150} toX={370} toY={210} />

      {/* Labels to the side of arrows - no overlap */}
      <DiagramLabel x={30} y={180} text="Translate page" textAnchor="start" fontSize={11} fill="var(--color-muted)" />
      <DiagramLabel x={490} y={180} text="unchanged" textAnchor="end" fontSize={11} fill="var(--color-muted)" />

      {/* Bottom boxes - aligned */}
      <DiagramBox
        x={60}
        y={260}
        width={180}
        height={60}
        label="Frame 7"
        fill="var(--color-hit-soft)"
        stroke="var(--color-hit)"
        fontSize={13}
      />
      <DiagramBox
        x={280}
        y={260}
        width={180}
        height={60}
        label="Offset: 0x345"
        fill="var(--color-surface)"
        stroke="var(--color-line)"
        fontSize={13}
      />

      {/* Plus sign between bottom boxes */}
      <DiagramLabel x={240} y={290} text="+" textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--color-ink)" />

      {/* Arrow down to result */}
      <DiagramArrow fromX={260} fromY={330} toX={260} toY={360} />

      {/* Result */}
      <DiagramLabel
        x={260}
        y={385}
        text="Physical Address: 0x7345"
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="var(--color-ink)"
      />
    </DiagramSvg>
  );
}
