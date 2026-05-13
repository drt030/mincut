"use client";

import React from "react";
import { radialBandFor } from "../lib/lod";

/**
 * Per ADR-0006 §LOD (semantic zoom) and slice A4 of
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`,
 * `RadialEdge` branches its rendered output on `radialBandFor(zoom)`:
 *
 *   Band 1 (zoom < 0.5):    thin grey line, no arrowhead, no label.
 *   Band 2 (0.5 ≤ z < 1.5): line + arrowhead (`marker-end`), no label.
 *   Band 3 (zoom ≥ 1.5):
 *     · isFocusEndpoint = false → arrowhead, still no label
 *     · isFocusEndpoint = true  → arrowhead + visible relation label
 *
 * Focus state is `null` throughout A4 so `isFocusEndpoint` is always
 * false in production for now; the prop is wired in early so Phase B
 * can flip it on without touching this component.
 *
 * The arrowhead marker is defined inline in a per-edge `<defs>` with
 * a stable id derived from the edge id. Inline-per-edge avoids needing
 * a top-level shared `<defs>` in `GraphExplorer.tsx` and keeps each
 * `RadialEdge` self-contained for the unit tests.
 *
 * Coordinates default to (0, 0) → (100, 0) so the unit tests can render
 * a band-checking RadialEdge without plumbing source/target geometry.
 * The production `GraphExplorer` passes real React Flow `sourceX/Y` /
 * `targetX/Y` via a thin wrapper.
 */

export type RadialEdgeProps = {
  id: string;
  source: string;
  target: string;
  /** Edge relation rendered as the band-3 focused label (e.g. "requires"). */
  label: string;
  zoom: number;
  /** True when the source or target node is the currently-focused node. */
  isFocusEndpoint: boolean;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  /**
   * Per-edge stroke + width chosen by the active colour mode. When
   * omitted the legacy slate-grey + 1 px combination is used (matches
   * the slice-A4 default before B1 wired colour-mode K4 layering).
   */
  stroke?: string;
  strokeWidth?: number;
};

const DEFAULT_STROKE = "#cbd5e1";
const DEFAULT_WIDTH = 1;

export function RadialEdge({
  id,
  label,
  zoom,
  isFocusEndpoint,
  sourceX = 0,
  sourceY = 0,
  targetX = 100,
  targetY = 0,
  stroke = DEFAULT_STROKE,
  strokeWidth = DEFAULT_WIDTH,
}: RadialEdgeProps) {
  const band = radialBandFor(zoom);
  const markerId = `arrow-${id}`;
  const pathD = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const showArrowhead = band >= 2;
  const showLabel = band === 3 && isFocusEndpoint;

  return (
    <g>
      {showArrowhead ? (
        <defs>
          <marker
            id={markerId}
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={4}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill={stroke} />
          </marker>
        </defs>
      ) : null}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd={showArrowhead ? `url(#${markerId})` : undefined}
      />
      {showLabel ? (
        <text
          x={midX}
          y={midY - 4}
          textAnchor="middle"
          fontSize={10}
          fill="#0f172a"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
