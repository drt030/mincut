"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { radialBandFor } from "../lib/lod";

/**
 * Per ADR-0006 §LOD (semantic zoom) and slice A4 of
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`,
 * `RadialNode` branches its rendered output on `radialBandFor(zoom)`:
 *
 *   Band 1 (zoom < 0.5):    5px SVG dot, no label, no outline, no card.
 *   Band 2 (0.5 ≤ z < 1.5): 12px circle + truncated label + outline.
 *   Band 3 (zoom ≥ 1.5):    80×40 HTML card with full name + maturity badge.
 *
 * The component takes `zoom` as an explicit prop (not subscribed via
 * `useStore` inside the component) so unit tests can render it without
 * a `<ReactFlow>` provider in scope. The production `GraphExplorer`
 * subscribes to React Flow's transform store via
 * `useStore((s) => Math.floor(s.transform[2] * 2))` and passes the zoom
 * value through React Flow's `data` prop to a thin wrapper that calls
 * this component.
 *
 * Band-2 truncation rule: a name longer than 12 chars is hard-sliced
 * at 11 chars and a Unicode ellipsis appended (final length 12).
 * Word-boundary truncation would be nicer but is overkill for the band-2
 * marker — the band-3 card always shows the full name.
 *
 * The band-2 outline uses a hard-coded grey (`#888`); slice B1 will
 * swap that for the colour-mode band derived from the node's
 * cost / maturity / risk profile.
 *
 * The band-3 badge currently shows the maturity label string; B1 will
 * extend this to a mode-aware badge.
 *
 * `withHandles` (default false) gates the two invisible ReactFlow
 * `<Handle>` elements. ReactFlow refuses to draw an edge for a node
 * type that does not declare any handles (it logs
 * "Couldn't create edge for source handle id: null" once per attempted
 * edge), so production rendering inside `<ReactFlow>` MUST pass
 * `withHandles`. The standalone `renderToStaticMarkup` LOD tests in
 * `tests/lod.test.ts` render this component without a ReactFlow
 * provider in scope — `<Handle>` internally calls `useStore`, which
 * would crash there — so the default-false gate keeps tests working
 * without mocking the entire ReactFlow store. The handles are rendered
 * without an `id`, so the resulting `handleId` is `null` (per
 * `@xyflow/react`'s `id || null` rule), matching edges that don't
 * specify `sourceHandle` / `targetHandle`.
 */

export type RadialNodeProps = {
  id: string;
  name: string;
  /** HSL string (e.g. `hsl(200, 60%, 50%)`) for the node fill. */
  fill: string;
  /** Short label rendered as the band-3 badge (e.g. "Lab prototype"). */
  maturityLabel: string;
  zoom: number;
  /**
   * When true, render hidden ReactFlow `<Handle>` source+target pair so
   * edges can attach. Default false so the standalone unit tests can
   * render this component outside a `<ReactFlowProvider>`.
   */
  withHandles?: boolean;
  /**
   * Per-node outline colour driven by the active colour mode (B1). Used
   * at band 2+ to encode the node's mode band (cost / maturity / risk)
   * without overriding the subsystem-hue fill. Falls back to a neutral
   * grey when undefined.
   */
  outlineColor?: string;
};

/**
 * Invisible 1×1 source+target handle pair anchored at the dot's centre.
 * Visibility is collapsed via `opacity: 0` and `pointerEvents: none` so
 * the handles never paint or steal a click; they exist only to satisfy
 * ReactFlow's "every edge endpoint needs a handle" contract. The handles
 * are intentionally unnamed (no `id` prop) — `@xyflow/react` resolves a
 * missing id to `null`, matching the implicit null handle id on edges
 * that don't specify `sourceHandle` / `targetHandle` (which is the case
 * for every radial edge today).
 */
function HiddenHandles() {
  const sharedStyle: React.CSSProperties = {
    width: 1,
    height: 1,
    minWidth: 1,
    minHeight: 1,
    background: "transparent",
    border: "none",
    opacity: 0,
    pointerEvents: "none",
  };
  return (
    <>
      <Handle type="target" position={Position.Top} style={sharedStyle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={sharedStyle} isConnectable={false} />
    </>
  );
}

const MAX_LABEL_CHARS = 12;
const KEEP_LABEL_CHARS = 11;
const ELLIPSIS = "…";

function truncateLabel(name: string): string {
  if (name.length <= MAX_LABEL_CHARS) return name;
  return `${name.slice(0, KEEP_LABEL_CHARS)}${ELLIPSIS}`;
}

export function RadialNode({ name, fill, maturityLabel, zoom, withHandles = false, outlineColor }: RadialNodeProps) {
  const band = radialBandFor(zoom);
  // Per ADR-0006 §"Color mode K4 layering", band-2+ node outlines pick
  // up the active colour mode's band colour. Falls back to the legacy
  // neutral grey when no mode hint is supplied.
  const outline = outlineColor ?? "#888";

  if (band === 1) {
    // 5px dot, centred in a 14×14 SVG so the wrapper hit-area matches
    // the band-2 outline footprint and band-1 ↔ band-2 transitions
    // don't reflow the React Flow node box.
    return (
      <>
        {withHandles ? <HiddenHandles /> : null}
        <svg width={14} height={14} aria-hidden="true">
          <circle cx={7} cy={7} r={5} fill={fill} />
        </svg>
      </>
    );
  }

  if (band === 2) {
    // 12px circle + outline + truncated label below the marker. The
    // outline is currently a hard-coded grey; B1 will replace with the
    // colour-mode band. The SVG canvas is 72×42 — deliberately NOT
    // 80×40 — so a regex check that band 2 does not render the band-3
    // card footprint stays unambiguous.
    const label = truncateLabel(name);
    return (
      <>
        {withHandles ? <HiddenHandles /> : null}
        <svg width={72} height={42} aria-hidden="true">
          <circle
            cx={36}
            cy={14}
            r={12}
            fill={fill}
            stroke={outline}
            strokeWidth={1.5}
          />
          <text
            x={36}
            y={36}
            textAnchor="middle"
            fontSize={10}
            fill="#0f172a"
          >
            {label}
          </text>
        </svg>
      </>
    );
  }

  // Band 3: 80×40 HTML card. We mount the HTML inside a foreignObject so
  // the component composes naturally under an SVG canvas (React Flow's
  // node-host element is HTML, but we keep the foreignObject so the
  // contract is uniform — band 1 + 2 are SVG, band 3 is HTML-in-SVG).
  return (
    <>
      {withHandles ? <HiddenHandles /> : null}
      <svg width={80} height={40}>
        <foreignObject width={80} height={40}>
          <div
            style={{
              width: 80,
              height: 40,
              background: fill,
              border: `1px solid ${outline}`,
              borderRadius: 4,
              padding: "2px 4px",
              boxSizing: "border-box",
              fontSize: 9,
              color: "#0f172a",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontSize: 8,
                background: "rgba(255,255,255,0.7)",
                borderRadius: 2,
                padding: "0 3px",
                alignSelf: "flex-start",
              }}
            >
              {maturityLabel}
            </span>
          </div>
        </foreignObject>
      </svg>
    </>
  );
}
