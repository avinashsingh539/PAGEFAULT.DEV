/**
 * Shared SVG diagram primitives for PAGEFAULT.DEV concept pages.
 *
 * Provides consistent boxes, arrows, labels, and connectors so all six concept
 * diagrams look like they belong to the same product. No external dependencies:
 * inline SVG only, styled with Tailwind utility classes and inline SVG attributes.
 *
 * Every diagram exports a `<svg>` with a `<title>` and `<desc>` for accessibility.
 */

import type { JSX, ReactNode } from "react";

/** A diagram box: rounded rectangle with a centered label. */
export function DiagramBox({
  x,
  y,
  width,
  height,
  label,
  fill = "var(--color-surface)",
  stroke = "var(--color-line)",
  strokeWidth = 2,
  fontSize = 12,
  fontWeight = 600,
  textFill = "var(--color-ink)",
  rx = 6,
  className,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: number;
  textFill?: string;
  rx?: number;
  className?: string;
}): JSX.Element {
  return (
    <g className={className}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 + fontSize / 3}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-display)"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={textFill}
      >
        {label}
      </text>
    </g>
  );
}

/** A one-way arrow from one point to another, with an optional label above it. */
export function DiagramArrow({
  fromX,
  fromY,
  toX,
  toY,
  label,
  labelOffsetY = -8,
  stroke = "var(--color-muted)",
  strokeWidth = 2,
  markerSize = 8,
  fontSize = 11,
  textFill = "var(--color-muted)",
  className,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
  labelOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
  markerSize?: number;
  fontSize?: number;
  textFill?: string;
  className?: string;
}): JSX.Element {
  return (
    <g className={className}>
      <defs>
        <marker
          id={`arrowhead-${fromX}-${fromY}-${toX}-${toY}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={markerSize}
          markerHeight={markerSize}
          orient="auto"
        >
          <polygon points="0,0 10,5 0,10" fill={stroke} />
        </marker>
      </defs>
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd={`url(#arrowhead-${fromX}-${fromY}-${toX}-${toY})`}
      />
      {label !== undefined && (
        <text
          x={(fromX + toX) / 2}
          y={(fromY + toY) / 2 + labelOffsetY}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={fontSize}
          fill={textFill}
          fontWeight={500}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A vertical connector between two stacked boxes. */
export function DiagramConnector({
  x,
  fromY,
  toY,
  stroke = "var(--color-line-strong)",
  strokeWidth = 2,
  className,
}: {
  x: number;
  fromY: number;
  toY: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}): JSX.Element {
  return (
    <g className={className}>
      <line x1={x} y1={fromY} x2={x} y2={toY} stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx={x} cy={fromY} r={3} fill={stroke} />
      <circle cx={x} cy={toY} r={3} fill={stroke} />
    </g>
  );
}

/** A labeled note/caption beneath a diagram element. */
export function DiagramLabel({
  x,
  y,
  text,
  textAnchor = "middle",
  fontSize = 11,
  fontWeight,
  fill = "var(--color-muted)",
  className,
}: {
  x: number;
  y: number;
  text: string;
  textAnchor?: "start" | "middle" | "end";
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  className?: string;
}): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontFamily="var(--font-sans)"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      className={className}
    >
      {text}
    </text>
  );
}

/** A branch point: a small circle where a path splits into two. */
export function DiagramBranch({
  x,
  y,
  r = 5,
  fill = "var(--color-primary-strong)",
  className,
}: {
  x: number;
  y: number;
  r?: number;
  fill?: string;
  className?: string;
}): JSX.Element {
  return (
    <g className={className}>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x} cy={y} r={r + 2} fill="none" stroke={fill} strokeWidth={2} />
    </g>
  );
}

/** Wrapper for every diagram: SVG with title and desc, responsive viewBox. */
export function DiagramSvg({
  title,
  desc,
  viewBox,
  children,
  width = "100%",
  height,
}: {
  title: string;
  desc: string;
  viewBox: string;
  children: ReactNode;
  width?: string;
  height?: string | number;
}): JSX.Element {
  return (
    <svg
      role="img"
      aria-labelledby={`diagram-title-${title.replace(/\s+/g, "-").toLowerCase()}`}
      aria-describedby={`diagram-desc-${title.replace(/\s+/g, "-").toLowerCase()}`}
      width={width}
      height={height}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className="max-w-none w-full h-auto my-4"
    >
      <title id={`diagram-title-${title.replace(/\s+/g, "-").toLowerCase()}`}>{title}</title>
      <desc id={`diagram-desc-${title.replace(/\s+/g, "-").toLowerCase()}`}>{desc}</desc>
      {children}
    </svg>
  );
}
