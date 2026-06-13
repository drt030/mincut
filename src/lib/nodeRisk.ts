import type { GraphData, Node } from "./schema";
import { FX_TO_RMB_2025, type FxCurrency } from "../../scripts/fx-constants";
import { outgoingEdges } from "./graphTraversal";
import { rollupCost } from "./costRollup";

/**
 * Per spec docs/superpowers/specs/2026-05-10-graph-redesign.md §5:
 *
 *   risk(node, graph) = (1 - maturityScore/100) × cost_share
 *
 * `cost_share` is the node's typical cost divided by the largest typical
 * cost in the graph — a graph-local normalization so the result lives in
 * [0, 1]. We deliberately don't use the parcel-sorting rolled-up total
 * as denominator because (a) it changes when we expand and (b) for the
 * tint we want "where does this node sit on the cost spectrum of all
 * priced nodes in this graph", not "what fraction of the whole."
 *
 * Missing data short-circuits to 0 — "we don't know, treat as safe".
 * The tint function calls this for every visible node so a throw would
 * blow the whole canvas; cheap defaults are safer than correct fails.
 */

export function nodeRisk(node: Node, graph: GraphData): number {
  if (typeof node.maturityScore !== "number") return 0;
  const maturityFactor = Math.max(0, Math.min(1, 1 - node.maturityScore / 100));
  if (maturityFactor === 0) return 0;
  const costShare = costShareInGraph(node, graph);
  return Math.max(0, Math.min(1, maturityFactor * costShare));
}

/**
 * Reader-facing priority signal. Keep `nodeRisk` as the strict
 * maturity-by-cost formula; this helper lets authored bottleneck claims
 * surface in ranking even before cost data is available.
 */
export function nodeRiskSignal(node: Node, graph: GraphData): number {
  const computed = nodeRisk(node, graph);
  if ((node.bottleneckOf?.length ?? 0) > 0) {
    const targetsProduct = node.bottleneckOf?.some((targetId) => {
      const target = graph.nodes.find((candidate) => candidate.id === targetId);
      return target?.kind === "product";
    });
    const explicitBase = targetsProduct ? 0.9 : 0.78;
    const maturityPressure =
      typeof node.maturityScore === "number"
        ? Math.max(0, Math.min(0.09, (1 - node.maturityScore / 100) * 0.09))
        : 0.05;
    return Math.max(computed, Math.min(0.99, explicitBase + maturityPressure));
  }
  return computed;
}

function costShareInGraph(node: Node, graph: GraphData): number {
  // Per spec §5: cost_share reflects how much of the graph's cost the node
  // is responsible for. We use the node's *rolled-up* cost (max of direct
  // and children-sum × overhead, per ADR-0003 amendment) rather than its
  // raw direct reading — otherwise a node like
  // `parcel_manipulation_or_diverter` whose direct 4k hides a 89k children
  // chain would score artificially low and the bottleneck-mode heat block
  // would mislead. The walker is memoized per call, so the cost is bounded.
  const ownRolled = rolledUpTypical(node, graph);
  if (ownRolled === null || ownRolled <= 0) {
    // Fall back to the direct reading so nodes outside the requires DAG
    // (e.g. capability nodes) still get *some* signal.
    const directOnly = nodeTypicalCostRmb(node, graph);
    if (directOnly === null || directOnly <= 0) return 0;
    return Math.min(1, directOnly / maxTypicalInGraph(graph));
  }
  const max = maxTypicalInGraph(graph);
  if (max <= 0) return 0;
  return Math.min(1, ownRolled / max);
}

function rolledUpTypical(node: Node, graph: GraphData): number | null {
  try {
    const result = rollupCost(graph, node.id);
    if (!result.anyChildContributed && (result.directOnly?.typical ?? 0) === 0) return null;
    return result.rolledUp.typical;
  } catch {
    return null;
  }
}

let cachedMax: { graph: GraphData; value: number } | null = null;
function maxTypicalInGraph(graph: GraphData): number {
  if (cachedMax && cachedMax.graph === graph) return cachedMax.value;
  let max = 0;
  for (const node of graph.nodes) {
    const direct = nodeTypicalCostRmb(node, graph);
    if (direct !== null && direct > max) max = direct;
  }
  cachedMax = { graph, value: max };
  return max;
}

function nodeTypicalCostRmb(node: Node, graph: GraphData): number | null {
  const own = typicalCostFromOwnMetrics(node);
  if (own !== null) return own;
  for (const edge of outgoingEdges(graph, node.id, "measured_by")) {
    const neighbor = graph.nodes.find((n) => n.id === edge.target);
    if (!neighbor || neighbor.kind !== "metric") continue;
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
