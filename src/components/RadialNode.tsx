"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { radialBandFor } from "../lib/lod";

/**
 * Per ADR-0006 §LOD (semantic zoom) and slice A4 of
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`,
 * `RadialNode` branches its rendered output on `radialBandFor(zoom)`:
 *
 *   Band 1 (zoom < 0.5):    centered overview dot in the detail footprint.
 *   Band 2 (0.5 ≤ z < 1.5): larger circle + truncated label + outline.
 *   Band 3 (zoom ≥ 1.5):    136×72 HTML card with full name + maturity badge.
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
 * The band-2 outline is a neutral affordance channel only. It marks
 * current selection supplied by `GraphExplorer`; analytical colour
 * remains on edges so node contours do not contradict nearby lines.
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
   * Neutral per-node outline colour. This must not encode cost,
   * maturity, or bottleneck-risk; `GraphExplorer` uses it only for
   * selection affordance. Falls back to grey when undefined.
   */
  outlineColor?: string;
  /**
   * Stable overview hierarchy. Anchors are first-layer subsystem marks,
   * branch nodes are ordinary internal nodes, and leaves become quiet
   * texture until the user zooms in.
   */
  visualRole?: "root" | "anchor" | "branch" | "leaf";
  /** Suppress low-zoom labels for quiet texture nodes. */
  showLabel?: boolean;
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
function HiddenHandles({ top }: { top: number }) {
  const sharedStyle: React.CSSProperties = {
    left: "50%",
    top,
    transform: "translate(-50%, -50%)",
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
      <Handle type="target" position={Position.Left} style={sharedStyle} isConnectable={false} />
      <Handle type="source" position={Position.Left} style={sharedStyle} isConnectable={false} />
    </>
  );
}

const MAX_LABEL_CHARS = 15;
const KEEP_LABEL_CHARS = 14;
const ELLIPSIS = "…";
const BAND2_WIDTH = 108;
const BAND2_HEIGHT = 64;
const BAND3_WIDTH = 136;
const BAND3_HEIGHT = 72;
const BAND3_CENTER_X = BAND3_WIDTH / 2;
const BAND3_CENTER_Y = BAND3_HEIGHT / 2;
const BAND2_OFFSET_X = (BAND3_WIDTH - BAND2_WIDTH) / 2;
const BAND2_OFFSET_Y = (BAND3_HEIGHT - BAND2_HEIGHT) / 2;
const BAND2_CENTER_X = BAND2_OFFSET_X + BAND2_WIDTH / 2;
const BAND2_CIRCLE_Y = BAND2_OFFSET_Y + 20;

function truncateLabel(name: string): string {
  if (name.length <= MAX_LABEL_CHARS) return name;
  return `${name.slice(0, KEEP_LABEL_CHARS)}${ELLIPSIS}`;
}

export function RadialNode({
  name,
  fill,
  maturityLabel,
  zoom,
  withHandles = false,
  outlineColor,
  visualRole = "branch",
  showLabel = true,
}: RadialNodeProps) {
  const band = radialBandFor(zoom);
  // Keep node contour neutral: active analysis colour belongs to edges,
  // while this outline only carries selection affordance.
  const outline = outlineColor ?? "#888";
  const hasOutline = outline !== "transparent" && outline !== "none";

  if (band === 1) {
    const radiusByRole = {
      root: 26,
      anchor: 22,
      branch: 15,
      leaf: 9,
    } as const;
    const opacityByRole = {
      root: 1,
      anchor: 0.96,
      branch: 0.82,
      leaf: 0.46,
    } as const;
    const r = radiusByRole[visualRole];
    const opacity = opacityByRole[visualRole];
    return (
      <>
        {withHandles ? <HiddenHandles top={BAND3_CENTER_Y} /> : null}
        <svg width={BAND3_WIDTH} height={BAND3_HEIGHT} aria-hidden="true">
          <circle cx={BAND3_CENTER_X} cy={BAND3_CENTER_Y} r={r} fill={fill} opacity={opacity} />
        </svg>
      </>
    );
  }

  if (band === 2) {
    // Larger circle + outline + truncated label below the marker. The
    // visible content stays 108×64, but the outer SVG reserves the
    // 136×72 detail footprint so every display mode uses the same layout
    // box.
    const label = truncateLabel(name);
    const radiusByRole = {
      root: 18,
      anchor: 17,
      branch: 16,
      leaf: 10,
    } as const;
    const opacityByRole = {
      root: 1,
      anchor: 0.96,
      branch: 0.82,
      leaf: 0.5,
    } as const;
    const r = radiusByRole[visualRole];
    const opacity = opacityByRole[visualRole];
    return (
      <>
        {withHandles ? <HiddenHandles top={BAND2_CIRCLE_Y} /> : null}
        <svg width={BAND3_WIDTH} height={BAND3_HEIGHT} aria-hidden="true">
          <rect
            x={BAND2_OFFSET_X}
            y={BAND2_OFFSET_Y}
            width={BAND2_WIDTH}
            height={BAND2_HEIGHT}
            fill="transparent"
          />
          <circle
            cx={BAND2_CENTER_X}
            cy={BAND2_CIRCLE_Y}
            r={r}
            fill={fill}
            opacity={opacity}
            stroke={outline}
            strokeWidth={hasOutline ? 1.5 : 0}
          />
          {showLabel ? (
            <text
              x={BAND2_CENTER_X}
              y={BAND2_OFFSET_Y + 54}
              textAnchor="middle"
              fontSize={13}
              fill="#0f172a"
            >
              {label}
            </text>
          ) : null}
        </svg>
      </>
    );
  }

  // Band 3: 136×72 HTML card. We mount the HTML inside a foreignObject so
  // the component composes naturally under an SVG canvas (React Flow's
  // node-host element is HTML, but we keep the foreignObject so the
  // contract is uniform — band 1 + 2 are SVG, band 3 is HTML-in-SVG).
  return (
    <>
      {withHandles ? <HiddenHandles top={BAND3_CENTER_Y} /> : null}
      <svg width={BAND3_WIDTH} height={BAND3_HEIGHT}>
        <foreignObject width={BAND3_WIDTH} height={BAND3_HEIGHT}>
          <div
            style={{
              width: BAND3_WIDTH,
              height: BAND3_HEIGHT,
              background: fill,
              border: hasOutline ? `1px solid ${outline}` : 0,
              borderRadius: 4,
              padding: "7px 8px",
              boxSizing: "border-box",
              fontSize: 14,
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
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontSize: 10,
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
