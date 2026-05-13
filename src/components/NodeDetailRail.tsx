"use client";

import React from "react";
import { formatMaturityLabel, maturityVisualFor } from "@/lib/maturityVisual";
import type { GraphData, Node } from "@/lib/schema";
import { NodeDetailContent } from "./NodeDetailPanel";

/**
 * Per spec
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`
 * § "Slice B4 — Detail panel rail" and ADR-0006 § "Detail panel".
 *
 * The detail panel becomes a right-edge rail with two states:
 *
 *  - **Default (collapsed)**: 64 px wide. Surfaces the focused node's
 *    name + a single critical badge (maturity ramp). Hints "more
 *    detail available" via a toggle button.
 *  - **Expanded**: 400 px wide. Shows the full panel content —
 *    description, metrics, evidence, upstream/downstream, sibling
 *    products, cost rollup — by slotting the existing
 *    `NodeDetailContent` subtree (which re-uses
 *    `DetailPrioritySummary`, `ProductCostRollupCard`,
 *    `MaturityHistoryTimeline`, `MetricNodeList`, `NodeList`,
 *    `TopBlockers`).
 *
 * The component is *presentational*: the parent owns `expanded` state
 * (so a focus change does not collapse the rail) and the keydown
 * listener for Esc. We expose `handleRailKeydown` as a pure helper so
 * the wrapper (and tests) can wire Esc without touching jsdom.
 *
 * The content area is keyed by the focused node id (both via React
 * `key` and the `data-content-key` attribute), so React unmounts the
 * old subtree on focus change — enabling the CSS opacity cross-fade
 * declared in `globals.css`.
 */

export type NodeDetailRailProps = {
  graph: GraphData;
  focusedNode: Node | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  /**
   * Optional callback for nested clicks inside the expanded content
   * (e.g. clicking a downstream node link). Forwarded to
   * `NodeDetailContent` unchanged; the parent normally sets this to
   * the same setter that drives the radial focus.
   */
  onSelectNode?: (nodeId: string) => void;
};

/**
 * Pure keydown helper. Exported so the stateful wrapper (and unit
 * tests) can wire Esc without depending on jsdom.
 *
 * Only `Escape` is meaningful for the rail — other keys (Enter,
 * Space, arrows, Tab, etc.) bubble through untouched so native focus
 * traversal continues to work inside the expanded content.
 */
export function handleRailKeydown(event: KeyboardEvent, onClose: () => void): void {
  if (event.key === "Escape") {
    onClose();
  }
}

export const NodeDetailRail: React.FC<NodeDetailRailProps> = ({
  graph,
  focusedNode,
  expanded,
  onToggleExpand,
  onSelectNode,
}) => {
  // Width contract (pinned by tests):
  //   - no focus → 64 (an empty rail can never expand to 400)
  //   - focus + not expanded → 64
  //   - focus + expanded → 400
  const widthAttr = focusedNode && expanded ? "400" : "64";
  const isExpanded = focusedNode != null && expanded;
  const contentKey = focusedNode ? focusedNode.id : "__empty__";

  return (
    <aside
      className={["node-detail-rail", isExpanded ? "expanded" : "collapsed"].join(" ")}
      data-testid="node-detail-rail"
      data-rail-width={widthAttr}
      style={{ width: `${widthAttr}px` }}
      aria-label="Detail rail"
    >
      <RailHeader
        focusedNode={focusedNode}
        expanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
      <div
        className="rail-content"
        data-content-key={contentKey}
        key={contentKey}
      >
        {focusedNode == null ? (
          <RailEmptyState />
        ) : isExpanded ? (
          <NodeDetailContent
            graph={graph}
            node={focusedNode}
            onSelectNode={onSelectNode}
          />
        ) : (
          <RailCollapsedSummary node={focusedNode} />
        )}
      </div>
    </aside>
  );
};

export default NodeDetailRail;

/**
 * Header strip — always rendered (even in the no-focus state) so the
 * toggle button remains discoverable. The button is disabled when
 * there's nothing to expand to (no focused node).
 */
function RailHeader({
  focusedNode,
  expanded,
  onToggleExpand,
}: {
  focusedNode: Node | null;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const label = expanded ? "Collapse detail rail" : "Expand detail rail";
  return (
    <div className="rail-header">
      <button
        type="button"
        className="rail-toggle"
        data-testid="node-detail-rail-toggle"
        aria-label={label}
        aria-pressed={expanded}
        title={label}
        onClick={onToggleExpand}
        disabled={focusedNode == null}
      >
        {expanded ? "›" : "‹"}
      </button>
    </div>
  );
}

function RailEmptyState() {
  // Copy is intentionally short — the test pins only the testid hook,
  // not the wording.
  return (
    <div className="rail-empty" data-testid="node-detail-rail-empty">
      <p className="muted">Click a node to view detail.</p>
    </div>
  );
}

/**
 * Collapsed (64 px) summary. Pinned by tests:
 *   - the raw node name appears somewhere in the markup
 *   - the maturity badge carries `data-maturity-band="<raw label>"`
 *
 * We deliberately render the *raw* English `node.name` (not the
 * localised override) — the test asserts on that exact string. The
 * `useLanguage` provider falls back to `node.name` when no override
 * is registered, so this remains consistent with the previously-rendered
 * detail panel.
 */
function RailCollapsedSummary({ node }: { node: Node }) {
  const visual = maturityVisualFor(node);
  const rawLabel = node.maturityLabel ?? "unknown";
  return (
    <div className="rail-collapsed">
      <div className="rail-collapsed-name" title={node.name}>
        {node.name}
      </div>
      <span
        className="rail-maturity-badge"
        data-maturity-band={rawLabel}
        style={{
          background: visual.bg,
          color: visual.fg,
          opacity: visual.hasLabel ? 1 : 0.65,
        }}
        title={visual.hasLabel ? visual.label : formatMaturityLabel(rawLabel)}
      >
        {visual.label}
      </span>
    </div>
  );
}

