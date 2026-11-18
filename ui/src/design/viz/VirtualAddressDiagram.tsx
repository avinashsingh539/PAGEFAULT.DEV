/**
 * Diagram A: Virtual Address
 *
 * CPU → Virtual Address → MMU → Physical Address → RAM
 *
 * Explains that the CPU issues a virtual address and the memory-translation
 * process determines where the request maps in physical memory. Clearly
 * distinguishes virtual and physical addresses.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * The virtual-address journey as a horizontal flow of five stations.
 * viewBox: 0 0 760 260
 */
export function VirtualAddressDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Virtual address translation flow"
      desc="A five-step flow: CPU issues a virtual address, the MMU translates it into a physical address, and RAM services the request at that physical address."
      viewBox="0 0 760 260"
    >
      {/* Station boxes */}
      <DiagramBox x={40} y={80} width={120} height={55} label="CPU" fill="var(--color-primary-soft)" stroke="var(--color-primary-strong)" />
      <DiagramBox x={200} y={80} width={130} height={55} label="Virtual Address" fill="var(--color-surface)" stroke="var(--color-line)" />
      <DiagramBox x={370} y={80} width={100} height={55} label="MMU" fill="var(--color-info-soft)" stroke="var(--color-info)" />
      <DiagramBox x={510} y={80} width={120} height={55} label="Physical Address" fill="var(--color-hit-soft)" stroke="var(--color-hit)" />
      <DiagramBox x={670} y={80} width={90} height={55} label="RAM" fill="var(--color-surface-soft)" stroke="var(--color-line-strong)" />

      {/* Arrows between stations */}
      <DiagramArrow fromX={160} fromY={107} toX={200} toY={107} />
      <DiagramArrow fromX={330} fromY={107} toX={370} toY={107} />
      <DiagramArrow fromX={470} fromY={107} toX={510} toY={107} />
      <DiagramArrow fromX={630} fromY={107} toX={670} toY={107} />

      {/* Labels under each box */}
      <DiagramLabel x={100} y={160} text="Issues" fontSize={10} fill="var(--color-muted)" />
      <DiagramLabel x={265} y={160} text="0x1345 (example)" fontSize={10} fill="var(--color-muted)" />
      <DiagramLabel x={420} y={160} text="Translates" fontSize={10} fill="var(--color-muted)" />
      <DiagramLabel x={570} y={160} text="0x7345 (example)" fontSize={10} fill="var(--color-muted)" />
      <DiagramLabel x={715} y={160} text="Reads/writes" fontSize={10} fill="var(--color-muted)" />

      {/* Virtual vs physical distinction */}
      <DiagramBox x={200} y={180} width={170} height={30} label="Virtual: program's view" fill="var(--color-primary-soft)" stroke="var(--color-primary-strong)" fontSize={10} />
      <DiagramBox x={420} y={180} width={170} height={30} label="Physical: RAM's view" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={10} />
    </DiagramSvg>
  );
}
