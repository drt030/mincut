import { FX_TO_RMB_2025, type FxCurrency } from "../../scripts/fx-constants";
import { nodeById, outgoingEdges } from "./graphTraversal";
import type { GraphData, MetricCurrency, Node } from "./schema";

/**
 * Per ADR-0003 cost-rollup model: cost lives only on `metric`-kind nodes
 * attached via `measured_by`. The walker prefers a directly-known
 * subsystem price, falls back to a commodified-leaf price, and finally
 * sums the `requires` children with a 15% per-layer integration overhead.
 *
 * Range arithmetic: ranges accumulate elementwise (`min+min`,
 * `typical+typical`, `max+max`) and the 15% overhead multiplies each
 * endpoint. Scalar legacy values are promoted to a degenerate range
 * `{min: v, typical: v, max: v}` at read time. FX conversion happens at
 * each leaf (so summed values are already RMB). Original-currency values
 * stay on the metric node for traceability.
 */

export type CostRange = { min: number; typical: number; max: number };

export type CostRollupResult = {
  /** Rolled-up product cost, in RMB. */
  rolledUp: CostRange;
  /**
   * Node ids in the `requires` subtree that contributed nothing to the
   * rollup because no cost data was reachable from them. These count as
   * data gaps in gate scoring.
   */
  coverageGap: string[];
  /**
   * Earliest `costAsOf` year encountered while walking. Used as a freshness
   * proxy for the rolled-up estimate. Empty string if no cost data was found
   * at all.
   */
  costAsOf: string;
  /** Always RMB after FX conversion. */
  currency: "RMB";
};

const INTEGRATION_OVERHEAD = 1.15;
const COMMODIFIED_LABELS = new Set(["mature", "widely_adopted"]);
const COST_CURRENCIES = new Set<MetricCurrency>(["RMB", "USD", "EUR", "JPY"]);

type CurrentCostExtraction = {
  range: CostRange;
  currency: FxCurrency;
  costAsOf?: string;
};

export function rollupCost(graph: GraphData, productNodeId: string): CostRollupResult {
  const root = nodeById(graph, productNodeId);
  if (!root) {
    throw new Error(`rollupCost: target node not found: ${productNodeId}`);
  }
  const visiting = new Set<string>();
  const coverageGap: string[] = [];
  const costAsOfYears: string[] = [];

  const range = walk(graph, productNodeId, visiting, coverageGap, costAsOfYears);

  return {
    rolledUp: range ?? { min: 0, typical: 0, max: 0 },
    coverageGap: dedupePreservingOrder(coverageGap),
    costAsOf: earliestYear(costAsOfYears),
    currency: "RMB",
  };
}

function dedupePreservingOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/**
 * Returns the rolled-up RMB range for the subtree rooted at `nodeId`, or
 * `null` if no cost data was reachable. `coverageGap` accumulates ids whose
 * subtree contributed nothing.
 */
function walk(
  graph: GraphData,
  nodeId: string,
  visiting: Set<string>,
  coverageGap: string[],
  costAsOfYears: string[],
): CostRange | null {
  if (visiting.has(nodeId)) {
    const cycle = [...visiting, nodeId].join(" -> ");
    throw new Error(`rollupCost: circular requires cycle detected: ${cycle}`);
  }
  visiting.add(nodeId);
  try {
    const node = nodeById(graph, nodeId);
    if (!node) {
      coverageGap.push(nodeId);
      return null;
    }

    // Priority 1: direct subsystem price — node has its own cost-bearing
    // metric (a `measured_by` edge to a `metric` node whose unit is a
    // currency). Use it and do NOT recurse.
    const direct = directCostForNode(graph, node);
    if (direct) {
      if (direct.costAsOf) costAsOfYears.push(direct.costAsOf);
      return rangeToRmb(direct.range, direct.currency);
    }

    // Priority 2: commodified leaf — `mature` or `widely_adopted`. By
    // ADR-0005 we stop decomposing here; if no cost metric was attached, the
    // node is a coverage gap.
    if (node.maturityLabel && COMMODIFIED_LABELS.has(node.maturityLabel)) {
      coverageGap.push(node.id);
      return null;
    }

    // Priority 3: bottom-up fallback — sum requires children, multiply by
    // 15% integration overhead. Children with no cost data contribute 0 but
    // are recorded in coverageGap.
    const requiresChildren = outgoingEdges(graph, node.id, "requires")
      .map((edge) => edge.target)
      .filter((targetId) => {
        const child = nodeById(graph, targetId);
        // Skip non-substantive children (metrics, evidence, etc.) — those
        // don't decompose further into cost-bearing subsystems.
        if (!child) return false;
        if (child.kind === "metric" || child.kind === "evidence") return false;
        if (child.kind === "bottleneck" || child.kind === "placeholder_breakthrough") return false;
        // Per ADR-0001, deprecated records are excluded from gate scoring,
        // including cost rollup.
        if (child.reviewStatus === "deprecated") return false;
        return true;
      });

    if (requiresChildren.length === 0) {
      // Node is itself a coverage gap: no direct cost, no children to sum.
      coverageGap.push(node.id);
      return null;
    }

    let summed: CostRange = { min: 0, typical: 0, max: 0 };
    let anyChildContributed = false;
    for (const childId of requiresChildren) {
      const childRange = walk(graph, childId, visiting, coverageGap, costAsOfYears);
      if (childRange) {
        summed = addRange(summed, childRange);
        anyChildContributed = true;
      }
      // If childRange is null, it's already in coverageGap (added by the
      // recursive call) and contributes 0 — we still apply the 15% overhead
      // to the layer below.
    }

    if (!anyChildContributed) {
      // Whole subtree had no cost data; surface this node too as a gap.
      coverageGap.push(node.id);
      return null;
    }

    return scaleRange(summed, INTEGRATION_OVERHEAD);
  } finally {
    visiting.delete(nodeId);
  }
}

/**
 * Look up a direct cost reading on the node by chasing `measured_by` edges
 * to `metric` nodes whose first metric entry has a currency unit. Returns
 * the first currency-bearing metric found.
 */
function directCostForNode(graph: GraphData, node: Node): CurrentCostExtraction | null {
  // The node may itself be a cost-bearing metric record (e.g.
  // `total_system_cost` for the v0 product target). In that case we read
  // the value off its own `metrics[0]`.
  const ownReading = extractCostReading(node);
  if (ownReading) return ownReading;

  const measuredByEdges = outgoingEdges(graph, node.id, "measured_by");
  for (const edge of measuredByEdges) {
    const metricNode = nodeById(graph, edge.target);
    if (!metricNode || metricNode.kind !== "metric") continue;
    if (metricNode.reviewStatus === "deprecated") continue;
    const reading = extractCostReading(metricNode);
    if (reading) return reading;
  }
  return null;
}

/**
 * Extract a *current* cost reading from a `metric`-kind node's
 * `metrics[0]` if `unit` is a recognized currency. Per dispatch
 * instructions and ADR-0003, only `currentValue` is rolled up in v0;
 * `targetValue` is exposed separately via `targetCostFor()` for
 * gate-side comparison. This keeps current-vs-target rollups distinct
 * — the gate compares them, the walker doesn't conflate them.
 */
function extractCostReading(node: Node): CurrentCostExtraction | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const unit = metric.unit;
  if (!unit) return null;
  const currency = inferCurrencyFromMetric(metric.currency, unit);
  if (!currency) return null;
  const range = toRange(metric.currentValue);
  if (!range) return null;
  return { range, currency, costAsOf: metric.costAsOf };
}

function inferCurrencyFromMetric(explicit: string | undefined, unit: string): FxCurrency | null {
  if (explicit && isFxCurrency(explicit)) return explicit;
  // Fall through to unit parsing — e.g. `"RMB"`, `"USD/kg"`.
  const upper = unit.toUpperCase();
  for (const code of Object.keys(FX_TO_RMB_2025) as FxCurrency[]) {
    if (upper === code || upper.startsWith(`${code}/`) || upper.startsWith(`${code} `)) {
      return code;
    }
  }
  return null;
}

function isFxCurrency(value: string): value is FxCurrency {
  return value in FX_TO_RMB_2025;
}

function toRange(value: unknown): CostRange | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { min: value, typical: value, max: value };
  }
  if (
    value &&
    typeof value === "object" &&
    "min" in value &&
    "typical" in value &&
    "max" in value &&
    typeof (value as CostRange).min === "number" &&
    typeof (value as CostRange).typical === "number" &&
    typeof (value as CostRange).max === "number"
  ) {
    return { ...(value as CostRange) };
  }
  return null;
}

function addRange(a: CostRange, b: CostRange): CostRange {
  return {
    min: a.min + b.min,
    typical: a.typical + b.typical,
    max: a.max + b.max,
  };
}

function scaleRange(r: CostRange, factor: number): CostRange {
  return {
    min: r.min * factor,
    typical: r.typical * factor,
    max: r.max * factor,
  };
}

function rangeToRmb(range: CostRange, currency: FxCurrency): CostRange {
  const rate = FX_TO_RMB_2025[currency];
  return {
    min: range.min * rate,
    typical: range.typical * rate,
    max: range.max * rate,
  };
}

function earliestYear(years: string[]): string {
  if (years.length === 0) return "";
  return years.reduce((earliest, year) => (year < earliest ? year : earliest));
}

/**
 * Helper for gate scoring — returns the target cost in RMB if the target
 * Product has a `total_system_cost` (or equivalent cost metric) reachable
 * via `measured_by` whose `targetValue` is a number or range.
 */
export function targetCostFor(graph: GraphData, productNodeId: string): { range: CostRange; currency: FxCurrency; costAsOf?: string } | null {
  const product = nodeById(graph, productNodeId);
  if (!product) return null;
  const measuredByEdges = outgoingEdges(graph, product.id, "measured_by");
  for (const edge of measuredByEdges) {
    const metricNode = nodeById(graph, edge.target);
    if (!metricNode || metricNode.kind !== "metric") continue;
    if (metricNode.reviewStatus === "deprecated") continue;
    const metric = metricNode.metrics?.[0];
    if (!metric) continue;
    const unit = metric.unit;
    if (!unit) continue;
    const currency = inferCurrencyFromMetric(metric.currency, unit);
    if (!currency) continue;
    const range = toRange(metric.targetValue);
    if (!range) continue;
    const rmbRange = rangeToRmb(range, currency);
    return { range: rmbRange, currency: "RMB" satisfies FxCurrency, costAsOf: metric.costAsOf };
  }
  return null;
}

export function isCostBearingMetric(node: Node): boolean {
  if (node.kind !== "metric") return false;
  const metric = node.metrics?.[0];
  if (!metric) return false;
  if (metric.currency && COST_CURRENCIES.has(metric.currency)) return true;
  if (!metric.unit) return false;
  return inferCurrencyFromMetric(metric.currency, metric.unit) !== null;
}
