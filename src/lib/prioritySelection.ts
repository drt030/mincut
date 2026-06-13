import {
  bandForValue,
  nodeTypicalCostRmb,
  type ColorMode,
} from "@/lib/edgeStyleFor";
import { focusedSubset } from "@/lib/focusedSubset";
import { defaultFocalProduct } from "@/lib/graphTraversal";
import { nodeRiskSignal } from "@/lib/nodeRisk";
import type { GraphData, Node } from "@/lib/schema";

export type PriorityEntry = {
  nodeId: string;
  rank: number;
  band: 1 | 2 | 3 | 4 | 5;
};

/**
 * Returns the highest-priority nodes for the current analytical lens.
 * This is a data selector for route rails and summaries; the canvas no
 * longer renders rank-number glyphs on top of nodes.
 */
export function selectTopN(
  graph: GraphData,
  mode: ColorMode,
  n: number,
  focusedSubsetIds: Set<string> | null,
): PriorityEntry[] {
  if (n <= 0) return [];
  if (mode === "relation") return [];

  const focalId = defaultFocalProduct(graph)?.id;
  const scope: Set<string> =
    focusedSubsetIds ?? (focalId ? focusedSubset(focalId, graph).nodes : new Set<string>());

  type Candidate = { node: Node; score: number; band: 1 | 2 | 3 | 4 | 5 };
  const candidates: Candidate[] = [];

  for (const node of graph.nodes) {
    if (!scope.has(node.id)) continue;
    const entry = scoreFor(node, mode, graph);
    if (entry === null) continue;
    candidates.push({ node, score: entry.score, band: entry.band });
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0;
  });

  const cap = Math.min(n, candidates.length);
  const result: PriorityEntry[] = [];
  for (let i = 0; i < cap; i += 1) {
    const c = candidates[i];
    result.push({ nodeId: c.node.id, rank: i + 1, band: c.band });
  }
  return result;
}

function scoreFor(
  node: Node,
  mode: ColorMode,
  graph: GraphData,
): { score: number; band: 1 | 2 | 3 | 4 | 5 } | null {
  switch (mode) {
    case "cost": {
      const cost = nodeTypicalCostRmb(node, graph);
      if (cost === null || cost <= 0) return null;
      return { score: cost, band: bandForValue(cost, "cost", graph) };
    }
    case "maturity": {
      if (typeof node.maturityScore !== "number") return null;
      const score = 100 - node.maturityScore;
      return { score, band: bandForValue(node.maturityScore, "maturity") };
    }
    case "bottleneck-risk": {
      const risk = nodeRiskSignal(node, graph);
      if (risk <= 0) return null;
      return { score: risk, band: bandForValue(risk, "bottleneck-risk") };
    }
    case "overall": {
      const risk = nodeRiskSignal(node, graph);
      if (risk <= 0) return null;
      return { score: risk, band: bandForValue(risk, "overall") };
    }
    case "relation":
      return null;
    default:
      return null;
  }
}
