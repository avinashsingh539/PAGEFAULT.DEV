/**
 * Diagram F: RAM Access
 *
 * Shows the complete successful access path: CPU request → Virtual address →
 * Translation → Physical address → RAM read/write. Differentiates read and
 * write operations. Shows that a successful translation precedes the modeled
 * RAM access, and what happens on a page fault.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * Complete RAM access path. viewBox: 0 0 560 420
 */
export function RamAccessDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="RAM access path"
      desc="Only after a successful translation does the engine report a RAM access. The physical address is sent to RAM, which performs the read or write. On a page fault, no RAM access occurs."
      viewBox="0 0 560 420"
      height={340}
    >
      {/* Top: input */}
      <DiagramLabel x={280} y={30} text="CPU Request" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)" />
      <DiagramArrow fromX={280} fromY={50} toX={280} toY={70} />

      {/* Translation pipeline */}
      <DiagramBox x={80} y={75} width={120} height={50} label="Virtual Address" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramArrow fromX={200} fromY={100} toX={220} toY={100} />
      <DiagramBox x={220} y={75} width={120} height={50} label="Translation" fill="var(--color-info-soft)" stroke="var(--color-info)" fontSize={12} />
      <DiagramArrow fromX={340} fromY={100} toX={360} toY={100} />
      <DiagramBox x={360} y={75} width={120} height={50} label="Physical Address" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />

      {/* Arrow down to RAM */}
      <DiagramArrow fromX={280} fromY={135} toX={280} toY={170} />

      {/* RAM box */}
      <DiagramBox x={220} y={175} width={120} height={55} label="RAM Read/Write" fill="var(--color-surface-soft)" stroke="var(--color-line-strong)" fontSize={12} />

      {/* Read/Write distinction */}
      <DiagramBox x={60} y={250} width={180} height={50} label="Read: data → CPU" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={11} />
      <DiagramBox x={320} y={250} width={180} height={50} label="Write: CPU → data" fill="var(--color-primary-soft)" stroke="var(--color-primary-strong)" fontSize={11} />

      {/* Page fault note */}
      <DiagramBox x={60} y={320} width={440} height={70} label="Page fault: translation fails → no RAM access occurs" fill="var(--color-error-soft)" stroke="var(--color-error)" fontSize={11} />
    </DiagramSvg>
  );
}
