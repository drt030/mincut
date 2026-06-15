import type { Edge, GraphData, Node } from "./schema";
import { holdersForNode } from "./supplyConcentration";

/** Decomposition relations whose source depends on the target (ADR-0005). */
const DECOMPOSITION_RELATIONS: ReadonlyArray<Edge["relation"]> = [
  "requires",
  "part_of",
  "has_route",
  "implemented_by",
];

/** Distinct nodes that directly depend on `nodeId` via a non-deprecated
 *  decomposition edge (its parents in the requires-DAG). */
export function directDependents(graph: GraphData, nodeId: string): string[] {
  const parents = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.target !== nodeId) continue;
    if (edge.reviewStatus === "deprecated") continue;
    if (!DECOMPOSITION_RELATIONS.includes(edge.relation)) continue;
    parents.add(edge.source);
  }
  return [...parents];
}

/** All nodes that transitively depend on `nodeId` (reverse decomposition
 *  reachability). Excludes the node itself. */
export function dependentAncestors(graph: GraphData, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const parent of directDependents(graph, current)) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      queue.push(parent);
    }
  }
  return seen;
}

/** Structural fan-in: how many distinct parents directly depend on the node.
 *  Most tree nodes = 1; shared (multi-parent) chokepoints = >1. */
export function criticalityRaw(graph: GraphData, nodeId: string): number {
  return directDependents(graph, nodeId).length;
}

export type AxisValue = { value: number; known: boolean };
export type CriticalityValue = AxisValue & { demandKnown: boolean };

/** Sum of `demandScale` over the dependent ancestor products. Defaults to
 *  weight 1 (and demandKnown=false) when no ancestor product sets it. */
function demandWeight(graph: GraphData, nodeId: string): { weight: number; demandKnown: boolean } {
  const ancestors = dependentAncestors(graph, nodeId);
  const scales: number[] = [];
  for (const id of ancestors) {
    const n = graph.nodes.find((node) => node.id === id);
    if (n?.kind === "product" && typeof n.demandScale === "number") scales.push(n.demandScale);
  }
  if (scales.length === 0) return { weight: 1, demandKnown: false };
  return { weight: scales.reduce((a, b) => a + b, 0), demandKnown: true };
}

/** Criticality = structural fan-in × ancestor-product demand weight. */
export function criticalityValue(graph: GraphData, nodeId: string): CriticalityValue {
  const raw = criticalityRaw(graph, nodeId);
  const { weight, demandKnown } = demandWeight(graph, nodeId);
  return { value: raw * weight, known: raw > 0, demandKnown };
}

/** Empirical-rank normalizer to [0,1] over a value distribution — the same
 *  idea as `bandForCost`'s quantile binning, generalized. Returns a function
 *  mapping a value to (count strictly below) / (n - 1). Ties share a rank. */
export function quantileNormalizer(values: number[]): (v: number) => number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return () => 0;
  if (sorted.length === 1) return () => 0.5;
  const denom = sorted.length - 1;
  return (v: number) => {
    let below = 0;
    for (const s of sorted) if (s < v) below++;
    return Math.max(0, Math.min(1, below / denom));
  };
}

/** Kinds for which holder-based concentration is meaningful (ADR-0005/0008). */
const SUPPLY_CHAIN_KINDS = new Set<Node["kind"]>([
  "product",
  "module",
  "equipment",
  "material",
  "engineering_method",
  "manufacturing_process",
]);

/** Concentration = 1 / (1 + holderCount). 0 holders ⇒ 1.0 (strongest flag,
 *  per supplyConcentration's "zero = scarcity-or-gap" convention). */
export function concentrationValue(graph: GraphData, nodeId: string): AxisValue {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || !SUPPLY_CHAIN_KINDS.has(node.kind)) return { value: 0, known: false };
  const { total } = holdersForNode(graph, nodeId);
  return { value: 1 / (1 + total), known: true };
}

/** Fallback readiness 0..100 from maturityLabel when maturityScore is absent. */
function readinessFromLabel(label: Node["maturityLabel"]): number | null {
  switch (label) {
    case "mature": return 90;
    case "widely_adopted": return 85;
    case "commercially_available": return 75;
    case "early_deployment": return 60;
    case "prototype": return 45;
    case "lab_proven": return 35;
    case "hypothesis": return 20;
    case "blocked": return 10;
    default: return null; // "unknown" / undefined → no readiness signal
  }
}

const LEAD_TIME_SOFT_CAP_MONTHS = 36;

/** Barrier = mean of the available signals, each in [0,1]:
 *  must_build (1) / procurable (0); hard_to_develop tag (1);
 *  1 - readiness; min(1, leadTime/36). Substitute count is deferred
 *  (no `substitutes` data yet). Unknown when no signal is present. */
export function barrierValue(node: Node): AxisValue {
  const signals: number[] = [];
  if (node.transactability === "must_build") signals.push(1);
  else if (node.transactability === "procurable") signals.push(0);
  if (node.tags?.includes("hard_to_develop")) signals.push(1);
  const readiness =
    typeof node.maturityScore === "number" ? node.maturityScore : readinessFromLabel(node.maturityLabel);
  if (readiness !== null) signals.push(Math.max(0, Math.min(1, 1 - readiness / 100)));
  if (typeof node.capacityLeadTimeMonths === "number") {
    signals.push(Math.min(1, node.capacityLeadTimeMonths / LEAD_TIME_SOFT_CAP_MONTHS));
  }
  if (signals.length === 0) return { value: 0, known: false };
  return { value: signals.reduce((a, b) => a + b, 0) / signals.length, known: true };
}

export type ChokepointResult = {
  score: number; // [0,1] geometric mean of normalized known axes
  /**
   * At least one axis was unknown for this node. NOTE (ADR-0010): this is a
   * COVERAGE flag, not a data-quality warning. `product` nodes are
   * STRUCTURALLY `incomplete` by design — a root product has 0 downstream
   * dependents, so its Criticality axis is unknown (criticality measures
   * "who depends on me", and nothing depends on a top-level product).
   * Consumers MUST NOT surface `incomplete` as a "weak evidence / needs
   * review" signal for products; for them it is the expected steady state.
   */
  incomplete: boolean;
  axes: { criticality: number | null; concentration: number | null; barrier: number | null };
};

/** Compute the composite for every node: per-axis raw → quantile-normalize
 *  over the known values → geometric mean over the node's known axes. An
 *  unknown axis is omitted (never coerced to 0); a node with any unknown axis
 *  is flagged `incomplete`. */
export function chokepointScores(graph: GraphData): Map<string, ChokepointResult> {
  const crit = new Map<string, AxisValue>();
  const conc = new Map<string, AxisValue>();
  const barr = new Map<string, AxisValue>();
  for (const n of graph.nodes) {
    crit.set(n.id, criticalityValue(graph, n.id));
    conc.set(n.id, concentrationValue(graph, n.id));
    barr.set(n.id, barrierValue(n));
  }

  const knownValues = (m: Map<string, AxisValue>) =>
    [...m.values()].filter((a) => a.known).map((a) => a.value);
  const critNorm = quantileNormalizer(knownValues(crit));
  const concNorm = quantileNormalizer(knownValues(conc));
  const barrNorm = quantileNormalizer(knownValues(barr));

  const out = new Map<string, ChokepointResult>();
  for (const n of graph.nodes) {
    const c = crit.get(n.id)!;
    const k = conc.get(n.id)!;
    const b = barr.get(n.id)!;
    const axes = {
      criticality: c.known ? critNorm(c.value) : null,
      concentration: k.known ? concNorm(k.value) : null,
      barrier: b.known ? barrNorm(b.value) : null,
    };
    const present = [axes.criticality, axes.concentration, axes.barrier].filter(
      (v): v is number => v !== null,
    );
    const score =
      present.length === 0
        ? 0
        : Math.pow(
            present.reduce((acc, v) => acc * Math.max(v, 1e-6), 1),
            1 / present.length,
          );
    out.set(n.id, { score, incomplete: present.length < 3, axes });
  }
  return out;
}

/**
 * Linear-interpolated quantile `p` (0..1) of an ASCENDING-sorted array — the
 * same interpolation `edgeStyleFor.ts`'s cost path uses for its Q20/40/60/80
 * thresholds (`computeCostThresholds`). Shared here (ADR-0010) so the
 * composite banding does not introduce a third copy of the formula; the
 * caller is responsible for sorting. Empty array ⇒ 0.
 */
export function quantileAt(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = p * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (idx - lo) * (sortedAsc[hi] - sortedAsc[lo]);
}

const bandCache = new WeakMap<GraphData, (nodeId: string) => 1 | 2 | 3 | 4 | 5>();

/** Band the composite by its OWN empirical quantiles (Q20/Q40/Q60/Q80), so
 *  the warmest band always holds the top chokepoints regardless of the
 *  geometric mean's compression. Cached per graph identity. */
export function chokepointBandFor(graph: GraphData): (nodeId: string) => 1 | 2 | 3 | 4 | 5 {
  const cached = bandCache.get(graph);
  if (cached) return cached;
  const scores = chokepointScores(graph);
  const sorted = [...scores.values()].map((r) => r.score).sort((a, b) => a - b);
  const t = [
    quantileAt(sorted, 0.2),
    quantileAt(sorted, 0.4),
    quantileAt(sorted, 0.6),
    quantileAt(sorted, 0.8),
  ];
  const fn = (nodeId: string): 1 | 2 | 3 | 4 | 5 => {
    const s = scores.get(nodeId)?.score ?? 0;
    if (s >= t[3]) return 5;
    if (s >= t[2]) return 4;
    if (s >= t[1]) return 3;
    if (s >= t[0]) return 2;
    return 1;
  };
  bandCache.set(graph, fn);
  return fn;
}
