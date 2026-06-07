import type { GraphData, Node } from "./schema";
import { FX_TO_RMB_2025, type FxCurrency } from "../../scripts/fx-constants";
import { outgoingEdges } from "./graphTraversal";
import { nodeRisk } from "./nodeRisk";

/**
 * Per spec docs/superpowers/specs/2026-05-10-graph-redesign.md slice 2,
 * `edgeTintFor` maps a *target* node to a CSS hex color so React Flow can
 * paint each edge by an attribute of the node it points at. The user picks
 * a mode via `ColorModeSelect` next to the existing view-mode buttons.
 *
 * The function is intentionally a pure leaf — no React, no rollup walk,
 * just direct lookups on the node + a single hop through `measured_by`
 * to read a cost-bearing metric. Returns NEUTRAL_TINT for any case
 * where the target lacks the data needed for the mode; never throws.
 */
export type ColorMode = "relation" | "cost" | "maturity" | "overall" | "bottleneck";

/** Default gray — keeps relation-class CSS in charge and signals "no data". */
export const NEUTRAL_TINT = "#94a3b8";

/**
 * Cost ramp endpoints — blue (cheap) through amber to red (expensive).
 * The 100k RMB anchor was the original parcel-sorting-domain soft cap.
 * The active graph now calibrates `industrial_robot_arm_body` above
 * that cap, but this legacy helper is kept only for older tests and
 * non-radial callers; the radial graph uses `edgeStyleFor` instead.
 */
const COST_RAMP: ReadonlyArray<readonly [number, string]> = [
  [0.0, "#3b82f6"], // blue-500
  [0.5, "#f59e0b"], // amber-500
  [1.0, "#dc2626"], // red-600
];

/**
 * Likert-coded maturity ramp. `blocked` is intentionally NOT on the
 * same scale — it's a sentinel meaning "the path is dead here", so it
 * gets its own deep-red endpoint distinct from the early-stage warmth.
 */
const MATURITY_TINT_BY_LABEL: Record<string, string> = {
  hypothesis: "#ef4444", // red-500
  lab_proven: "#f97316", // orange-500
  prototype: "#f59e0b", // amber-500
  early_deployment: "#84cc16", // lime-500
  commercially_available: "#22c55e", // green-500
  widely_adopted: "#16a34a", // green-600
  mature: "#15803d", // green-700
  blocked: "#7f1d1d", // red-900
  unknown: NEUTRAL_TINT,
};

const OVERALL_RAMP: ReadonlyArray<readonly [number, string]> = [
  [0.0, "#dc2626"],
  [0.5, "#f59e0b"],
  [1.0, "#22c55e"],
];

/** Heat ramp for bottleneck-risk (0 = safe → green, 1 = critical → red). */
const BOTTLENECK_RAMP: ReadonlyArray<readonly [number, string]> = [
  [0.0, "#22c55e"],
  [0.5, "#f59e0b"],
  [1.0, "#dc2626"],
];

/** Legacy soft cap for cost normalization, in RMB. */
const COST_RAMP_CAP_RMB = 100_000;

export function edgeTintFor(target: Node, mode: ColorMode, graph: GraphData): string {
  switch (mode) {
    case "relation":
      return NEUTRAL_TINT;
    case "cost":
      return tintFromCost(target, graph);
    case "maturity":
      return tintFromMaturityLabel(target);
    case "overall":
      return tintFromMaturityScore(target);
    case "bottleneck":
      return tintFromBottleneckRisk(target, graph);
    default:
      return NEUTRAL_TINT;
  }
}

function tintFromCost(target: Node, graph: GraphData): string {
  const typicalRmb = nodeTypicalCostRmb(target, graph);
  if (typicalRmb === null) return NEUTRAL_TINT;
  const t = Math.min(1, Math.max(0, typicalRmb / COST_RAMP_CAP_RMB));
  return interpolateRamp(COST_RAMP, t);
}

function tintFromMaturityLabel(target: Node): string {
  if (!target.maturityLabel) return NEUTRAL_TINT;
  return MATURITY_TINT_BY_LABEL[target.maturityLabel] ?? NEUTRAL_TINT;
}

function tintFromMaturityScore(target: Node): string {
  if (typeof target.maturityScore !== "number") return NEUTRAL_TINT;
  const t = Math.min(1, Math.max(0, target.maturityScore / 100));
  return interpolateRamp(OVERALL_RAMP, t);
}

function tintFromBottleneckRisk(target: Node, graph: GraphData): string {
  // Per spec §5, risk = (1 - maturity/100) × cost_share, computed in
  // `nodeRisk(node, graph)`. Returns 0 when maturity data is missing
  // — surface that as NEUTRAL_TINT (rather than the ramp's 0-endpoint
  // green) so "unknown" reads as "no signal" not "safe".
  if (typeof target.maturityScore !== "number") return NEUTRAL_TINT;
  const risk = nodeRisk(target, graph);
  return interpolateRamp(BOTTLENECK_RAMP, risk);
}

/**
 * Read a cost-bearing metric (own `metrics[0]` or first `measured_by`
 * neighbor) and return the typical RMB value. Mirrors costRollup's
 * direct-cost extraction but does not recurse — slice 2 only needs the
 * per-node tint, not a full rollup.
 */
function nodeTypicalCostRmb(node: Node, graph: GraphData): number | null {
  const own = typicalCostFromOwnMetrics(node);
  if (own !== null) return own;
  for (const edge of outgoingEdges(graph, node.id, "measured_by")) {
    const neighbor = graph.nodes.find((n) => n.id === edge.target);
    if (!neighbor) continue;
    if (neighbor.kind !== "metric") continue;
    if (neighbor.reviewStatus === "deprecated") continue;
    const value = typicalCostFromOwnMetrics(neighbor);
    if (value !== null) return value;
  }
  return null;
}

function typicalCostFromOwnMetrics(node: Node): number | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const unit = metric.unit;
  if (!unit) return null;
  const currency = inferCurrency(metric.currency, unit);
  if (!currency) return null;
  const typical = typicalFromValue(metric.currentValue);
  if (typical === null) return null;
  return typical * FX_TO_RMB_2025[currency];
}

function inferCurrency(explicit: string | undefined, unit: string): FxCurrency | null {
  if (explicit && explicit in FX_TO_RMB_2025) return explicit as FxCurrency;
  const upper = unit.toUpperCase();
  for (const code of Object.keys(FX_TO_RMB_2025) as FxCurrency[]) {
    if (upper === code || upper.startsWith(`${code}/`) || upper.startsWith(`${code} `)) {
      return code;
    }
  }
  return null;
}

function typicalFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "typical" in value &&
    typeof (value as { typical: unknown }).typical === "number"
  ) {
    return (value as { typical: number }).typical;
  }
  return null;
}

/**
 * Linear interpolation across a ramp of (stop, color) pairs. Falls back
 * to the bracketing colors as-is when `t` lands exactly on a stop.
 */
function interpolateRamp(ramp: ReadonlyArray<readonly [number, string]>, t: number): string {
  if (t <= ramp[0][0]) return ramp[0][1];
  if (t >= ramp[ramp.length - 1][0]) return ramp[ramp.length - 1][1];
  for (let i = 0; i < ramp.length - 1; i++) {
    const [lo, loColor] = ramp[i];
    const [hi, hiColor] = ramp[i + 1];
    if (t >= lo && t <= hi) {
      const local = (t - lo) / (hi - lo);
      return mixHex(loColor, hiColor, local);
    }
  }
  return ramp[0][1];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bch = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return rgbToHex(r, g, bch);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const pad = (n: number) => n.toString(16).padStart(2, "0");
  return `#${pad(r)}${pad(g)}${pad(b)}`;
}
