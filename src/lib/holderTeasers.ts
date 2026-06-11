import { isKnowHowNode } from "./canvasGraph";
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
    if (!isKnowHowNode(node)) continue;
    if (node.reviewStatus === "deprecated") continue;
    const { total, listed } = holdersForNode(fullGraph, node.id);
    teasers[node.id] = { total, listed };
  }
  return teasers;
}
