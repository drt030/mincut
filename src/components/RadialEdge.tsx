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
 *   Band 3 (zoom ≥ 1.5): line + arrowhead, no relation label.
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
  /** Edge relation kept for accessibility/data plumbing; not rendered on-canvas. */
  label: string;
  zoom: number;
  /** True when the source or target node is the currently-focused node. */
  isFocusEndpoint: boolean;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  /** Optional detail-mode card-edge source port in canvas coordinates. */
  sourceAnchorX?: number;
  sourceAnchorY?: number;
  /** Optional detail-mode card-edge target port in canvas coordinates. */
  targetAnchorX?: number;
  targetAnchorY?: number;
  /** Radius used to trim the path away from the source node centre. */
  sourceRadius?: number;
  /** Radius used to trim the path away from the target node centre. */
  targetRadius?: number;
  /**
   * Per-edge stroke + width chosen by the active colour mode. When
   * omitted the legacy slate-grey + 1 px combination is used (matches
   * the slice-A4 default before B1 wired colour-mode K4 layering).
   */
  stroke?: string;
  strokeWidth?: number;
  /** Current radial root, used to keep root incident edges visually direct. */
  rootNodeId?: string;
  /**
   * B3 (greyscale focus): when true, the edge wraps in a `<g>` with
   * the `.radial-dim` class so CSS animates `filter: saturate(0)`
   * over 400ms. Defaults to false so the unit tests (which don't
   * thread focus state) render at full saturation.
   */
  dim?: boolean;
  /** Emphasise the edge when it is incident to the selected/hovered node. */
  highlighted?: boolean;
  /** Main branch emphasis; unlike `highlighted`, this is path-level. */
  emphasis?: "branch" | "normal";
  /**
   * `primary` edges are parent-child dependency branches inside a
   * subsystem sector. `cross` edges point to shared components from a
   * secondary parent and should read as contextual arcs rather than as
   * the main tree structure.
   */
  edgeKind?: "primary" | "cross";
};

const DEFAULT_STROKE = "#cbd5e1";
const DEFAULT_WIDTH = 1;

const CENTER = { x: 0, y: 0 };
const STRAIGHT_RADIUS_EPSILON = 24;
const STRAIGHT_ANGLE_EPSILON = 0.08;
const OVERVIEW_OUTER_DETAIL_RADIUS = 430;
const MIN_ARROW_LENGTH = 8;
const ARROW_LENGTH_TO_STROKE = 3.2;
const ARROW_HEIGHT_TO_STROKE = 2.6;
const DETAIL_CARD_BOX = { width: 136, height: 72 } as const;
const DETAIL_EDGE_GAP = 7;

function svgNumber(value: number): string {
  if (Math.abs(value) < 1e-9) return "0";
  return Number(value.toFixed(6)).toString();
}

function shortestDelta(a: number, b: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function radialBranchGeometry(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  options: { forceCurve?: boolean; forceLine?: boolean } = {},
):
  | {
    kind: "line";
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
  }
  | {
    kind: "cubic";
    sourceX: number;
    sourceY: number;
    c1x: number;
    c1y: number;
    c2x: number;
    c2y: number;
    targetX: number;
    targetY: number;
  } {
  const sourceR = Math.hypot(sourceX - CENTER.x, sourceY - CENTER.y);
  const targetR = Math.hypot(targetX - CENTER.x, targetY - CENTER.y);
  const sourceTheta = Math.atan2(sourceY - CENTER.y, sourceX - CENTER.x);
  const targetTheta = Math.atan2(targetY - CENTER.y, targetX - CENTER.x);
  const delta = shortestDelta(sourceTheta, targetTheta);

  if (
    options.forceLine ||
    sourceR < STRAIGHT_RADIUS_EPSILON ||
    targetR < STRAIGHT_RADIUS_EPSILON ||
    (!options.forceCurve && Math.abs(delta) < STRAIGHT_ANGLE_EPSILON)
  ) {
    return { kind: "line", sourceX, sourceY, targetX, targetY };
  }

  const sourceControlR = sourceR + (targetR - sourceR) * 0.48;
  const targetControlR = targetR - (targetR - sourceR) * 0.22;
  return {
    kind: "cubic",
    sourceX,
    sourceY,
    c1x: sourceControlR * Math.cos(sourceTheta),
    c1y: sourceControlR * Math.sin(sourceTheta),
    c2x: targetControlR * Math.cos(targetTheta),
    c2y: targetControlR * Math.sin(targetTheta),
    targetX,
    targetY,
  };
}

function crossSectorControl(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): { cx: number; cy: number } {
  const controlR = Math.max(
    80,
    Math.min(Math.hypot(sourceX, sourceY), Math.hypot(targetX, targetY)) * 0.45,
  );
  const sourceTheta = Math.atan2(sourceY, sourceX);
  const targetTheta = Math.atan2(targetY, targetX);
  const midTheta = sourceTheta + shortestDelta(sourceTheta, targetTheta) / 2;
  return {
    cx: controlR * Math.cos(midTheta),
    cy: controlR * Math.sin(midTheta),
  };
}

/**
 * Build a radial tree-style branch path as a soft cubic branch. The
 * earlier circular-arc elbow made focused branches look like oversized
 * rings when siblings sat on nearby radii; this keeps the tree skeleton
 * readable without turning dependency edges into straight chords.
 */
export function radialBranchPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  options: { forceCurve?: boolean; forceLine?: boolean } = {},
): string {
  const geometry = radialBranchGeometry(sourceX, sourceY, targetX, targetY, options);
  if (geometry.kind === "line") {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  return `M ${sourceX} ${sourceY} C ${geometry.c1x} ${geometry.c1y} ${geometry.c2x} ${geometry.c2y} ${targetX} ${targetY}`;
}

function trimPointAlongVector(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  direction: 1 | -1,
): { x: number; y: number } {
  const length = Math.hypot(vx, vy);
  if (length === 0 || radius === 0) return { x, y };
  return {
    x: x + (vx / length) * radius * direction,
    y: y + (vy / length) * radius * direction,
  };
}

function distanceToRectangleBoundary(vx: number, vy: number, width: number, height: number): number {
  const length = Math.hypot(vx, vy);
  if (length === 0) return 0;
  const ux = Math.abs(vx / length);
  const uy = Math.abs(vy / length);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  if (ux === 0) return halfHeight;
  if (uy === 0) return halfWidth;
  return Math.min(halfWidth / ux, halfHeight / uy);
}

function trimEndpointForPath(
  edgeKind: "primary" | "cross",
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourceRadius: number,
  targetRadius: number,
  boxTrim?: { source: { width: number; height: number }; target: { width: number; height: number } },
  options: { forceCurve?: boolean; forceLine?: boolean } = {},
): { sourceX: number; sourceY: number; targetX: number; targetY: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy);
  if (distance <= sourceRadius + targetRadius || distance === 0) {
    return { sourceX, sourceY, targetX, targetY };
  }

  if (edgeKind === "cross") {
    const control = crossSectorControl(sourceX, sourceY, targetX, targetY);
    const effectiveSourceRadius = boxTrim
      ? distanceToRectangleBoundary(control.cx - sourceX, control.cy - sourceY, boxTrim.source.width, boxTrim.source.height)
      : sourceRadius;
    const effectiveTargetRadius = boxTrim
      ? distanceToRectangleBoundary(targetX - control.cx, targetY - control.cy, boxTrim.target.width, boxTrim.target.height)
      : targetRadius;
    const source = trimPointAlongVector(
      sourceX,
      sourceY,
      control.cx - sourceX,
      control.cy - sourceY,
      effectiveSourceRadius,
      1,
    );
    const target = trimPointAlongVector(
      targetX,
      targetY,
      targetX - control.cx,
      targetY - control.cy,
      effectiveTargetRadius,
      -1,
    );
    return { sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y };
  }

  const geometry = radialBranchGeometry(sourceX, sourceY, targetX, targetY, options);
  if (geometry.kind === "cubic") {
    const effectiveSourceRadius = boxTrim
      ? distanceToRectangleBoundary(geometry.c1x - sourceX, geometry.c1y - sourceY, boxTrim.source.width, boxTrim.source.height)
      : sourceRadius;
    const effectiveTargetRadius = boxTrim
      ? distanceToRectangleBoundary(targetX - geometry.c2x, targetY - geometry.c2y, boxTrim.target.width, boxTrim.target.height)
      : targetRadius;
    const source = trimPointAlongVector(
      sourceX,
      sourceY,
      geometry.c1x - sourceX,
      geometry.c1y - sourceY,
      effectiveSourceRadius,
      1,
    );
    const target = trimPointAlongVector(
      targetX,
      targetY,
      targetX - geometry.c2x,
      targetY - geometry.c2y,
      effectiveTargetRadius,
      -1,
    );
    return { sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y };
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const effectiveSourceRadius = boxTrim
    ? distanceToRectangleBoundary(dx, dy, boxTrim.source.width, boxTrim.source.height)
    : sourceRadius;
  const effectiveTargetRadius = boxTrim
    ? distanceToRectangleBoundary(dx, dy, boxTrim.target.width, boxTrim.target.height)
    : targetRadius;
  return {
    sourceX: sourceX + ux * effectiveSourceRadius,
    sourceY: sourceY + uy * effectiveSourceRadius,
    targetX: targetX - ux * effectiveTargetRadius,
    targetY: targetY - uy * effectiveTargetRadius,
  };
}

function cleanPathNumbers(path: string): string {
  return path.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (value) => svgNumber(Number(value)));
}

function crossSectorPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const { cx, cy } = crossSectorControl(sourceX, sourceY, targetX, targetY);
  return `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
}

function outwardUnit(
  anchorX: number,
  anchorY: number,
  centerX: number,
  centerY: number,
): { x: number; y: number } {
  const dx = anchorX - centerX;
  const dy = anchorY - centerY;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { x: 1, y: 0 };
  if (Math.abs(dx) / DETAIL_CARD_BOX.width >= Math.abs(dy) / DETAIL_CARD_BOX.height) {
    return { x: dx >= 0 ? 1 : -1, y: 0 };
  }
  return { x: 0, y: dy >= 0 ? 1 : -1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function detailPortCurvePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceNormalX,
  sourceNormalY,
  targetNormalX,
  targetNormalY,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceNormalX: number;
  sourceNormalY: number;
  targetNormalX: number;
  targetNormalY: number;
}): string {
  const distance = Math.hypot(targetX - sourceX, targetY - sourceY);
  const controlDistance = clamp(distance * 0.34, 44, 150);
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + sourceNormalX * controlDistance} ${sourceY + sourceNormalY * controlDistance}`,
    `${targetX + targetNormalX * controlDistance} ${targetY + targetNormalY * controlDistance}`,
    `${targetX} ${targetY}`,
  ].join(" ");
}

export function RadialEdge({
  id,
  source,
  target,
  label: _label,
  zoom,
  isFocusEndpoint: _isFocusEndpoint,
  sourceX = 0,
  sourceY = 0,
  targetX = 100,
  targetY = 0,
  sourceAnchorX,
  sourceAnchorY,
  targetAnchorX,
  targetAnchorY,
  sourceRadius = 0,
  targetRadius = 0,
  stroke = DEFAULT_STROKE,
  strokeWidth = DEFAULT_WIDTH,
  rootNodeId,
  dim = false,
  highlighted = false,
  emphasis = "normal",
  edgeKind = "primary",
}: RadialEdgeProps) {
  const band = radialBandFor(zoom);
  const markerId = `arrow-${id}`;
  const isBranch = emphasis === "branch";
  const renderedStrokeWidth = isBranch
    ? band === 1 ? 2.4 : band === 2 ? 3.2 : 4.6
      : edgeKind === "cross"
        ? Math.max(strokeWidth, 0.8)
        : band === 1
          ? Math.min(Math.max(strokeWidth * 0.4, highlighted ? 1 : 0.55), 1.15)
          : band === 2
          ? highlighted
            ? Math.min(Math.max(strokeWidth * 0.74, 1.15), 4.5)
            : Math.min(Math.max(strokeWidth * 0.48, 0.75), 3.2)
          : Math.max(strokeWidth * 1.05, 1);
  const showArrowhead = band >= 2;
  const arrowLength = showArrowhead
    ? Math.max(MIN_ARROW_LENGTH, renderedStrokeWidth * ARROW_LENGTH_TO_STROKE)
    : 0;
  const arrowHeight = showArrowhead
    ? Math.max(MIN_ARROW_LENGTH, renderedStrokeWidth * ARROW_HEIGHT_TO_STROKE)
    : 0;
  // When the radial span between the two node centres is smaller than the
  // combined endpoint trim, the trimmed endpoints swap radial order and the
  // radial cubic rebuilt from them flips its end tangent — the arrowhead
  // renders pointing back toward the root. Fall back to the straight chord,
  // whose trim always keeps the arrow on the source → target direction.
  const radialSpan = Math.abs(
    Math.hypot(targetX - CENTER.x, targetY - CENTER.y) -
      Math.hypot(sourceX - CENTER.x, sourceY - CENTER.y),
  );
  const forceLine = edgeKind === "primary" &&
    radialSpan <= sourceRadius + targetRadius + arrowLength;
  const hasDetailAnchors = band === 3 &&
    sourceAnchorX !== undefined &&
    sourceAnchorY !== undefined &&
    targetAnchorX !== undefined &&
    targetAnchorY !== undefined;
  const anchored = hasDetailAnchors
    ? (() => {
      const sourceNormal = outwardUnit(sourceAnchorX, sourceAnchorY, sourceX, sourceY);
      const targetNormal = outwardUnit(targetAnchorX, targetAnchorY, targetX, targetY);
      const visibleSourceX = sourceAnchorX + sourceNormal.x * DETAIL_EDGE_GAP;
      const visibleSourceY = sourceAnchorY + sourceNormal.y * DETAIL_EDGE_GAP;
      const visibleTargetTipX = targetAnchorX + targetNormal.x * DETAIL_EDGE_GAP;
      const visibleTargetTipY = targetAnchorY + targetNormal.y * DETAIL_EDGE_GAP;
      return {
        sourceX: visibleSourceX,
        sourceY: visibleSourceY,
        targetX: visibleTargetTipX + targetNormal.x * arrowLength,
        targetY: visibleTargetTipY + targetNormal.y * arrowLength,
        sourceNormalX: sourceNormal.x,
        sourceNormalY: sourceNormal.y,
        targetNormalX: targetNormal.x,
        targetNormalY: targetNormal.y,
      };
    })()
    : null;
  const trimmed = anchored ?? trimEndpointForPath(
    edgeKind,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceRadius,
    targetRadius + arrowLength,
    band === 3
      ? {
        source: DETAIL_CARD_BOX,
        target: {
          width: DETAIL_CARD_BOX.width + arrowLength * 2,
          height: DETAIL_CARD_BOX.height + arrowLength * 2,
        },
      }
      : undefined,
    { forceCurve: band === 2 && edgeKind === "primary", forceLine },
  );
  const sourceR = Math.hypot(trimmed.sourceX, trimmed.sourceY);
  const targetR = Math.hypot(trimmed.targetX, trimmed.targetY);

  if (band < 3 && edgeKind === "cross") return null;

  const pathD = edgeKind === "cross"
    ? crossSectorPath(trimmed.sourceX, trimmed.sourceY, trimmed.targetX, trimmed.targetY)
    : anchored && source !== rootNodeId && target !== rootNodeId
      ? detailPortCurvePath({
        sourceX: anchored.sourceX,
        sourceY: anchored.sourceY,
        targetX: anchored.targetX,
        targetY: anchored.targetY,
        sourceNormalX: anchored.sourceNormalX,
        sourceNormalY: anchored.sourceNormalY,
        targetNormalX: anchored.targetNormalX,
        targetNormalY: anchored.targetNormalY,
      })
      : band === 2
        ? radialBranchPath(trimmed.sourceX, trimmed.sourceY, trimmed.targetX, trimmed.targetY, { forceCurve: true, forceLine })
      : `M ${trimmed.sourceX} ${trimmed.sourceY} L ${trimmed.targetX} ${trimmed.targetY}`;
  const renderedPathD = cleanPathNumbers(pathD);
  const isOuterDetail = Math.min(sourceR, targetR) > OVERVIEW_OUTER_DETAIL_RADIUS;
  const renderedStroke = isBranch
    ? stroke
    : band === 1 && edgeKind === "primary" ? "#8da4be" : stroke;
  const opacity = edgeKind === "cross"
    ? highlighted ? 0.52 : 0.18
    : isBranch
      ? band === 1 ? 0.72 : band === 2 ? 0.78 : 0.9
      : band === 1
        ? isOuterDetail ? 0.1 : 0.24
        : band === 2
        ? highlighted ? 0.58 : 0.32
        : highlighted ? 0.72 : 0.66;

  return (
    <g className={dim ? "radial-dim" : undefined}>
      {showArrowhead ? (
        <defs>
          <marker
            id={markerId}
            markerWidth={arrowLength}
            markerHeight={arrowHeight}
            markerUnits="userSpaceOnUse"
            refX={0}
            refY={arrowHeight / 2}
            orient="auto"
          >
            <path
              d={`M 0 0 L ${arrowLength} ${arrowHeight / 2} L 0 ${arrowHeight} z`}
              fill={renderedStroke}
            />
          </marker>
        </defs>
      ) : null}
      <path
        d={renderedPathD}
        fill="none"
        stroke={renderedStroke}
        strokeWidth={renderedStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={edgeKind === "cross" ? "5 6" : undefined}
        opacity={opacity}
        markerEnd={showArrowhead ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}
