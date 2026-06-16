import { KNOW_HOW_KINDS } from "./canvasGraph";
import type { GraphData } from "./schema";
import { holdersForNode } from "./supplyConcentration";

/**
 * Per MASTER-PLAN Decision 10 (exposure paywall × know-how layer
 * coordination): holder/concentration NUMBERS are computed server-side
 * on the FULL graph and shipped to the client as the free teaser, while
 * organization IDENTITIES stay behind `stripExposureLayer`
 * (src/lib/exposureGate.ts). A teaser deliberately carries counts only —
 * never organization ids — so the payload leaks nothing the paywall hides.
 *
 * Callers MUST pass the pre-strip graph; computing this on a stripped
 * graph would re-introduce the bug where locked domains show
 * "0 holders" (a false scarcity flag).
 */
export type HolderTeaser = {
  total: number;
  listed: number;
};

export function computeHolderTeasers(fullGraph: GraphData): Record<string, HolderTeaser> {
  const teasers: Record<string, HolderTeaser> = {};
  for (const node of fullGraph.nodes) {
    if (node.kind === "organization") continue;
    if (node.reviewStatus === "deprecated") continue;
    const { total, listed } = holdersForNode(fullGraph, node.id);
    // Per FF-2 (Gate F): the per-node "N suppliers · M listed" teaser must
    // surface for ANY node with hidden holders — not only know-how nodes —
    // so component/material chokepoints (e.g. aerospace_titanium_mill_product,
    // humanoid_rare_earth_magnet_supply) quantify the locked exposure on the
    // RouteDetailRail. Holder organizations are stripped before the rail
    // renders, so this PRE-STRIP count is the only place the number survives.
    // We still emit every know-how node (even at 0 holders) so the existing
    // NodeDetailPanel "0 holders" scarcity flag is preserved; non-know-how
    // nodes only get an entry when they actually have ≥1 holder.
    if (total === 0 && !KNOW_HOW_KINDS.has(node.kind)) continue;
    teasers[node.id] = { total, listed };
  }
  return teasers;
}
