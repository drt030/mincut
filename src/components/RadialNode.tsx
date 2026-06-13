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
 *   Band 2 (0.5 ≤ z < 1.5): larger circle + two-line label + outline.
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
 * Band-2 label rule: labels wrap to at most two lines. English wraps on
 * words; CJK labels can wrap between characters. If a label still does
 * not fit, only the second line is ellipsized.
 *
 * The band-2 outline carries selection affordance, plus — in the
 * know-how layer only — a red zero-holder risk mark supplied by
 * `GraphExplorer` (ADR-0007 lists node outline among the switchable
 * analysis channels). In the product layer, analytical colour stays on
 * edges so node contours do not contradict nearby lines.
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
   * Per-node outline colour. In the product layer, carries selection
   * affordance only. In the know-how layer, `GraphExplorer` also paints
   * it red (#dc2626) for zero-holder nodes (ADR-0007: node outline
   * among switchable analysis channels). Falls back to grey when
   * undefined.
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
  /** Per ADR-0008: "diamond" renders know-how nodes in the know-how layer. */
  shape?: "circle" | "diamond";
  /**
   * Count of hidden know-how dependencies carrying `bottleneckOf`.
   * > 0 renders a red-ring count badge (bands 2 and 3) so the product
   * layer keeps answering "where is the biggest bottleneck".
   */
  knowHowBottleneckCount?: number;
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

const MAX_BAND2_LINE_UNITS = 18;
const BAND2_LABEL_FONT_SIZE = 12;
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
const BAND2_CIRCLE_Y = BAND2_OFFSET_Y + 19;

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/u;
const LATIN_WORD_RE = /^[A-Za-z0-9][A-Za-z0-9+.#-]*$/u;
const JOIN_WITHOUT_SPACE_BEFORE = new Set([
  "/",
  "\\",
  "·",
  "-",
  "–",
  "—",
  ")",
  "]",
  "}",
  "）",
  "】",
  "》",
  ",",
  ".",
  ":",
  ";",
  "，",
  "。",
  "：",
  "；",
  "、",
]);
const JOIN_WITHOUT_SPACE_AFTER = new Set([
  "/",
  "\\",
  "·",
  "-",
  "–",
  "—",
  "(",
  "[",
  "{",
  "（",
  "【",
  "《",
  "、",
]);
const JOIN_WITH_SPACE_AFTER = new Set([",", ".", ":", ";"]);
const ENGLISH_LINE_END_ORPHANS = new Set([
  "and",
  "or",
  "of",
  "for",
  "to",
  "with",
  "in",
  "on",
  "by",
]);

function tokenWeight(token: string): number {
  let weight = 0;
  for (const char of token) {
    if (CJK_RE.test(char)) weight += 2;
    else if (char === " ") weight += 0.5;
    else if (/[A-Z0-9]/.test(char)) weight += 1.05;
    else if (/[/\\·.,:;()[\]{}+\-–—#]/.test(char)) weight += 0.55;
    else weight += 0.95;
  }
  return weight;
}

function lineWeight(line: string): number {
  return tokenWeight(line);
}

function tokenizeLabel(name: string): string[] {
  const normalized = compactCanvasLabel(name)
    .replace(/\s*([/\\·])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.match(/[\u3400-\u9fff\uf900-\ufaff]|[A-Za-z0-9][A-Za-z0-9+.#-]*|[^\sA-Za-z0-9\u3400-\u9fff\uf900-\ufaff]/gu) ?? [];
}

function compactCanvasLabel(name: string): string {
  return name
    .replace(/\bSpaceX orbital data center system\b/gi, "SpaceX orbital DC")
    .replace(/\bSpaceX reusable launch stack\b/gi, "SpaceX reusable launch")
    .replace(/\bHumanoid robot key component stack\b/gi, "Humanoid component stack")
    .replace(/\bBattery,\s*power,?\s*(and|\+)\s*charging system\b/gi, "Battery + power")
    .replace(/\bDexterous hand\s*(and|\+)\s*tactile(?: system)?\b/gi, "Hand + tactile")
    .replace(/\bPerception\s*(and|\+)\s*sensing stack\b/gi, "Perception stack")
    .replace(/\bStructure,\s*materials,?\s*(and|\+)\s*harness\b/gi, "Structure + harness")
    .replace(/\bManufacturing,\s*test,\s*safety,?\s*(and|\+)\s*service\b/gi, "Mfg/test/service")
    .replace(/\bThermal management(?: system)?\b/gi, "Thermal mgmt")
    .replace(/\bonboard compute and control electronics\b/gi, "Compute/control elec.")
    .replace(/\breal-time MCU and safety controller\b/gi, "RT MCU safety ctrl")
    .replace(/\bvision-language-action\b/gi, "VLA")
    .replace(/\bsimulation-to-real\b/gi, "Sim-to-real")
    .replace(/\bend-of-line\b/gi, "EOL")
    .replace(/\bmanagement system\b/gi, "mgmt")
    .replace(/\bcharging system\b/gi, "charging")
    .replace(/\btactile system\b/gi, "tactile")
    .replace(/\bcontrol electronics\b/gi, "control elec.")
    .replace(/\bpolicy model\b/gi, "policy")
    .replace(/\bmanufacturing\b/gi, "mfg")
    .replace(/\bmanagement\b/gi, "mgmt")
    .replace(/\bconfiguration\b/gi, "config")
    .replace(/,\s+and\s+/gi, " + ")
    .replace(/\s+and\s+/gi, " + ");
}

function shouldInsertSpace(previous: string, next: string): boolean {
  if (!previous || !next) return false;
  if (JOIN_WITHOUT_SPACE_BEFORE.has(next) || JOIN_WITHOUT_SPACE_AFTER.has(previous)) return false;
  if (previous === "+" || next === "+") return true;
  if (JOIN_WITH_SPACE_AFTER.has(previous)) return true;
  if (CJK_RE.test(previous) || CJK_RE.test(next)) return false;
  return LATIN_WORD_RE.test(previous) && LATIN_WORD_RE.test(next);
}

function joinLabelTokens(tokens: string[]): string {
  let line = "";
  let previous = "";
  for (const token of tokens) {
    if (!token) continue;
    line += shouldInsertSpace(previous, token) ? ` ${token}` : token;
    previous = token;
  }
  return line;
}

function badBreakPenalty(leftTokens: string[], rightTokens: string[]): number {
  const left = leftTokens[leftTokens.length - 1] ?? "";
  const right = rightTokens[0] ?? "";
  if (!left || !right) return 0;
  if (["(", "[", "{", "（", "【", "《"].includes(left)) return 12;
  if ([")", "]", "}", "）", "】", "》"].includes(right)) return 12;
  if (left === "+" || right === "+") return 12;
  if (JOIN_WITHOUT_SPACE_AFTER.has(left) || JOIN_WITHOUT_SPACE_BEFORE.has(right)) return 8;
  if (ENGLISH_LINE_END_ORPHANS.has(left.toLowerCase())) return 20;
  return 0;
}

function preferredBreakBonus(left: string, right: string): number {
  let bonus = 0;
  if (/^[（(【《]/u.test(right)) bonus -= 8;
  if (/^[与和及或]/u.test(right)) bonus -= 8;
  if (/^(设备|系统|模组|模块|材料|工艺|产能|制造|组装|封装)/u.test(right)) bonus -= 4;
  if (/(设备|系统|模组|模块|材料|工艺|产能)$/u.test(left)) bonus -= 2;
  return bonus;
}

function truncateLineTokens(tokens: string[]): string {
  let accepted: string[] = [];
  for (const token of tokens) {
    const candidate = [...accepted, token];
    if (lineWeight(`${joinLabelTokens(candidate)}${ELLIPSIS}`) <= MAX_BAND2_LINE_UNITS) {
      accepted = candidate;
      continue;
    }
    break;
  }

  if (accepted.length > 0) return `${joinLabelTokens(accepted)}${ELLIPSIS}`;

  let line = "";
  for (const char of joinLabelTokens(tokens)) {
    if (lineWeight(`${line}${char}${ELLIPSIS}`) > MAX_BAND2_LINE_UNITS) break;
    line += char;
  }
  return line ? `${line}${ELLIPSIS}` : ELLIPSIS;
}

function splitLabelLines(name: string): string[] {
  const tokens = tokenizeLabel(name);
  if (tokens.length === 0) return [name];
  const full = joinLabelTokens(tokens);
  if (lineWeight(full) <= MAX_BAND2_LINE_UNITS) return [full];

  let best: { lines: [string, string]; score: number } | null = null;
  for (let i = 1; i < tokens.length; i += 1) {
    const leftTokens = tokens.slice(0, i);
    const rightTokens = tokens.slice(i);
    const left = joinLabelTokens(leftTokens);
    const right = joinLabelTokens(rightTokens);
    const leftWeight = lineWeight(left);
    const rightWeight = lineWeight(right);
    if (leftWeight > MAX_BAND2_LINE_UNITS || rightWeight > MAX_BAND2_LINE_UNITS) continue;
    const score =
      Math.abs(leftWeight - rightWeight) +
      Math.max(leftWeight, rightWeight) * 0.02 +
      badBreakPenalty(leftTokens, rightTokens) +
      preferredBreakBonus(left, right);
    if (!best || score < best.score) best = { lines: [left, right], score };
  }
  if (best) return best.lines;

  const firstLineTokens: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const candidate = [...firstLineTokens, tokens[i]];
    if (lineWeight(joinLabelTokens(candidate)) > MAX_BAND2_LINE_UNITS) break;
    firstLineTokens.push(tokens[i]);
  }
  if (firstLineTokens.length === 0) {
    firstLineTokens.push(tokens[0]);
  }

  const firstLine = joinLabelTokens(firstLineTokens);
  const secondLine = truncateLineTokens(tokens.slice(firstLineTokens.length));
  return [firstLine, secondLine].filter(Boolean);
}

function KnowHowBottleneckBadge({ count, cx, cy }: { count: number; cx: number; cy: number }) {
  if (count <= 0) return null;
  return (
    <g data-knowhow-bottlenecks={count}>
      <circle cx={cx} cy={cy} r={9} fill="#fff" stroke="#dc2626" strokeWidth={2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#dc2626">
        {count}
      </text>
    </g>
  );
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
  shape = "circle",
  knowHowBottleneckCount = 0,
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
          {shape === "diamond" ? (
            <rect
              data-node-shape="diamond"
              x={BAND3_CENTER_X - r}
              y={BAND3_CENTER_Y - r}
              width={r * 2}
              height={r * 2}
              transform={`rotate(45 ${BAND3_CENTER_X} ${BAND3_CENTER_Y})`}
              fill={fill}
              opacity={opacity}
            />
          ) : (
            <circle cx={BAND3_CENTER_X} cy={BAND3_CENTER_Y} r={r} fill={fill} opacity={opacity} />
          )}
        </svg>
      </>
    );
  }

  if (band === 2) {
    // Larger circle + outline + truncated label below the marker. The
    // visible content stays 108×64, but the outer SVG reserves the
    // 136×72 detail footprint so every display mode uses the same layout
    // box.
    const labelLines = splitLabelLines(name);
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
          {shape === "diamond" ? (
            <rect
              data-node-shape="diamond"
              x={BAND2_CENTER_X - r}
              y={BAND2_CIRCLE_Y - r}
              width={r * 2}
              height={r * 2}
              transform={`rotate(45 ${BAND2_CENTER_X} ${BAND2_CIRCLE_Y})`}
              fill={fill}
              opacity={opacity}
              stroke={outline}
              strokeWidth={hasOutline ? 1.5 : 0}
            />
          ) : (
            <circle
              cx={BAND2_CENTER_X}
              cy={BAND2_CIRCLE_Y}
              r={r}
              fill={fill}
              opacity={opacity}
              stroke={outline}
              strokeWidth={hasOutline ? 1.5 : 0}
            />
          )}
          <KnowHowBottleneckBadge
            count={knowHowBottleneckCount}
            cx={BAND2_CENTER_X + r}
            cy={BAND2_CIRCLE_Y - r}
          />
          {showLabel ? (
            <text
              x={BAND2_CENTER_X}
              textAnchor="middle"
              fontSize={BAND2_LABEL_FONT_SIZE}
              fontWeight={650}
              fill="#0f172a"
            >
              {labelLines.map((line, index) => (
                <tspan
                  key={`${line}-${index}`}
                  x={BAND2_CENTER_X}
                  y={labelLines.length === 1 ? BAND2_OFFSET_Y + 57 : BAND2_OFFSET_Y + 50 + index * 13}
                >
                  {line}
                </tspan>
              ))}
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
              position: "relative",
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
                overflowWrap: "break-word",
                wordBreak: "normal",
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
            {knowHowBottleneckCount > 0 ? (
              <span
                data-knowhow-bottlenecks={knowHowBottleneckCount}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#dc2626",
                  background: "#fff",
                  border: "2px solid #dc2626",
                  borderRadius: 9,
                  padding: "0 5px",
                }}
              >
                {knowHowBottleneckCount}
              </span>
            ) : null}
          </div>
        </foreignObject>
      </svg>
    </>
  );
}
