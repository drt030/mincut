import type { GraphData, Node } from "./schema";

/**
 * Per ADR-0008 and the ADR-0005 amendment: supply concentration is a
 * DERIVED signal — holder count is computed from `manufactured_by` /
 * `implemented_by` edges at read time and never stored on nodes.
 *
 * "Holder" = a non-deprecated organization the node points to via a
 * non-deprecated `manufactured_by` or `implemented_by` edge. `listed`
 * counts holders that are publicly visible: `listingStatus` of
 * `public` / `subsidiary` when the field is set, falling back to the
 * ai-chain data convention of a `public_company` tag.
 */

const HOLDER_RELATIONS = new Set(["manufactured_by", "implemented_by"]);

/**
 * Initial threshold per the ADR-0005 amendment: a mature node with
 * `total` holders ≤ this value stays decomposition-eligible (the
 * "mature but concentrated" shiso-leaf habitat). Tunable; revisit when
 * real screening data shows it's too tight or too loose.
 */
export const CONCENTRATION_THRESHOLD = 3;

export type HolderSummary = {
  total: number;
  listed: number;
  organizationIds: string[];
};

export function isOrgListed(org: Node): boolean {
  if (org.listingStatus === "public" || org.listingStatus === "subsidiary") return true;
  if (org.listingStatus === "private" || org.listingStatus === "unknown") return false;
  return org.tags?.includes("public_company") ?? false;
}

export function holdersForNode(graph: GraphData, nodeId: string): HolderSummary {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const orgs = new Map<string, Node>();
  for (const edge of graph.edges) {
    if (!HOLDER_RELATIONS.has(edge.relation)) continue;
    if (edge.source !== nodeId) continue;
    if (edge.reviewStatus === "deprecated") continue;
    const target = nodeById.get(edge.target);
    if (!target || target.kind !== "organization") continue;
    if (target.reviewStatus === "deprecated") continue;
    orgs.set(target.id, target);
  }
  const organizationIds = [...orgs.keys()].sort((a, b) => a.localeCompare(b));
  const listed = [...orgs.values()].filter(isOrgListed).length;
  return { total: orgs.size, listed, organizationIds };
}

/**
 * True when the node's holder count is at or below
 * `CONCENTRATION_THRESHOLD` — including zero holders, which is either
 * a data gap or true scarcity and is surfaced as the strongest flag.
 */
export function isSupplyConcentrated(graph: GraphData, nodeId: string): boolean {
  return holdersForNode(graph, nodeId).total <= CONCENTRATION_THRESHOLD;
}
