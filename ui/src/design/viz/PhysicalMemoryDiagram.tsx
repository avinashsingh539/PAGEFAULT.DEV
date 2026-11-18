/**
 * Diagram E: Physical Memory
 *
 * Shows RAM organized into fixed-size frames, then illustrates how a
 * translated frame number and the unchanged page offset form a physical
 * address. Frame 7 is labeled as an example, not a guaranteed result.
 */

import type { JSX } from "react";

import { DiagramArrow, DiagramBox, DiagramLabel, DiagramSvg } from "./DiagramPrimitives";

/**
 * Physical-memory frame layout. viewBox: 0 0 500 420
 */
export function PhysicalMemoryDiagram(): JSX.Element {
  return (
    <DiagramSvg
      title="Physical memory frame layout"
      desc="Physical RAM is divided into fixed-size frames. A translated frame number combines with the preserved page offset to form a physical address. Frame 7 is an example mapping, not a guaranteed simulation result."
      viewBox="0 0 500 420"
      height={340}
    >
      {/* Title */}
      <DiagramLabel x={250} y={25} text="Physical RAM" textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--color-ink)" />

      {/* Frame stack */}
      <DiagramBox x={150} y={50} width={200} height={40} label="Frame 0" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramBox x={150} y={95} width={200} height={40} label="Frame 1" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramBox x={150} y={140} width={200} height={40} label="Frame 2" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramBox x={150} y={185} width={200} height={40} label="…" fill="var(--color-surface-soft)" stroke="var(--color-line-strong)" fontSize={14} />
      <DiagramBox x={150} y={230} width={200} height={40} label="Frame 7 (example)" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramBox x={150} y={275} width={200} height={40} label="…" fill="var(--color-surface-soft)" stroke="var(--color-line-strong)" fontSize={14} />

      {/* Arrow to composition diagram */}
      <DiagramArrow fromX={250} fromY={325} toX={250} toY={345} />

      {/* Composition: frame + offset = physical address */}
      <DiagramBox x={100} y={350} width={130} height={50} label="Frame 7" fill="var(--color-hit-soft)" stroke="var(--color-hit)" fontSize={12} />
      <DiagramLabel x={235} y={375} text="+" textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--color-ink)" />
      <DiagramBox x={270} y={350} width={130} height={50} label="Offset 0x345" fill="var(--color-surface)" stroke="var(--color-line)" fontSize={12} />
      <DiagramArrow fromX={395} fromY={375} toX={425} toY={375} />
      <DiagramBox x={430} y={350} width={70} height={50} label="0x7345" fill="var(--color-primary-soft)" stroke="var(--color-primary-strong)" fontSize={12} />
    </DiagramSvg>
  );
}
