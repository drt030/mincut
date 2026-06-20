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
  /**
   * True iff at least one node in the requires subtree contributed real
   * cost data. When false, `rolledUp` is the degenerate `{0,0,0}` sum and
   * MUST NOT be displayed as a real number — UI consumers should render
   * "—" / "no subsystem cost data" instead. Per iter-15 review (P0): a
   * "0 RMB" rolled-up display next to a "300,000 RMB" target reads as
   * "we summed to zero", which is the wrong message when in fact no
   * cost data has been entered yet.
   */
  anyChildContributed: boolean;
  /**
   * Per ADR-0003 amendment (2026-05-10 graph redesign): the target node's
   * own direct cost reading, in RMB, isolated from its `requires` children.
   * `null` when no direct reading was authored. Surfaced so the UI can
   * render a direct/children breakdown next to `rolledUp`.
   */
  directOnly: CostRange | null;
  /**
   * Per ADR-0003 amendment: the bottom-up sum of the target node's
   * `requires` children (each child's own rolled-up max), scaled by the
   * 15% integration overhead. `null` when no child contributed cost data.
   */
  fromChildren: CostRange | null;
  /**
   * Per ADR-0003 amendment: true when the target's direct reading is
   * authored but lower than its children-summed estimate. Drives the
   * ⚠ "录入直接成本低于子件 rollup" badge in NodeDetailPanel — almost
   * always a data-entry mistake (a parent should not be cheaper than
   * the sum of its parts).
   */
  directLowerThanChildren: boolean;
};

const INTEGRATION_OVERHEAD = 1.15;
const COMMODIFIED_LABELS = new Set(["mature", "widely_adopted"]);
const COST_CURRENCIES = new Set<MetricCurrency>(["RMB", "USD", "EUR", "JPY"]);
const SUPERSEDED_BY_CHILD_COST_ROLLUP_TAG = "superseded_by_child_cost_rollup";

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
  // Per iter-19 review (P1): the requires graph is a DAG, not a tree. Two
  // siblings can each `requires` the same shared dependency (e.g. both the
  // product and `parcel_manipulation_or_diverter` requires `industrial_robot_arm_body`).
  // Without memoization, a full sub-walk runs for every parent of a shared
  // node and that node's cost is summed once per parent. Memoizing per
  // invocation makes the cost contribute exactly once on the first walk;
  // subsequent visits short-circuit (returning the same range, but it is
  // NOT re-summed because the second parent's loop sees the cached range
  // and adds it once at its own layer — which is the standard DAG-cost
  // behaviour: each shared subsystem's cost rolls into both ancestor sums).
  // The gate cap on `coverageGap` and `costAsOfYears` also no longer
  // double-counts the same node.
  const memo = new Map<string, CostRange | null>();
  // Per ADR-0003 amendment: track each node's children-branch value
  // (children-sum × overhead, pre-max-with-direct) separately so the
  // top-level result can surface `fromChildren` for the target without
  // re-summing memos at the top (which would double-count DAG-shared
  // grandchildren — walk's internal sum is already DAG-aware via memo).
  const memoChildrenBranch = new Map<string, CostRange | null>();

  const range = walk(graph, productNodeId, visiting, coverageGap, costAsOfYears, memo, memoChildrenBranch);

  // Per ADR-0003 amendment: surface a direct/children breakdown for the
  // target node so the UI can render both values side-by-side. The walker
  // itself already returns max(direct, children × overhead) at every layer
  // (including the target), so `range` is already the honest rolled-up.
  // What we add here is just the per-branch decomposition for display.
  const targetNode = nodeById(graph, productNodeId);
  let directOnly: CostRange | null = null;
  let fromChildren: CostRange | null = null;
  if (targetNode) {
    const direct = directCostForNode(graph, targetNode);
    if (direct) {
      directOnly = rangeToRmb(direct.range, direct.currency);
    }
    fromChildren = memoChildrenBranch.get(productNodeId) ?? null;
  }

  return {
    rolledUp: range ?? { min: 0, typical: 0, max: 0 },
    coverageGap: dedupePreservingOrder(coverageGap),
    costAsOf: earliestYear(costAsOfYears),
    currency: "RMB",
    // `range` is non-null iff some node in the subtree contributed real cost
    // data. A null range means we returned the degenerate `{0,0,0}` sum and
    // the UI must surface this as "no data" rather than "0 RMB".
    anyChildContributed: range !== null,
    directOnly,
    fromChildren,
    directLowerThanChildren: Boolean(
      directOnly && fromChildren && directOnly.typical < fromChildren.typical,
    ),
  };
}

/**
 * Per iter-15 review (P0): the cost-eligibility filter is shared between the
 * gate (cost-question scoring) and the panel/product-view UIs (rolled-up
 * card denominator). The three sites used to drift — the gate excluded
 * `capability` and the target itself; the components didn't. As a result,
 * "60 of 60 subsystems lack cost data" on the panel did not match the gate
 * denominator. Hoisting the helper here keeps the cost-domain logic in one
 * place and prevents future drift.
 *
 * The set returned mirrors `walk()`'s child filter exactly: `requires`
 * children only; metric / evidence / bottleneck / placeholder_breakthrough /
 * capability nodes excluded; deprecated nodes excluded; the target product
 * itself excluded.
 */
export function eligibleCostSubsystemIds(graph: GraphData, productNodeId: string): Set<string> {
  const ids = new Set<string>();
  const queue: string[] = [productNodeId];
  const seen = new Set<string>();
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    for (const edge of graph.edges) {
      if (edge.source !== nodeId || edge.relation !== "requires") continue;
      const child = nodeById(graph, edge.target);
      if (!child) continue;
      if (isNonCostRequiresChild(child)) {
        continue;
      }
      if (child.reviewStatus === "deprecated") continue;
      if (child.id === productNodeId) continue;
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
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
 *
 * `memo` makes the walker DAG-aware: a node already walked once in this
 * invocation contributes to the first parent's sum but to no subsequent
 * parent. The first walk caches the computed range (or null); subsequent
 * visits return null so the shared subsystem's cost rolls up exactly once
 * regardless of how many parents reach it. `visiting` (path set) still
 * detects true cycles. Per iter-19 review (P1).
 */
function walk(
  graph: GraphData,
  nodeId: string,
  visiting: Set<string>,
  coverageGap: string[],
  costAsOfYears: string[],
  memo: Map<string, CostRange | null>,
  memoChildrenBranch: Map<string, CostRange | null>,
): CostRange | null {
  if (visiting.has(nodeId)) {
    const cycle = [...visiting, nodeId].join(" -> ");
    throw new Error(`rollupCost: circular requires cycle detected: ${cycle}`);
  }
  // Memo hit: already walked once in this invocation. The first parent
  // received this node's contribution (range or coverageGap entry); the
  // second parent must not double-count, so we return null here. The
  // node's coverageGap status was already recorded on the first walk and
  // dedupePreservingOrder() at the top level keeps a single entry.
  if (memo.has(nodeId)) return null;
  visiting.add(nodeId);
  try {
    const node = nodeById(graph, nodeId);
    if (!node) {
      coverageGap.push(nodeId);
      memo.set(nodeId, null);
      return null;
    }

    // Per ADR-0003 amendment (2026-05-10 graph redesign): the walker no
    // longer "prefers" the direct reading over children. Both branches are
    // evaluated and the larger one wins. This restores the intuition that
    // a parent system is never cheaper than the sum of its parts. The
    // commodified-leaf rule (ADR-0005) still short-circuits before
    // children-decomposition kicks in.
    const direct = directCostForNode(graph, node);
    let directRange: CostRange | null = null;
    if (direct) {
      if (direct.costAsOf) costAsOfYears.push(direct.costAsOf);
      directRange = rangeToRmb(direct.range, direct.currency);
    }

    // Commodified leaf short-circuit: `mature` or `widely_adopted` nodes
    // stop decomposing per ADR-0005. If a direct reading is present we
    // return it; otherwise this node is a coverage gap (the upstream
    // commodity-price source hasn't been recorded yet).
    const isCommodified =
      node.maturityLabel && COMMODIFIED_LABELS.has(node.maturityLabel);
    if (isCommodified) {
      if (directRange) {
        memo.set(nodeId, directRange);
        return directRange;
      }
      coverageGap.push(node.id);
      memo.set(nodeId, null);
      return null;
    }

    // Sum `requires` children. Non-cost kinds (metric / evidence /
    // bottleneck / placeholder_breakthrough / capability / principle) are
    // skipped per ADR-0003; deprecated records per ADR-0001.
    const requiresChildren = outgoingEdges(graph, node.id, "requires")
      .map((edge) => edge.target)
      .filter((targetId) => {
        const child = nodeById(graph, targetId);
        if (!child) return false;
        if (isNonCostRequiresChild(child)) return false;
        if (child.reviewStatus === "deprecated") return false;
        return true;
      });

    let childrenRange: CostRange | null = null;
    if (requiresChildren.length > 0) {
      let summed: CostRange = { min: 0, typical: 0, max: 0 };
      let anyChildContributed = false;
      for (const childId of requiresChildren) {
        const childRange = walk(graph, childId, visiting, coverageGap, costAsOfYears, memo, memoChildrenBranch);
        if (childRange) {
          summed = addRange(summed, childRange);
          anyChildContributed = true;
        }
      }
      if (anyChildContributed) {
        childrenRange = scaleRange(summed, INTEGRATION_OVERHEAD);
      }
    }
    memoChildrenBranch.set(nodeId, childrenRange);

    // Combine: max(direct, children × overhead). If only one branch
    // produced a number, use it. If neither did, surface this node as a
    // coverage gap.
    let result: CostRange | null;
    if (directRange && childrenRange) {
      result = maxRange(directRange, childrenRange);
    } else if (directRange) {
      result = directRange;
    } else if (childrenRange) {
      result = childrenRange;
    } else {
      coverageGap.push(node.id);
      result = null;
    }

    memo.set(nodeId, result);
    return result;
  } finally {
    visiting.delete(nodeId);
  }
}

function isNonCostRequiresChild(node: Node): boolean {
  return (
    node.kind === "metric" ||
    node.kind === "evidence" ||
    node.kind === "bottleneck" ||
    node.kind === "placeholder_breakthrough" ||
    node.kind === "capability" ||
    node.kind === "scientific_principle" ||
    node.kind === "empirical_principle"
  );
}

function maxRange(a: CostRange, b: CostRange): CostRange {
  return {
    min: Math.max(a.min, b.min),
    typical: Math.max(a.typical, b.typical),
    max: Math.max(a.max, b.max),
  };
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
  const ownReading = isSupersededByChildCostRollup(node) ? null : extractCostReading(node);
  if (ownReading) return ownReading;

  const measuredByEdges = outgoingEdges(graph, node.id, "measured_by");
  for (const edge of measuredByEdges) {
    const metricNode = nodeById(graph, edge.target);
    if (!metricNode || metricNode.kind !== "metric") continue;
    if (metricNode.reviewStatus === "deprecated") continue;
    if (isSupersededByChildCostRollup(metricNode)) continue;
    const reading = extractCostReading(metricNode);
    if (reading) return reading;
  }
  return null;
}

function isSupersededByChildCostRollup(node: Node): boolean {
  return Boolean(node.tags?.includes(SUPERSEDED_BY_CHILD_COST_ROLLUP_TAG));
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
  const normalizedUnit = unit.toLowerCase();
  if (
    normalizedUnit.includes("/year") ||
    normalizedUnit.includes("per year") ||
    normalizedUnit.includes("annual")
  ) {
    return null;
  }
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
