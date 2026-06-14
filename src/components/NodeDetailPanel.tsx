"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bottlenecksForNode,
  downstream,
  evidenceForNode,
  implementedNodesForOrganization,
  isDecompositionFrontier,
  metricsForNode,
  nodeById,
  outgoingEdges,
  siblingProductsForProduct,
  suppliedNodesForOrganization,
  upstream,
} from "@/lib/graphTraversal";
import { isKnowHowNode } from "@/lib/canvasGraph";
import { holdersForNode } from "@/lib/supplyConcentration";
import { listingInfoForOrg } from "@/lib/knowHowLayer";
import { formatMaturityLabel, maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import {
  eligibleCostSubsystemIds,
  isCostBearingMetric,
  rollupCost,
  targetCostFor,
  type CostRollupResult,
} from "@/lib/costRollup";
import { costDisclosureText } from "@/lib/costDisclosure";
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import { nodeRisk, nodeRiskSignal } from "@/lib/nodeRisk";
import { selectCostDriverRoute } from "@/lib/routeHighlight";
import type { Edge, Evidence, GraphData, MetricCurrency, MetricValue, Node } from "@/lib/schema";
import { EvidenceList } from "./EvidenceList";
import { useLanguage } from "./LanguageProvider";
import { NodeDetailRail, handleRailKeydown } from "./NodeDetailRail";
import { ExposureLockCta, type LockedDomainSummary, useLockedDomainForNode } from "./ExposureLockCta";
import { useHolderTeaser } from "./HolderTeaserProvider";

type Props = {
  graph: GraphData;
  /**
   * Optional focused node. When `null` (or omitted) the rail renders
   * its no-selection placeholder. Existing callers continue to pass
   * a default focal node, so backward compatibility is preserved.
   */
  node?: Node | null;
  onSelectNode?: (nodeId: string | null) => void;
};

/**
 * Default export. Slice B4 turns this into a thin stateful wrapper:
 *
 *   - owns the `expanded` boolean (so a focus change does not collapse
 *     the rail);
 *   - listens for global `Escape` keydowns and forwards them through
 *     the pure `handleRailKeydown` helper to collapse + clear focus;
 *   - renders `<NodeDetailRail/>` with the focused node, expansion
 *     state, and the toggle/close callbacks.
 *
 * The previous render body (priority strip, metrics, evidence, cost
 * rollup, …) lives on as `NodeDetailContent` below — the rail slots
 * it into the expanded state. All reusable subcomponents
 * (`DetailPrioritySummary`, `ProductCostRollupCard`,
 * `MaturityHistoryTimeline`, `MetricNodeList`, `NodeList`,
 * `TopBlockers`) remain in this file and are unchanged behaviourally.
 */
export function NodeDetailPanel({ graph, node, onSelectNode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const focusedNode: Node | null = node ?? null;

  const handleClose = useCallback(() => {
    setExpanded(false);
    onSelectNode?.(null);
  }, [onSelectNode]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      // Esc handler must not steal keypresses from editable controls
      // (text inputs, textareas, contenteditable surfaces inside the
      // expanded panel). The spec leaves this optional; we filter on
      // the safe side so global search / future Cmd+K modal don't
      // accidentally close the rail when the user is typing.
      const target = event.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      handleRailKeydown(event, handleClose);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [handleClose]);

  return (
    <NodeDetailRail
      graph={graph}
      focusedNode={focusedNode}
      expanded={expanded}
      onToggleExpand={handleToggle}
      onClose={handleClose}
      onSelectNode={(id) => onSelectNode?.(id)}
    />
  );
}

/**
 * Per Task 8: transactability and listing status chips for know-how dependencies.
 */
function TransactabilityChip({ value, t }: { value?: "procurable" | "must_build"; t: (k: string) => string }) {
  const label = value === "procurable"
    ? t("transactabilityProcurable")
    : value === "must_build"
    ? t("transactabilityMustBuild")
    : t("transactabilityUnset");
  const color = value === "procurable" ? "#15803d" : value === "must_build" ? "#b45309" : "#64748b";
  return (
    <span
      data-transactability={value ?? "unset"}
      style={{ fontSize: 11, border: `1px solid ${color}`, color, borderRadius: 4, padding: "0 4px", marginLeft: 6 }}
    >
      {label}
    </span>
  );
}

function KnowHowPrioritySummary({
  node,
  holderSummary,
  knowHowHosts,
  onSelectNode,
}: {
  node: Node;
  holderSummary: { total: number; listed: number } | null;
  knowHowHosts: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  if (!isKnowHowNode(node)) return null;
  return (
    <section className="detail-reader-knowhow" data-testid="detail-knowhow-priority">
      <div className="detail-reader-mini-heading">{t("knowHowSectionTitle")}</div>
      <div className="detail-reader-knowhow-grid">
        <div
          className={["detail-reader-knowhow-signal", node.transactability === "must_build" ? "warning" : ""]
            .filter(Boolean)
            .join(" ")}
          data-testid="detail-knowhow-transactability"
        >
          <span>{t("knowHowTransactability")}</span>
          <strong>
            <TransactabilityChip value={node.transactability} t={t} />
          </strong>
        </div>
        {holderSummary ? (
          <div
            className={["detail-reader-knowhow-signal", holderSummary.total === 0 ? "danger" : ""]
              .filter(Boolean)
              .join(" ")}
            data-testid="detail-knowhow-holder-priority"
            data-holders-total={holderSummary.total}
            data-holders-listed={holderSummary.listed}
          >
            <span>{t("knowHowHoldersLabel")}</span>
            <strong>{formatCopy(t("knowHowHoldersValue"), { n: holderSummary.total })}</strong>
            <small>
              {holderSummary.total === 0
                ? t("knowHowNoHoldersSignal")
                : formatCopy(t("knowHowListedValue"), { n: holderSummary.listed })}
            </small>
          </div>
        ) : null}
      </div>
      {knowHowHosts.length > 0 ? (
        <div className="detail-reader-knowhow-hosts" data-testid="detail-knowhow-hosted-by-priority">
          <span>{t("knowHowHostedBy")}</span>
          <div>
            {knowHowHosts.slice(0, 3).map((host) => {
              const label = nodeName(host.id, host.name);
              return onSelectNode ? (
                <button
                  className="link-button"
                  key={host.id}
                  type="button"
                  onClick={() => onSelectNode(host.id)}
                  title={label}
                >
                  {label}
                </button>
              ) : (
                <span key={host.id}>{label}</span>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const TICKER_VENUE_SUFFIXES: Array<[suffix: string, venue: string]> = [
  [".TWO", "Taipei Exchange"],
  [".SS", "Shanghai"],
  [".SZ", "Shenzhen"],
  [".HK", "Hong Kong"],
  [".TW", "Taiwan"],
  [".KS", "Korea"],
  [".KQ", "KOSDAQ"],
  [".T", "Tokyo"],
  [".SW", "SIX Swiss"],
  [".DE", "Xetra"],
  [".PA", "Euronext Paris"],
  [".MI", "Milan"],
  [".AX", "ASX"],
  [".L", "London"],
  [".OL", "Oslo"],
  [".ST", "Stockholm"],
  [".AS", "Amsterdam"],
  [".TA", "Tel Aviv"],
];

function tickerVenueFor(ticker?: string): string | null {
  if (!ticker) return null;
  const normalized = ticker.toUpperCase();
  return TICKER_VENUE_SUFFIXES.find(([suffix]) => normalized.endsWith(suffix))?.[1] ?? null;
}

function ListingChip({ org }: { org: Node }) {
  const info = listingInfoForOrg(org);
  if (info.status === "unknown" && !info.ticker) return null;
  const venue = tickerVenueFor(info.ticker);
  const label = info.ticker ? (venue ? `${info.ticker} · ${venue}` : info.ticker) : info.status;
  return (
    <span
      data-listing-status={info.status}
      data-listing-venue={venue ?? undefined}
      title={info.ticker && venue ? `${info.ticker} listing venue: ${venue}` : undefined}
      style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "0 4px", marginLeft: 6 }}
    >
      {label}
    </span>
  );
}

/**
 * Full detail content (reader priority, evidence, graph appendix, and
 * technical metadata). Slotted by `NodeDetailRail` into its expanded
 * state. Behaviour is identical to the pre-B4 `NodeDetailPanel`
 * render body — we only renamed the entry point so the rail can host
 * it.
 */
export function NodeDetailContent({ graph, node, onSelectNode }: { graph: GraphData; node: Node; onSelectNode?: (nodeId: string) => void }) {
  const { kindName, nodeName, t } = useLanguage();
  const rawLockedEntry = useLockedDomainForNode(node);
  const lockedEntry = isAiComputeNode(node) ? null : rawLockedEntry;
  const holderTeaser = useHolderTeaser(node.id);
  // Per v3 iter-14: when the user clicks a different node, the previous
  // scroll position in the panel was preserved → they could land
  // mid-Evidence section and miss the headline cost / maturity /
  // bottleneck info at the top. Scroll the panel to top whenever the
  // selected node changes.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [node.id]);
  const manufacturerLinksAll = outgoingEdges(graph, node.id, "manufactured_by")
    .map((edge) => ({ edge, organization: nodeById(graph, edge.target) }))
    .filter((link): link is OrganizationLink => link.organization?.kind === "organization");
  const manufacturerLinks = manufacturerLinksAll.filter(
    (link) => link.organization.reviewStatus !== "deprecated" && link.edge.reviewStatus !== "deprecated",
  );
  const manufacturerDeprecatedCount = manufacturerLinksAll.length - manufacturerLinks.length;
  const manufacturerCandidateIds = new Set(manufacturerLinksAll.map((link) => link.organization.id));
  const implementerLinksAll = outgoingEdges(graph, node.id, "implemented_by")
    .map((edge) => ({ edge, organization: nodeById(graph, edge.target) }))
    .filter((link): link is OrganizationLink => link.organization?.kind === "organization");
  const implementerLinks = implementerLinksAll.filter(
    (link) => link.organization.reviewStatus !== "deprecated" && link.edge.reviewStatus !== "deprecated",
  );
  const implementerDeprecatedCount = implementerLinksAll.length - implementerLinks.length;
  const implementerCandidateIds = new Set(implementerLinksAll.map((link) => link.organization.id));

  // Per Task 8: know-how dependencies (requires or implemented_by) from this node
  const knowHowDepsAll = graph.edges
    .filter((edge) =>
      edge.source === node.id &&
      (edge.relation === "requires" || edge.relation === "implemented_by") &&
      edge.reviewStatus !== "deprecated")
    .map((edge) => graph.nodes.find((n) => n.id === edge.target))
    .filter((child): child is NonNullable<typeof child> => Boolean(child))
    .filter((child) => isKnowHowNode(child) && child.reviewStatus !== "deprecated");

  // Dedupe by node id (a node can be linked via both requires and implemented_by)
  const knowHowDepsByIdMap = new Map<string, typeof knowHowDepsAll[0]>();
  for (const dep of knowHowDepsAll) {
    knowHowDepsByIdMap.set(dep.id, dep);
  }
  const knowHowDeps = Array.from(knowHowDepsByIdMap.values());

  // Per Task 8: hosting artifacts for know-how nodes (requires or implemented_by pointing to this know-how)
  const knowHowHostsAll = isKnowHowNode(node)
    ? graph.edges
        .filter((edge) =>
          edge.target === node.id &&
          (edge.relation === "requires" || edge.relation === "implemented_by") &&
      edge.reviewStatus !== "deprecated")
    .map((edge) => graph.nodes.find((n) => n.id === edge.source))
    .filter((host): host is NonNullable<typeof host> => Boolean(host))
    .filter((host) => host.kind !== "organization")
    : [];

  // Dedupe hosts by node id
  const knowHowHostsByIdMap = new Map<string, typeof knowHowHostsAll[0]>();
  for (const host of knowHowHostsAll) {
    knowHowHostsByIdMap.set(host.id, host);
  }
  const knowHowHosts = Array.from(knowHowHostsByIdMap.values());

  // Per Task 8: holder summary for know-how nodes
  const holderSummary: { total: number; listed: number } | null = isKnowHowNode(node)
    ? (holderTeaser ?? holdersForNode(graph, node.id))
    : null;
  const supplierExposureAll =
    node.kind === "organization" ? suppliedNodesForOrganization(graph, node.id).filter((child) => child.kind !== "metric") : [];
  const supplierExposure = supplierExposureAll.filter((child) => child.reviewStatus !== "deprecated");
  const supplierExposureDeprecatedCount = supplierExposureAll.length - supplierExposure.length;
  const supplierExposureIds = new Set(supplierExposureAll.map((child) => child.id));
  const implementationExposureAll =
    node.kind === "organization" ? implementedNodesForOrganization(graph, node.id).filter((child) => child.kind !== "metric") : [];
  const implementationExposure = implementationExposureAll.filter((child) => child.reviewStatus !== "deprecated");
  const implementationExposureDeprecatedCount = implementationExposureAll.length - implementationExposure.length;
  const implementationExposureIds = new Set(implementationExposureAll.map((child) => child.id));
  const up = upstream(graph, node.id).filter((child) => !supplierExposureIds.has(child.id) && !implementationExposureIds.has(child.id));
  // Per ADR-0001: exclude deprecated children from the auto-rendered child
  // lists (Downstream / Bottlenecks / Sibling). The selected node itself is
  // always shown — the user explicitly clicked through — but its child
  // lists hide deprecated entries by default and surface a count.
  const downRawAll = downstream(graph, node.id);
  const downRaw = downRawAll.filter(
    (child) => child.kind !== "metric" && !manufacturerCandidateIds.has(child.id) && !implementerCandidateIds.has(child.id),
  );
  const down = downRaw.filter((child) => child.reviewStatus !== "deprecated");
  const downDeprecatedCount = downRaw.length - down.length;
  const bottlenecksAll = bottlenecksForNode(graph, node.id).filter((child) => child.kind !== "metric");
  const bottlenecks = bottlenecksAll.filter((child) => child.reviewStatus !== "deprecated");
  const bottlenecksDeprecatedCount = bottlenecksAll.length - bottlenecks.length;
  const evidence = evidenceForNode(graph, node.id);
  const opportunityCandidates = opportunityCandidatesForNode(graph, node).filter((candidate) => candidate.reviewStatus !== "deprecated");
  const isExpansionFrontier = node.tags?.includes("decomposition_frontier") ?? false;
  // Per ADR-0005, the broader frontier judgment is: explicit `decomposition_frontier`
  // tag OR (maturityLabel ∉ {mature, widely_adopted} AND no expanded children).
  // The Frontier pill below surfaces that judgment for the learner.
  const isFrontierByJudgment = isDecompositionFrontier(graph, node);
  const isHardToDevelop = node.tags?.includes("hard_to_develop") ?? false;
  const constraintFactors = constraintFactorsForNode(node, t);
  const siblingCandidatesAll = node.kind === "product" ? siblingProductsForProduct(graph, node.id) : [];
  const siblingCandidates = siblingCandidatesAll.filter((child) => child.reviewStatus !== "deprecated");
  const siblingDeprecatedCount = siblingCandidatesAll.length - siblingCandidates.length;
  const isDeprecated = node.reviewStatus === "deprecated";
  const isDisputed = node.reviewStatus === "disputed";
  const evidenceCount = evidence.length;

  return (
    /*
     * Per iter-44 a11y audit (MAJOR): selecting a different node silently
     * rerendered this aside. role="region" + aria-live="polite" wires it
     * up as a live region so SR users hear the new node name when
     * selection changes. aria-labelledby points at the h2 below so the
     * region is announced as e.g. "{node-name}, region".
     */
    <div
      ref={panelRef}
      className="detail-list"
      role="region"
      aria-live="polite"
      aria-labelledby="detail-heading"
    >
      <div className="detail-reader-header">
        <h2 id="detail-heading">
          {nodeName(node.id, node.name)}
          {isDeprecated ? (
            <span
              className="deprecated-badge"
              title={t("deprecatedBadgeTooltip")}
              aria-label={t("deprecatedBadgeTooltip")}
            >
              {t("deprecatedBadge")}
            </span>
          ) : null}
          {isDisputed ? (
            <span
              className="disputed-badge"
              title={t("disputedBadgeTooltip")}
              aria-label={t("disputedBadgeTooltip")}
            >
              {t("disputedBadge")}
            </span>
          ) : null}
        </h2>
      </div>
      <NodeReaderPriority
        graph={graph}
        node={node}
        evidence={evidence}
        lockedEntry={lockedEntry}
        priorityAddon={(
          <KnowHowPrioritySummary
            node={node}
            holderSummary={holderSummary}
            knowHowHosts={knowHowHosts}
            onSelectNode={onSelectNode}
          />
        )}
      />
      {node.kind === "product" ? (
        <InvestorAnswerPanel
          graph={graph}
          product={node}
          opportunityCandidates={opportunityCandidates}
          onSelectNode={onSelectNode}
        />
      ) : null}
      {/*
        Keep the next drill target directly below the summary. The graph
        surface is a research workflow, so after "what is this node?" the
        next visible answer should be "what should I inspect next?"
      */}
      <NodeDetailInspectNext
        graph={graph}
        node={node}
        evidenceCount={evidenceCount}
        onSelectNode={onSelectNode}
      />
      {isDeprecated && node.notes?.trim() ? (
        <div className="deprecated-callout">
          <strong>{t("supersessionReason")}</strong>
          <p>{node.notes}</p>
        </div>
      ) : null}
      {isDisputed && node.notes?.trim() ? (
        <div className="disputed-callout">
          <strong>{t("disputeReason")}</strong>
          <p>{node.notes}</p>
        </div>
      ) : null}
      {isExpansionFrontier ? (
        <div className="frontier-callout">
          <strong>{t("expansionFrontier")}</strong>
          <p>{node.notes ?? t("expansionFrontierHint")}</p>
        </div>
      ) : null}
      <details className="panel-section panel-section-collapsible" data-testid="detail-full-evidence-list">
        <summary>
          <strong>{t("fullEvidenceList")}</strong>
        </summary>
        <EvidenceList evidence={evidence} />
      </details>
      <details className="panel-section panel-section-collapsible" data-testid="detail-technical-metadata">
        <summary>
          <strong>{t("technicalDetails")}</strong>
        </summary>
        <div className="detail-technical-metadata">
          <div className="pill-row">
            <span className="pill">{kindName(node.kind)}</span>
            {node.domain.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
            {node.kind === "organization" ? <ListingChip org={node} /> : null}
          </div>
          <p>{node.description ?? t("noDescription")}</p>
          {constraintFactors.length > 0 ? (
            <div>
              <strong>{t("constraintFactors")}</strong>
              <div className="pill-row">
                {constraintFactors.map((factor) => (
                  <span className="pill" key={factor.tag}>
                    {factor.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <strong>{t("maturity")}</strong>
            <div className="maturity-pill-row">
              {(() => {
                const visual = maturityVisualFor(node);
                const asOf = maturityAsOfVisualFor(node);
                const asOfTooltip = asOf.hasValue
                  ? t("maturityAsOfTooltip").replace("{date}", asOf.label)
                  : t("maturityAsOfMissing");
                return (
                  <>
                    <span
                      className={["maturity-pill", visual.hasLabel ? "" : "missing"].filter(Boolean).join(" ")}
                      style={{
                        background: visual.bg,
                        color: visual.fg,
                        opacity: visual.hasLabel ? 1 : 0.65,
                      }}
                      title={visual.hasLabel ? visual.label : t("maturityLabelMissing")}
                    >
                      {visual.label}
                      {typeof node.maturityScore === "number" ? (
                        <span className="maturity-pill-score">· {node.maturityScore}</span>
                      ) : null}
                    </span>
                    <span
                      className={["maturity-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
                      title={asOfTooltip}
                      aria-label={asOfTooltip}
                    >
                      <span className="maturity-asof-icon" aria-hidden="true">🕒</span>
                      {t("maturityAsOf")}: {asOf.label}
                    </span>
                    {isHardToDevelop ? (
                      <span
                        className="key-technology-pill"
                        title={t("hardToDevelopGlyphTooltip")}
                        aria-label={t("hardToDevelopGlyphTooltip")}
                      >
                        <span className="key-technology-pill-icon" aria-hidden="true">🔑</span>
                        {t("keyTechnologyPill")}
                      </span>
                    ) : null}
                    {isFrontierByJudgment ? (
                      <span
                        className="frontier-pill"
                        title={t("frontierPillTooltip")}
                        aria-label={t("frontierPillTooltip")}
                      >
                        {t("frontierPill")}
                      </span>
                    ) : null}
                  </>
                );
              })()}
              {node.confidence ? (
                <span className="muted">
                  {t("confidence")}: {node.confidence}
                </span>
              ) : null}
            </div>
            <MaturityHistoryTimeline node={node} />
          </div>
          {node.targetContext ? (
            <details className="panel-section panel-section-collapsible">
              <summary aria-label={`${t("targetContext")} (${Object.keys(node.targetContext).length})`}>
                <strong>{t("targetContext")}</strong>{" "}
                <span className="muted">({Object.keys(node.targetContext).length})</span>
              </summary>
              <ul>
                {Object.entries(node.targetContext).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {node.kind === "metric" ? <MetricValueDetailRow node={node} /> : null}
        </div>
      </details>
      <details className="panel-section panel-section-collapsible" data-testid="detail-relationship-lists">
        <summary>
          <strong>{t("relationshipLists")}</strong>
        </summary>
        <p className="muted">{t("relationshipListsHint")}</p>
        {(node.kind === "product" || node.kind === "module") ? (
          <TopBlockers graph={graph} parent={node} />
        ) : null}
        {opportunityCandidates.length > 0 ? (
          <OpportunityCandidateList graph={graph} nodes={opportunityCandidates} />
        ) : null}
        {knowHowDeps.length > 0 ? (
          <div data-testid="knowhow-section">
            <strong>{t("knowHowSectionTitle")}</strong>
            <ul>
              {knowHowDeps.map((dep) => (
                <li key={dep.id}>
                  <span>{nodeName(dep.id, dep.name)}</span>
                  <TransactabilityChip value={dep.transactability} t={t} />
                  {(dep.bottleneckOf?.length ?? 0) > 0 ? (
                    <span style={{ color: "#dc2626", marginLeft: 6 }} title="bottleneck">●</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {isKnowHowNode(node) ? (
          <div data-testid="knowhow-meta">
            <strong>{t("knowHowSectionTitle")}</strong>
            <TransactabilityChip value={node.transactability} t={t} />
            {holderSummary ? (
              <p
                data-testid="holders-summary"
                data-holders-total={holderSummary.total}
                data-holders-listed={holderSummary.listed}
                style={holderSummary.total === 0 ? { color: "#dc2626", fontWeight: "bold" } : undefined}
              >
                {holderSummary.total} {t("knowHowHoldersLabel")} · {holderSummary.listed} {t("knowHowListedLabel")}
              </p>
            ) : null}
            {knowHowHosts.length > 0 ? (
              <div data-testid="knowhow-hosted-by">
                <strong>{t("knowHowHostedBy")}</strong>
                <ul>
                  {knowHowHosts.map((host) => (
                    <li key={host.id}>
                      <span>{nodeName(host.id, host.name)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <NodeList
          title={t("downstreamBottlenecks")}
          nodes={bottlenecks}
          deprecatedHiddenCount={bottlenecksDeprecatedCount}
        />
        {manufacturerLinksAll.length > 0 ? (
          <OrganizationNodeList
            title={t("manufacturerCandidates")}
            links={manufacturerLinks}
            subtitle={t("manufacturerCandidatesHint")}
            deprecatedHiddenCount={manufacturerDeprecatedCount}
          />
        ) : null}
        {implementerLinksAll.length > 0 ? (
          <OrganizationNodeList
            title={t("serviceCandidates")}
            links={implementerLinks}
            subtitle={t("serviceCandidatesHint")}
            deprecatedHiddenCount={implementerDeprecatedCount}
          />
        ) : null}
        {node.kind === "organization" ? (
          <NodeList
            title={t("supplierExposure")}
            nodes={supplierExposure}
            subtitle={t("supplierExposureHint")}
            deprecatedHiddenCount={supplierExposureDeprecatedCount}
          />
        ) : null}
        {node.kind === "organization" ? (
          <NodeList
            title={t("implementationExposure")}
            nodes={implementationExposure}
            subtitle={t("implementationExposureHint")}
            deprecatedHiddenCount={implementationExposureDeprecatedCount}
          />
        ) : null}
        <NodeList title={t("upstream")} nodes={up} />
        <NodeList
          title={t("downstream")}
          nodes={down}
          subtitle={t("nonMetricChildrenHint")}
          deprecatedHiddenCount={downDeprecatedCount}
        />
        {node.kind === "product" ? (
          <NodeList
            title={t("siblingCandidates")}
            nodes={siblingCandidates}
            subtitle={t("siblingCandidatesHint")}
            deprecatedHiddenCount={siblingDeprecatedCount}
          />
        ) : null}
      </details>
    </div>
  );
}

type InlineMetric = NonNullable<Node["metrics"]>[number];

function InlineMetricList({ title, metrics }: { title: string; metrics: InlineMetric[] }) {
  const { t } = useLanguage();
  return (
    <div>
      <strong>{title}</strong>
      <ul className="metric-detail-list">
        {metrics.map((metric) => {
          const current = formatMetricValue(metric.currentValue as MetricValue | undefined, metric.unit, metric.currency);
          const target = formatMetricValue(metric.targetValue as MetricValue | undefined, metric.unit, metric.currency);
          const asOf = costAsOfVisualFor(metric.costAsOf);
          return (
            <li className="metric-detail-row" key={metric.name}>
              <div className="metric-detail-row-head">
                <span>{metric.name}</span>
                {metric.costAsOf ? (
                  <span
                    className={["cost-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
                    title={asOf.hasValue ? `${t("costAsOf")} ${asOf.label}` : t("costAsOfMissing")}
                    aria-label={asOf.hasValue ? `${t("costAsOf")} ${asOf.label}` : t("costAsOfMissing")}
                  >
                    {t("costAsOf")}: {asOf.label}
                  </span>
                ) : null}
                {metric.currency && metric.currency !== "RMB" ? (
                  <span
                    className="currency-pill"
                    title={t("currencyPillTooltip").replace("{currency}", metric.currency)}
                    aria-label={t("currencyPillTooltip").replace("{currency}", metric.currency)}
                  >
                    {metric.currency}
                  </span>
                ) : null}
              </div>
              <div className="metric-detail-row-values">
                {current.full !== "—" ? (
                  <span>
                    <strong>{t("current")}:</strong> {current.full}
                  </span>
                ) : null}
                {target.full !== "—" ? (
                  <span>
                    <strong>{t("target")}:</strong> {target.full}
                  </span>
                ) : null}
                {current.full === "—" && target.full === "—" ? (
                  <span className="muted">{t("metricNoValue")}</span>
                ) : null}
              </div>
              {metric.description ? <p className="metric-detail-description">{metric.description}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OpportunityCandidateList({
  graph,
  nodes,
  onSelectNode,
}: {
  graph: GraphData;
  nodes: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  return (
    <div>
      <strong>{t("startupOpportunities")}</strong>
      <p className="muted">{t("startupOpportunityHint")}</p>
      <ul className="metric-detail-list">
        {nodes.map((candidate) => {
          const factors = constraintFactorsForNode(candidate, t);
          const exposure = candidateExposureForNode(graph, candidate.id);
          const opportunityText = startupOpportunityText(candidate);
          const risk = nodeRisk(candidate, graph);
          return (
            <li className="metric-detail-row" key={candidate.id}>
              <div className="metric-detail-row-head">
                {onSelectNode ? (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => onSelectNode(candidate.id)}
                    title={nodeName(candidate.id, candidate.name)}
                  >
                    {nodeName(candidate.id, candidate.name)}
                  </button>
                ) : (
                  <span>{nodeName(candidate.id, candidate.name)}</span>
                )}
                <span
                  className="pill"
                  title={t("heatScoreTooltip")}
                  aria-label={heatScoreLabel(t, risk)}
                >
                  {heatScoreLabel(t, risk)}
                </span>
              </div>
              {factors.length > 0 ? (
                <div className="pill-row">
                  {factors.map((factor) => (
                    <span className="pill" key={factor.tag}>
                      {factor.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {exposure.length > 0 ? (
                <p className="metric-detail-description">
                  <strong>{t("candidateExposure")}:</strong>{" "}
                  {exposure
                    .map((org) => candidateExposureSummary(org, nodeName(org.id, org.name)))
                    .join("; ")}
                </p>
              ) : null}
              {opportunityText ? <p className="metric-detail-description">{opportunityText}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type InvestorAnswer = {
  topRiskNode: Node | null;
  topRiskScore: number | null;
  costGapRmb: number | null;
  costGapDirection: "over" | "under" | null;
  topCostNode: Node | null;
  topCostTypicalRmb: number | null;
  candidateExposure: Node[];
  startupOpportunities: RankedStartupOpportunity[];
  throughputConstraints: Node[];
  throughputMetric: Node | null;
};

type RankedStartupOpportunity = {
  node: Node;
  score: number;
  costTypicalRmb: number | null;
  candidateExposure: Node[];
  opportunityText: string;
};

function InvestorAnswerPanel({
  graph,
  product,
  opportunityCandidates,
  onSelectNode,
}: {
  graph: GraphData;
  product: Node;
  opportunityCandidates: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  const rawLockedEntry = useLockedDomainForNode(product);
  const lockedEntry = isAiComputeNode(product) ? null : rawLockedEntry;
  const answer = useMemo<InvestorAnswer>(
    () => investorAnswerForProduct(graph, product, opportunityCandidates),
    [graph, product, opportunityCandidates],
  );
  const hasSignal =
    answer.topRiskNode ||
    answer.costGapRmb !== null ||
    answer.topCostNode ||
    answer.candidateExposure.length > 0 ||
    answer.startupOpportunities.length > 0 ||
    answer.throughputConstraints.length > 0 ||
    lockedEntry !== null;
  if (!hasSignal) return null;
  const throughputConstraintFactors = constraintFactorSummary(answer.throughputConstraints, t);
  const throughputMetricValues = answer.throughputMetric ? metricNodeValueSummary(answer.throughputMetric) : null;
  const throughputStatus = answer.throughputMetric ? throughputStatusText(answer.throughputMetric, t) : null;
  return (
    <div className="detail-reader-product-readout" data-testid="detail-product-readout">
      <strong>{t("productBottleneckReadout")}</strong>
      <p className="muted">{t("readerNonInvestmentAdvice")}</p>
      <ul className="metric-detail-list">
        {answer.topRiskNode ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topRiskBottleneck")}</span>
              {answer.topRiskScore !== null ? (
                <span
                  className="pill"
                  title={t("heatScoreTooltip")}
                  aria-label={heatScoreLabel(t, answer.topRiskScore)}
                >
                  {heatScoreLabel(t, answer.topRiskScore)}
                </span>
              ) : null}
            </div>
            <p className="metric-detail-description">
              <NodeListLink
                node={answer.topRiskNode}
                displayName={nodeName(answer.topRiskNode.id, answer.topRiskNode.name)}
                onSelectNode={onSelectNode}
              />
            </p>
          </li>
        ) : null}
        {answer.costGapRmb !== null ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("costGap")}</span>
            </div>
            <p className="metric-detail-description">
              {formatMetricValue(answer.costGapRmb, "RMB", "RMB").full}{" "}
              {answer.costGapDirection === "under" ? t("costGapUnderTarget") : t("costGapOverTarget")}
            </p>
          </li>
        ) : null}
        {answer.throughputConstraints.length > 0 ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("throughputConstraints")}</span>
              <span className="pill">{answer.throughputConstraints.length}</span>
            </div>
            <p className="metric-detail-description">
              {answer.throughputConstraints.map((constraint, index) => (
                <React.Fragment key={constraint.id}>
                  {index > 0 ? ", " : null}
                  <NodeListLink
                    node={constraint}
                    displayName={nodeName(constraint.id, constraint.name)}
                    onSelectNode={onSelectNode}
                  />
                </React.Fragment>
              ))}
            </p>
            {throughputMetricValues ? (
              <div className="metric-detail-row-values">
                {throughputMetricValues.current ? (
                  <span>
                    <strong>{t("current")}:</strong> {throughputMetricValues.current}
                  </span>
                ) : null}
                {throughputMetricValues.target ? (
                  <span>
                    <strong>{t("target")}:</strong> {throughputMetricValues.target}
                  </span>
                ) : null}
              </div>
            ) : null}
            {throughputStatus ? (
              <p className="metric-detail-description">
                <strong>{t("throughputStatus")}:</strong> {throughputStatus}
              </p>
            ) : null}
            {throughputConstraintFactors ? (
              <p className="metric-detail-description">
                <strong>{t("constraintTypes")}:</strong> {throughputConstraintFactors}
              </p>
            ) : null}
          </li>
        ) : null}
        {answer.topCostNode ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topCostDriver")}</span>
              {answer.topCostTypicalRmb !== null ? (
                <span className="pill">{formatMetricValue(answer.topCostTypicalRmb, "RMB", "RMB").compact}</span>
              ) : null}
            </div>
            <p className="metric-detail-description">
              <NodeListLink
                node={answer.topCostNode}
                displayName={nodeName(answer.topCostNode.id, answer.topCostNode.name)}
                onSelectNode={onSelectNode}
              />
            </p>
            {answer.candidateExposure.length > 0 ? (
              <p className="metric-detail-description">
                <strong>{t("candidateExposure")}:</strong>{" "}
                {answer.candidateExposure
                  .map((org) => candidateExposureSummary(org, nodeName(org.id, org.name)))
                  .join("; ")}
              </p>
            ) : null}
          </li>
        ) : null}
        {lockedEntry ? (
          <li className="metric-detail-row">
            <ExposureLockCta entry={lockedEntry} />
          </li>
        ) : null}
        {answer.startupOpportunities.length > 0 ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topStartupOpportunities")}</span>
              <span className="pill">{answer.startupOpportunities.length}</span>
            </div>
          </li>
        ) : null}
        {answer.startupOpportunities.map((entry, index) => {
          const factors = constraintFactorsForNode(entry.node, t);
          return (
            <li className="metric-detail-row" key={entry.node.id}>
              <div className="metric-detail-row-head">
                <span>
                  #{index + 1}{" "}
                  <NodeListLink
                    node={entry.node}
                    displayName={nodeName(entry.node.id, entry.node.name)}
                    onSelectNode={onSelectNode}
                  />
                </span>
                <span className="pill">
                  {t("opportunityScore")} {Math.round(entry.score)}
                </span>
              </div>
              <div className="metric-detail-row-values">
                <span>
                  <strong>{t("risk")}:</strong> {heatScoreValue(nodeRisk(entry.node, graph))}
                </span>
                {entry.costTypicalRmb !== null ? (
                  <span>
                    <strong>{t("costSignal")}:</strong>{" "}
                    {formatMetricValue(entry.costTypicalRmb, "RMB", "RMB").compact}
                  </span>
                ) : null}
              </div>
              {factors.length > 0 ? (
                <div className="pill-row">
                  {factors.map((factor) => (
                    <span className="pill" key={factor.tag}>
                      {factor.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.candidateExposure.length > 0 ? (
                <p className="metric-detail-description">
                  <strong>{t("candidateExposure")}:</strong>{" "}
                  {entry.candidateExposure
                    .map((org) => candidateExposureSummary(org, nodeName(org.id, org.name)))
                    .join("; ")}
                </p>
              ) : null}
              {entry.opportunityText ? <p className="metric-detail-description">{entry.opportunityText}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function investorAnswerForProduct(graph: GraphData, product: Node, opportunityCandidates: Node[]): InvestorAnswer {
  const topRiskNode = topRiskNodeForProduct(graph, product.id);
  const topRiskScore = topRiskNode ? nodeRiskSignal(topRiskNode, graph) : null;
  const costGap = productCostGapRmb(graph, product.id);
  const costRoute = selectCostDriverRoute(graph, product.id, { limit: 1 });
  const topCostStep = costRoute.steps[0] ?? null;
  const topCostNode = topCostStep ? nodeById(graph, topCostStep.nodeId) : null;
  const throughputMetric = throughputMetricNodesForProduct(graph, product.id)[0] ?? null;
  return {
    topRiskNode,
    topRiskScore,
    costGapRmb: costGap ? Math.round(Math.abs(costGap)) : null,
    costGapDirection: costGap === null ? null : costGap >= 0 ? "over" : "under",
    topCostNode: topCostNode && topCostNode.reviewStatus !== "deprecated" ? topCostNode : null,
    topCostTypicalRmb: topCostStep ? topCostStep.costTypicalRmb : null,
    candidateExposure: topCostStep ? candidateExposureForNode(graph, topCostStep.nodeId) : [],
    startupOpportunities: rankedStartupOpportunitiesForProduct(graph, opportunityCandidates),
    throughputConstraints: throughputConstraintNodesForProduct(graph, product.id),
    throughputMetric,
  };
}

function rankedStartupOpportunitiesForProduct(
  graph: GraphData,
  opportunityCandidates: Node[],
  limit = 3,
): RankedStartupOpportunity[] {
  return opportunityCandidates
    .map((node) => {
      const riskScore = nodeRisk(node, graph) * 100;
      const costTypicalRmb = opportunityCostSignalRmb(graph, node.id);
      const costScore = costTypicalRmb === null ? 0 : Math.min(costTypicalRmb / 5000, 12);
      const constraintScore = constraintTagCount(node) * 4;
      const exposure = candidateExposureForNode(graph, node.id);
      const exposureScore = Math.min(exposure.length, 5);
      return {
        node,
        score: riskScore + costScore + constraintScore + exposureScore,
        costTypicalRmb,
        candidateExposure: exposure,
        opportunityText: startupOpportunityText(node),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        nodeRisk(b.node, graph) - nodeRisk(a.node, graph) ||
        a.node.name.localeCompare(b.node.name),
    )
    .slice(0, limit);
}

function opportunityCostSignalRmb(graph: GraphData, nodeId: string): number | null {
  try {
    const rollup = rollupCost(graph, nodeId);
    return rollup.anyChildContributed ? rollup.rolledUp.typical : null;
  } catch {
    return null;
  }
}

function constraintTagCount(node: Node): number {
  return (node.tags ?? []).filter((tag) => tag.startsWith("constraint_")).length;
}

const INVESTOR_RISK_NODE_KINDS = new Set<Node["kind"]>([
  "module",
  "technical_route",
  "scientific_principle",
  "empirical_principle",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

function topRiskNodeForProduct(graph: GraphData, productId: string): Node | null {
  const reachable = requiresReachableIds(graph, productId);
  let best: { node: Node; risk: number } | null = null;
  for (const node of graph.nodes) {
    if (node.id === productId || !reachable.has(node.id)) continue;
    if (node.reviewStatus === "deprecated") continue;
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind)) continue;
    const risk = nodeRiskSignal(node, graph);
    if (!best || risk > best.risk || (risk === best.risk && node.name.localeCompare(best.node.name) < 0)) {
      best = { node, risk };
    }
  }
  return best?.node ?? null;
}

function productCostGapRmb(graph: GraphData, productId: string): number | null {
  const target = targetCostFor(graph, productId);
  if (!target) return null;
  try {
    const rollup = rollupCost(graph, productId);
    if (!rollup.anyChildContributed) return null;
    return rollup.rolledUp.typical - target.range.typical;
  } catch {
    return null;
  }
}

function throughputConstraintNodesForProduct(graph: GraphData, productId: string): Node[] {
  const throughputMetricIds = new Set(throughputMetricNodesForProduct(graph, productId).map((node) => node.id));
  if (throughputMetricIds.size === 0) return [];

  const candidates = new Map<string, Node>();
  for (const edge of graph.edges) {
    if (edge.relation !== "depends_on_metric") continue;
    if (!throughputMetricIds.has(edge.target)) continue;
    const node = nodeById(graph, edge.source);
    if (!node || node.reviewStatus === "deprecated") continue;
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind)) continue;
    candidates.set(node.id, node);
  }

  return [...candidates.values()]
    .sort((a, b) => {
      const riskDelta = nodeRiskSignal(b, graph) - nodeRiskSignal(a, graph);
      if (riskDelta !== 0) return riskDelta;
      const maturityDelta = (a.maturityScore ?? 101) - (b.maturityScore ?? 101);
      if (maturityDelta !== 0) return maturityDelta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);
}

function throughputMetricNodesForProduct(graph: GraphData, productId: string): Node[] {
  return graph.edges
    .filter((edge) => edge.relation === "measured_by" && edge.source === productId)
    .map((edge) => nodeById(graph, edge.target))
    .filter((node): node is Node => Boolean(node && node.kind === "metric" && node.reviewStatus !== "deprecated"))
    .filter((node) => node.id === "parcels_per_hour" || (node.tags ?? []).includes("throughput"));
}

function metricNodeValueSummary(node: Node): { current: string | null; target: string | null } | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const current = formatMetricValue(metric.currentValue as MetricValue | undefined, metric.unit, metric.currency).full;
  const target = formatMetricValue(metric.targetValue as MetricValue | undefined, metric.unit, metric.currency).full;
  if (!current && !target) return null;
  return {
    current: current || null,
    target: target || null,
  };
}

function throughputStatusText(node: Node, t: (key: string) => string): string | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const currentTypical = metricTypicalNumber(metric.currentValue);
  const targetTypical = metricTypicalNumber(metric.targetValue);
  if (currentTypical === null || targetTypical === null) return t("throughputSensitivityUnknown");
  return currentTypical >= targetTypical
    ? t("throughputSensitivityAtTarget")
    : t("throughputSensitivityBelowTarget");
}

function metricTypicalNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const typical = (value as { typical?: unknown }).typical;
  return typeof typical === "number" ? typical : null;
}

function constraintFactorSummary(nodes: Node[], t: (key: string) => string): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const node of nodes) {
    for (const factor of constraintFactorsForNode(node, t)) {
      if (seen.has(factor.tag)) continue;
      seen.add(factor.tag);
      labels.push(factor.label);
    }
  }
  return labels.join(" · ");
}

function startupOpportunityText(node: Node): string {
  const notes = node.notes ?? "";
  const marker = "Startup opportunity:";
  const index = notes.indexOf(marker);
  if (index === -1) return "";
  return notes.slice(index).trim();
}

function heatScoreValue(score: number): string {
  return `${Math.round(score * 100)}/100`;
}

function heatScoreLabel(t: (key: string) => string, score: number): string {
  return `${t("risk")} ${heatScoreValue(score)}`;
}

function firstSentenceDescription(text: string | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^.*?[.!?。！？](?:\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

function formatCopy(template: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function compactReaderClause(text: string, maxChars = 170): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;

  const hardCut = compact.slice(0, Math.max(0, maxChars - 3)).trimEnd();
  const softCut = Math.max(hardCut.lastIndexOf(";"), hardCut.lastIndexOf(","));
  if (softCut >= Math.floor(maxChars * 0.55)) {
    return `${hardCut.slice(0, softCut).trimEnd()}...`;
  }
  const wordCut = hardCut.lastIndexOf(" ");
  if (wordCut >= Math.floor(maxChars * 0.55)) {
    return `${hardCut.slice(0, wordCut).trimEnd()}...`;
  }
  return `${hardCut}...`;
}

function sentenceClause(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || /[.!?。！？…]$/u.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function isAiComputeNode(node: Pick<Node, "domain"> | null | undefined): boolean {
  return Boolean(node?.domain?.includes("ai_compute_chain"));
}

function isParcelRobotNode(node: Pick<Node, "id" | "domain"> | null | undefined): boolean {
  return Boolean(
    node?.id === "low_cost_parcel_sorting_robot_300k_rmb" ||
    node?.domain?.includes("parcel_sorting_robot"),
  );
}

function detailImportanceText(node: Node, t: (key: string) => string): string {
  if (isAiComputeNode(node)) return t("readerAiComputeImportance");
  if (isParcelRobotNode(node)) return t("readerParcelRobotImportance");
  if (node.kind === "product") return t("readerProductImportance");
  return t("readerDefaultImportance");
}

function readerEvidenceStatusText(evidence: Evidence[], t: (key: string) => string): string {
  if (evidence.length === 0) return t("noDirectEvidence");
  return formatCopy(t("readerEvidenceStatusCount"), {
    total: evidence.length,
  });
}

function readerBottleneckRoleText(
  graph: GraphData,
  node: Node,
  nodeName: (id: string, fallback: string) => string,
  t: (key: string) => string,
): string {
  const parents = (node.bottleneckOf ?? [])
    .map((parentId) => nodeById(graph, parentId))
    .filter((parent): parent is Node => Boolean(parent && parent.reviewStatus !== "deprecated"));
  if (parents.length === 0) return t("readerNoBottleneckMarker");
  const visible = parents.slice(0, 2).map((parent) => nodeName(parent.id, parent.name));
  const suffix = parents.length > visible.length ? ` +${parents.length - visible.length}` : "";
  return formatCopy(t("readerBottleneckFor"), { targets: `${visible.join(", ")}${suffix}` });
}

function detailBottleneckThesisText(
  graph: GraphData,
  node: Node,
  nodeName: (id: string, fallback: string) => string,
  t: (key: string) => string,
  evidence: Evidence[],
): string {
  const where = sentenceClause(compactReaderClause(firstSentenceDescription(node.description) ?? t("noDescription")));
  const parents = (node.bottleneckOf ?? [])
    .map((parentId) => nodeById(graph, parentId))
    .filter((parent): parent is Node => Boolean(parent && parent.reviewStatus !== "deprecated"));
  const targetNames = parents.slice(0, 2).map((parent) => nodeName(parent.id, parent.name));
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  const why = targetNames.length > 0
    ? formatCopy(t("readerThesisMarkedBottleneck"), { targets: targetNames.join(", ") })
    : factors.length > 0
      ? formatCopy(t("readerThesisConstraintFactors"), { factors: factors.slice(0, 2).join(" · ") })
      : evidence.length === 0
        ? t("readerThesisThinEvidence")
        : t("readerThesisCandidateConstraint");
  const impact = targetNames.length > 0 ? targetNames.join(", ") : t("readerSelectedRouteImpact");
  return formatCopy(t("readerDetailBottleneckThesisSentence"), {
    importance: detailImportanceText(node, t),
    where,
    why,
    impact,
  });
}

function detailWhereStuckFactors(graph: GraphData, node: Node, t: (key: string) => string): string[] {
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  const cost = detailCostSignalText(graph, node) ?? costDisclosureText(node, t);
  if (cost) factors.push(cost);
  if (factors.length === 0) factors.push(t("readerThesisCandidateConstraint"));
  return factors.slice(0, 4);
}

function constraintSummaryText(node: Node, t: (key: string) => string): string {
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  return factors.length > 0 ? factors.join(" · ") : t("readerConstraintUnclassified");
}

function reliefTimingText(node: Node, t: (key: string) => string): string {
  const months = node.capacityLeadTimeMonths;
  if (typeof months === "number") {
    if (months <= 3) return formatCopy(t("readerReliefTimingShort"), { months });
    if (months <= 12) return formatCopy(t("readerReliefTimingMedium"), { months });
    const reason = reliefTimingReasonText(node, t);
    if (reason !== t("readerReliefTimingUnknown")) {
      return formatCopy(t("readerReliefTimingLongWithReason"), { months, reason });
    }
    return formatCopy(t("readerReliefTimingLong"), { months });
  }
  return reliefTimingReasonText(node, t);
}

function reliefTimingReasonText(node: Node, t: (key: string) => string): string {
  const tags = new Set(node.tags ?? []);
  if (tags.has("constraint_economic_validation")) return t("readerReliefTimingEconomics");
  if (tags.has("constraint_material_supply_chain")) return t("readerReliefTimingMaterial");
  if (tags.has("constraint_component_availability")) return t("readerReliefTimingComponent");
  if (tags.has("constraint_regulatory_approval")) return t("readerReliefTimingRegulatory");
  if (tags.has("constraint_capacity_scale")) {
    return t("readerReliefTimingLikelyLong");
  }
  if (tags.has("constraint_integration_commissioning") || tags.has("constraint_technical_maturity")) {
    return t("readerReliefTimingExecution");
  }
  return t("readerReliefTimingUnknown");
}

function detailCostSignalText(graph: GraphData, node: Node): string | null {
  if (!canSurfaceCostAnswer(node)) return null;
  try {
    const rollup = rollupCost(graph, node.id);
    if (!rollup.anyChildContributed && !rollup.directOnly) return null;
    return formatMetricValue(rollup.rolledUp, "RMB", "RMB").compact;
  } catch {
    return null;
  }
}

function DecisionBrief({
  graph,
  node,
  evidence,
  lockedEntry,
}: {
  graph: GraphData;
  node: Node;
  evidence: Evidence[];
  lockedEntry: LockedDomainSummary | null;
}) {
  const { t } = useLanguage();
  const cost =
    detailCostSignalText(graph, node) ??
    costDisclosureText(node, t, { includeReason: true }) ??
    t("readerCostNotModeled");
  const costIsLong = cost.length > 54;
  return (
    <div className="detail-decision-brief" data-testid="detail-decision-brief">
      <strong>{t("readerDecisionBrief")}</strong>
      <div className="detail-decision-grid">
        <div className={costIsLong ? "wide" : undefined}>
          <span>{t("readerCostMagnitude")}</span>
          <strong>{cost}</strong>
        </div>
        <div>
          <span>{t("readerSupplyConstraint")}</span>
          <strong>{constraintSummaryText(node, t)}</strong>
        </div>
        <div>
          <span>{t("readerReliefTiming")}</span>
          <strong>{reliefTimingText(node, t)}</strong>
        </div>
        <div>
          <span>{t("readerSourceTrail")}</span>
          <strong>{readerEvidenceStatusText(evidence, t)}</strong>
        </div>
        {lockedEntry ? (
          <div>
            <span>{t("readerSupplierTickerExposure")}</span>
            <strong>{formatCopy(t("readerSupplierTickerGated"), { n: lockedEntry.hiddenOrgCount })}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NodeReaderPriority({
  graph,
  node,
  evidence,
  lockedEntry,
  priorityAddon,
}: {
  graph: GraphData;
  node: Node;
  evidence: Evidence[];
  lockedEntry: LockedDomainSummary | null;
  priorityAddon?: React.ReactNode;
}) {
  const { nodeName, t } = useLanguage();
  const riskScore = nodeRiskSignal(node, graph);
  const riskLabel = isKnowHowNode(node) && riskScore === 0
    ? t("readerHeatUnscored")
    : heatScoreLabel(t, riskScore);
  const quickPath = evidenceQuickPathForNode(graph, node, evidence, t);
  return (
    <section className="detail-reader-priority" data-testid="detail-reader-priority">
      <DecisionBrief graph={graph} node={node} evidence={evidence} lockedEntry={lockedEntry} />
      <div className="detail-reader-role" data-testid="detail-bottleneck-thesis">
        <span>{t("readerBottleneckThesis")}</span>
        <p>{detailBottleneckThesisText(graph, node, nodeName, t, evidence)}</p>
      </div>
      <div className="detail-reader-role" data-testid="detail-where-stuck">
        <span>{t("readerWhereStuck")}</span>
        <div className="pill-row">
          {detailWhereStuckFactors(graph, node, t).map((factor) => (
            <span className="pill" key={factor}>{factor}</span>
          ))}
        </div>
      </div>
      <div className="detail-reader-role" data-testid="detail-evidence-summary">
        <span>{t("readerKeyEvidenceSummary")}</span>
        <p>{quickPath.text}</p>
      </div>
      {priorityAddon}
      <ExposureEvidenceSummary
        graph={graph}
        node={node}
        evidence={evidence}
        lockedEntry={lockedEntry}
      />
      <details
        className="detail-reader-secondary-details detail-reader-signal-details"
        data-testid="detail-reader-secondary-signals"
      >
        <summary>{t("readerSecondarySignals")}</summary>
        <div className="detail-reader-signal-grid">
          <div className="detail-reader-signal">
            <span>{t("risk")}</span>
            <strong>{riskLabel}</strong>
            <small>{t("readerHeatExplanation")}</small>
          </div>
          <div className="detail-reader-signal">
            <span>{t("readerBottleneckRole")}</span>
            <strong>{readerBottleneckRoleText(graph, node, nodeName, t)}</strong>
          </div>
          <div className="detail-reader-signal">
            <span>{t("readerSourceTrail")}</span>
            <strong>{readerEvidenceStatusText(evidence, t)}</strong>
          </div>
        </div>
        {lockedEntry ? (
          <div className="detail-reader-access locked" data-testid="detail-reader-exposure">
            <strong>{t("readerExposureLayerLocked")}</strong>
            <span>{formatCopy(t("readerExposureLayerLockedBody"), { n: lockedEntry.hiddenOrgCount })}</span>
          </div>
        ) : null}
      </details>
    </section>
  );
}

const EXPOSURE_ORG_RELATIONS = ["manufactured_by", "implemented_by"] as const;
const EXPOSURE_ONE_HOP_RELATIONS = ["requires", "part_of", "has_route", "implemented_by"] as const;

type ExposureOrgRelation = (typeof EXPOSURE_ORG_RELATIONS)[number];

type ExposureCandidate = {
  organization: Node;
  edge: Edge | null;
  relation: ExposureOrgRelation | "organization";
  viaNode: Node | null;
  depth: 0 | 1;
  sourceRank: number;
};

type EvidenceQuickPath = {
  text: string;
  viaNode: Node | null;
};

function ExposureEvidenceSummary({
  graph,
  node,
  evidence,
  lockedEntry,
}: {
  graph: GraphData;
  node: Node;
  evidence: Evidence[];
  lockedEntry: LockedDomainSummary | null;
}) {
  const { nodeName, relationName, t } = useLanguage();
  const candidates = lockedEntry ? [] : exposureCandidatesForNode(graph, node, 3);
  const quickPath = evidenceQuickPathForNode(graph, node, evidence, t);
  return (
    <div className="detail-reader-exposure-evidence" data-testid="detail-exposure-evidence-summary">
      <details className="detail-reader-secondary-details detail-reader-exposure-details">
        <summary>
          <strong>{t("exposureEvidenceSummaryTitle")}</strong>{" "}
          <span className="muted">
            {candidates.length > 0
              ? formatCopy(t("exposureCandidateCount"), { n: String(candidates.length) })
              : t("exposureCandidateHeading")}
          </span>
        </summary>
        <div className="detail-reader-exposure-grid">
          <div>
            <span className="detail-reader-mini-heading">{t("exposureCandidateHeading")}</span>
            <p className="muted">{t("exposureCandidateHint")}</p>
            {candidates.length > 0 ? (
              <ul className="metric-detail-list">
                {candidates.map((candidate) => {
                  const displayName = nodeName(candidate.organization.id, candidate.organization.name);
                  const candidateSummary = organizationMetricSummary(candidate.organization, {
                    includeDescriptions: false,
                    limit: 2,
                  });
                  const via = candidate.viaNode
                    ? formatCopy(t("exposureCandidateVia"), {
                        node: nodeName(candidate.viaNode.id, candidate.viaNode.name),
                      })
                    : relationName(candidate.relation);
                  return (
                    <li className="metric-detail-row" key={`${candidate.organization.id}-${candidate.edge?.id ?? "self"}`}>
                      <div className="metric-detail-row-head">
                        <span>{displayName}</span>
                        <ListingChip org={candidate.organization} />
                      </div>
                      <p className="metric-detail-description">
                        {via}
                      </p>
                      {candidateSummary ? (
                        <p className="metric-detail-description muted">{candidateSummary}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : lockedEntry ? (
              <p className="muted">
                {formatCopy(t("exposureCandidateLockedFallback"), { n: lockedEntry.hiddenOrgCount })}
              </p>
            ) : (
              <p className="muted">{t("exposureCandidateFallback")}</p>
            )}
          </div>
          <div>
            <span className="detail-reader-mini-heading">{t("evidenceQuickPathHeading")}</span>
            <p>
              {quickPath.text}
              {quickPath.viaNode ? (
                <span className="muted">
                  {" "}
                  {formatCopy(t("evidenceNearestVia"), {
                    node: nodeName(quickPath.viaNode.id, quickPath.viaNode.name),
                  })}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

function exposureCandidatesForNode(graph: GraphData, node: Node, limit: number): ExposureCandidate[] {
  const candidates: ExposureCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: ExposureCandidate) => {
    if (candidate.organization.reviewStatus === "deprecated") return;
    if (seen.has(candidate.organization.id)) return;
    seen.add(candidate.organization.id);
    candidates.push(candidate);
  };

  if (node.kind === "organization") {
    addCandidate({
      organization: node,
      edge: null,
      relation: "organization",
      viaNode: null,
      depth: 0,
      sourceRank: 0,
    });
  }

  for (const edge of organizationEdgesFromSource(graph, node.id)) {
    const organization = nodeById(graph, edge.target);
    if (!organization || organization.kind !== "organization") continue;
    addCandidate({
      organization,
      edge,
      relation: edge.relation as ExposureOrgRelation,
      viaNode: null,
      depth: 0,
      sourceRank: 0,
    });
  }

  const oneHopSources = oneHopExposureSources(graph, node);
  for (const { child, rank } of oneHopSources) {
    for (const edge of organizationEdgesFromSource(graph, child.id)) {
      const organization = nodeById(graph, edge.target);
      if (!organization || organization.kind !== "organization") continue;
      addCandidate({
        organization,
        edge,
        relation: edge.relation as ExposureOrgRelation,
        viaNode: child,
        depth: 1,
        sourceRank: rank,
      });
    }
  }

  return candidates
    .sort((a, b) => exposureCandidateRank(graph, node, a) - exposureCandidateRank(graph, node, b))
    .slice(0, limit);
}

function organizationEdgesFromSource(graph: GraphData, sourceId: string): Edge[] {
  return graph.edges.filter((edge) => {
    if (edge.source !== sourceId) return false;
    if (edge.reviewStatus === "deprecated") return false;
    if (!EXPOSURE_ORG_RELATIONS.includes(edge.relation as ExposureOrgRelation)) return false;
    return nodeById(graph, edge.target)?.kind === "organization";
  });
}

function oneHopExposureSources(graph: GraphData, node: Node): Array<{ child: Node; rank: number }> {
  return graph.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.source === node.id && edge.reviewStatus !== "deprecated")
    .filter(({ edge }) => EXPOSURE_ONE_HOP_RELATIONS.includes(edge.relation as (typeof EXPOSURE_ONE_HOP_RELATIONS)[number]))
    .map(({ edge, index }) => ({ child: nodeById(graph, edge.target), index }))
    .filter((entry): entry is { child: Node; index: number } => Boolean(entry.child))
    .filter(({ child }) => child.reviewStatus !== "deprecated")
    .filter(({ child }) => child.kind !== "organization" && child.kind !== "metric" && child.kind !== "evidence")
    .sort((a, b) => exposureSourceRank(node, a.child, a.index) - exposureSourceRank(node, b.child, b.index))
    .map((entry, rank) => ({ child: entry.child, rank }));
}

function exposureSourceRank(parent: Node, child: Node, index: number): number {
  const bottleneckBoost = child.bottleneckOf?.includes(parent.id) ? 0 : 1;
  const maturity = typeof child.maturityScore === "number" ? child.maturityScore : 101;
  return bottleneckBoost * 10_000 + maturity * 100 + index;
}

function exposureCandidateRank(graph: GraphData, node: Node, candidate: ExposureCandidate): number {
  const depth = candidate.depth * 1_000_000;
  const source = candidate.sourceRank * 10_000;
  const listing = listingInfoForOrg(candidate.organization);
  const listingPenalty = listing.ticker || listing.status !== "unknown" ? 0 : 1_000;
  const edgeIndex = candidate.edge ? graph.edges.findIndex((edge) => edge.id === candidate.edge?.id) : 0;
  const stableEdge = edgeIndex >= 0 ? edgeIndex : graph.edges.length;
  const selfPenalty = candidate.organization.id === node.id ? -1_000 : 0;
  return depth + source + listingPenalty + stableEdge + selfPenalty;
}

function evidenceQuickPathForNode(
  graph: GraphData,
  node: Node,
  evidence: Evidence[],
  t: (key: string) => string,
): EvidenceQuickPath {
  const directEvidence = evidence.filter((item) => item.reviewStatus !== "deprecated");
  if (directEvidence.length > 0) {
    return {
      text: formatCopy(t("evidenceDirectSourceSummary"), { total: directEvidence.length }),
      viaNode: null,
    };
  }

  const nearest = nearestEvidenceForNode(graph, node);
  if (nearest) {
    return {
      text: formatCopy(t("evidenceNearestTitle"), { title: nearest.evidence.title }),
      viaNode: nearest.viaNode,
    };
  }

  return {
    text: t("evidenceQuickPathFallback"),
    viaNode: null,
  };
}

function nearestEvidenceForNode(graph: GraphData, node: Node): { evidence: Evidence; viaNode: Node } | null {
  const candidates: Array<{ evidence: Evidence; viaNode: Node; sourceRank: number; evidenceRank: number }> = [];
  for (const { child, rank } of oneHopExposureSources(graph, node)) {
    const records = evidenceForNode(graph, child.id).filter((item) => item.reviewStatus !== "deprecated");
    records.forEach((record, evidenceRank) => {
      candidates.push({ evidence: record, viaNode: child, sourceRank: rank, evidenceRank });
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const dateCompare = (b.evidence.date ?? "").localeCompare(a.evidence.date ?? "");
    if (dateCompare !== 0) return dateCompare;
    const reviewedCompare = Number(b.evidence.reviewStatus === "reviewed") - Number(a.evidence.reviewStatus === "reviewed");
    if (reviewedCompare !== 0) return reviewedCompare;
    return a.sourceRank - b.sourceRank || a.evidenceRank - b.evidenceRank;
  });
  return { evidence: candidates[0].evidence, viaNode: candidates[0].viaNode };
}

function NodeDetailInspectNext({
  graph,
  node,
  evidenceCount,
  onSelectNode,
}: {
  graph: GraphData;
  node: Node;
  evidenceCount: number;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  const ranked = useMemo(() => rankedInspectCandidatesForNode(graph, node), [graph, node]);
  if (ranked.length === 0 && evidenceCount > 0) return null;
  return (
    <section className="detail-reader-inspect" data-testid="detail-inspect-next">
      <strong>{t("readerInspectNext")}</strong>
      {ranked.length > 0 ? (
        <div className="detail-reader-inspect-list">
          {ranked.map((entry) => {
            const displayName = nodeName(entry.id, entry.child.name);
            const meta = entry.source === "explicit" ? t("bottleneckBadge") : heatScoreLabel(t, entry.risk);
            return onSelectNode ? (
              <button
                className="detail-reader-inspect-item"
                key={entry.id}
                type="button"
                onClick={() => onSelectNode(entry.id)}
                aria-label={`${t("readerInspect")} ${displayName}`}
              >
                <span>{displayName}</span>
                <small>{meta}</small>
              </button>
            ) : (
              <div className="detail-reader-inspect-item" key={entry.id}>
                <span>{displayName}</span>
                <small>{meta}</small>
              </div>
            );
          })}
        </div>
      ) : null}
      {evidenceCount === 0 ? (
        <div className="detail-reader-inspect-gap">
          <span>{t("evidenceGapTitle")}</span>
          <p>{t("evidenceGapHint")}</p>
        </div>
      ) : null}
    </section>
  );
}

function DetailPrioritySummary({
  graph,
  node,
  dependencyCount,
  bottleneckCount,
  bottleneckParentCount,
  evidenceCount,
}: {
  graph: GraphData;
  node: Node;
  dependencyCount: number;
  bottleneckCount: number;
  bottleneckParentCount: number;
  evidenceCount: number;
}) {
  const { t } = useLanguage();
  const rollup = useMemo<CostRollupResult | null>(() => {
    if (!isCostSummaryNode(node)) return null;
    try {
      return rollupCost(graph, node.id);
    } catch {
      return null;
    }
  }, [graph, node]);
  const maturity = typeof node.maturityScore === "number" ? `${node.maturityScore}/100` : t("nodeMaturityScoreMissing");
  const cost =
    rollup && rollup.anyChildContributed
      ? formatMetricValue(rollup.rolledUp, "RMB", "RMB").compact
      : t("metricNoValue");
  const riskScore = nodeRiskSignal(node, graph);
  const risk = isKnowHowNode(node) && riskScore === 0 ? t("readerHeatUnscored") : heatScoreValue(riskScore);
  const riskAria = isKnowHowNode(node) && riskScore === 0 ? `${t("risk")} ${risk}` : heatScoreLabel(t, riskScore);
  const isBottleneckForParent = bottleneckParentCount > 0;
  return (
    <div className="detail-priority-strip" aria-label={t("detailPrioritySummary")}>
      <div
        className={["detail-priority-tile", riskScore >= 0.4 ? "danger" : riskScore >= 0.2 ? "warning" : ""].filter(Boolean).join(" ")}
        title={t("heatScoreTooltip")}
        aria-label={`${riskAria}. ${t("heatScoreTooltip")}`}
      >
        <span>{t("risk")}</span>
        <strong>{risk}</strong>
      </div>
      <div className="detail-priority-tile">
        <span>{t("maturity")}</span>
        <strong>{maturity}</strong>
      </div>
      {isCostSummaryNode(node) ? (
        <div className="detail-priority-tile">
          <span>{t("costRollupTitle")}</span>
          <strong>{cost}</strong>
        </div>
      ) : null}
      <div
        className={[
          "detail-priority-tile",
          isBottleneckForParent || bottleneckCount > 0 ? "danger" : "",
        ].filter(Boolean).join(" ")}
      >
        <span>{isBottleneckForParent ? t("bottleneckRole") : t("downstreamBottlenecks")}</span>
        <strong>{isBottleneckForParent ? t("bottleneckRoleValue") : bottleneckCount}</strong>
      </div>
      <div className="detail-priority-tile">
        <span>{t("downstream")}</span>
        <strong>{dependencyCount}</strong>
      </div>
      <div className={["detail-priority-tile", evidenceCount === 0 ? "warning" : ""].filter(Boolean).join(" ")}>
        <span>{t("evidence")}</span>
        <strong>{evidenceCount}</strong>
      </div>
    </div>
  );
}

function isCostSummaryNode(node: Node): boolean {
  return node.kind === "product" || node.kind === "module" || node.kind === "equipment" || node.kind === "material";
}

function canSurfaceCostAnswer(node: Node): boolean {
  return isCostSummaryNode(node) || node.kind === "engineering_method" || node.kind === "manufacturing_process";
}

const CONSTRAINT_FACTOR_TAG_KEYS: ReadonlyArray<{ tag: string; labelKey: string }> = [
  { tag: "constraint_technical_maturity", labelKey: "constraintFactorTechnicalMaturity" },
  { tag: "constraint_integration_commissioning", labelKey: "constraintFactorIntegrationCommissioning" },
  { tag: "constraint_maintenance_operations", labelKey: "constraintFactorMaintenanceOperations" },
  { tag: "constraint_component_availability", labelKey: "constraintFactorComponentAvailability" },
  { tag: "constraint_material_supply_chain", labelKey: "constraintFactorMaterialSupplyChain" },
  { tag: "constraint_capacity_scale", labelKey: "constraintFactorCapacityScale" },
  { tag: "constraint_regulatory_approval", labelKey: "constraintFactorRegulatoryApproval" },
  { tag: "constraint_economic_validation", labelKey: "constraintFactorEconomicValidation" },
] as const;

function constraintFactorsForNode(node: Node, t: (key: string) => string): Array<{ tag: string; label: string }> {
  const tags = new Set(node.tags ?? []);
  return CONSTRAINT_FACTOR_TAG_KEYS
    .filter((entry) => tags.has(entry.tag))
    .map((entry) => ({ tag: entry.tag, label: t(entry.labelKey) }));
}

function opportunityCandidatesForNode(graph: GraphData, node: Node): Node[] {
  const reachable = requiresReachableIds(graph, node.id);
  return graph.nodes
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => candidate.tags?.includes("startup_opportunity_candidate"))
    .filter((candidate) => reachable.has(candidate.id))
    .sort((a, b) => nodeRisk(b, graph) - nodeRisk(a, graph) || a.name.localeCompare(b.name));
}

function requiresReachableIds(graph: GraphData, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) continue;
    for (const edge of graph.edges) {
      if (edge.source !== source || edge.relation !== "requires") continue;
      if (ids.has(edge.target)) continue;
      const target = nodeById(graph, edge.target);
      if (!target || target.reviewStatus === "deprecated") continue;
      ids.add(edge.target);
      queue.push(edge.target);
    }
  }
  return ids;
}

function candidateExposureForNode(graph: GraphData, nodeId: string): Node[] {
  const exposureEdges = [
    ...outgoingEdges(graph, nodeId, "manufactured_by"),
    ...outgoingEdges(graph, nodeId, "implemented_by"),
  ].filter((edge) => edge.reviewStatus !== "deprecated");
  const seen = new Set<string>();
  const exposure: Node[] = [];
  for (const edge of exposureEdges) {
    const org = nodeById(graph, edge.target);
    if (!org || org.kind !== "organization" || org.reviewStatus === "deprecated") continue;
    if (seen.has(org.id)) continue;
    seen.add(org.id);
    exposure.push(org);
  }
  return exposure;
}

/**
 * Per ADR-0002, `maturityHistory` is the reserved time-series field for the
 * future time-slider. Iter-34 surfaces it in stub form: when a node has a
 * non-empty history, render a compact chronological list (oldest -> newest)
 * inside the Maturity subsection. Color-coded label pills match the existing
 * `maturityVisual.ts` ramp; an `as of` pill mirrors the scalar treatment;
 * source provenance ("source: ...") trails each row so stub data is auditable.
 * Silently absent on the 230 nodes without history.
 */
function MaturityHistoryTimeline({ node }: { node: Node }) {
  const { t } = useLanguage();
  const history = node.maturityHistory;
  if (!history || history.length === 0) return null;
  // Per UX Flow v3 iter-7 (progressive disclosure): the current
  // maturity scalar (label + score + asOf) is already shown directly
  // above; the historical timeline is "why we say so" reference detail
  // and shouldn't dominate the panel. Default collapsed with the
  // entry count in the summary.
  return (
    <details className="maturity-history panel-section-collapsible">
      <summary aria-label={`${t("maturityHistoryHeader")} (${history.length})`}>
        <strong>{t("maturityHistoryHeader")}</strong>{" "}
        <span className="muted">({history.length})</span>
      </summary>
      <div className="maturity-history-head">
        <span className="muted maturity-history-hint">{t("maturityHistoryHint")}</span>
      </div>
      <ul className="maturity-history-list">
        {history.map((entry, index) => {
          const visual = maturityVisualFor({ maturityLabel: entry.label });
          const labelText = entry.label ? formatMaturityLabel(entry.label) : "—";
          return (
            <li className="maturity-history-row" key={`${entry.asOf}-${index}`}>
              <span className="maturity-history-asof" title={entry.asOf}>
                {entry.asOf}
              </span>
              <span
                className={["maturity-pill", visual.hasLabel ? "" : "missing"].filter(Boolean).join(" ")}
                style={{
                  background: visual.bg,
                  color: visual.fg,
                  opacity: visual.hasLabel ? 1 : 0.65,
                }}
                title={labelText}
              >
                {labelText}
                {typeof entry.score === "number" ? (
                  <span className="maturity-pill-score">· {entry.score}</span>
                ) : null}
              </span>
              {entry.source ? (
                <span className="muted maturity-history-source">
                  {t("maturityHistorySource")}: {entry.source}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * Per ADR-0003, the metric list on the detail panel surfaces the formatted
 * `currentValue` / `targetValue` (range-aware) along with a small `costAsOf`
 * year pill for cost-bearing metrics. The pill mirrors the iter-7
 * `maturityAsOf` treatment so a learner can scan the freshness of every cost
 * claim.
 */
/**
 * Per UX Flow v3 iter-9 (progressive disclosure): a metric without a
 * recorded current or target value is "empty" and lands rather low
 * in the user's signal-to-noise calculus. Split metrics into the two
 * groups; show the recorded ones inline and stuff the empties inside
 * a collapsed <details> so they're auditable without dominating the
 * panel.
 */
function metricHasValue(node: Node): boolean {
  const inline = node.metrics?.[0];
  if (!inline) return false;
  return inline.currentValue !== undefined || inline.targetValue !== undefined;
}

function MetricNodeList({
  title,
  metrics,
  onSelectNode,
}: {
  title: string;
  metrics: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  const recorded = metrics.filter(metricHasValue);
  const empty = metrics.filter((n) => !metricHasValue(n));
  return (
    <div>
      <strong>{title}</strong>
      {metrics.length === 0 ? <p className="muted">{t("none")}</p> : null}
      {recorded.length > 0 ? (
        <ul className="metric-detail-list">
          {recorded.map((metricNode) => (
            <MetricNodeListItem
              key={metricNode.id}
              metric={metricNode}
              displayName={nodeName(metricNode.id, metricNode.name)}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      ) : null}
      {empty.length > 0 ? (
        <details className="panel-section-collapsible">
          <summary aria-label={`${empty.length} ${t("metricsEmptyCount")}`}>
            <span className="muted">
              {empty.length} {t("metricsEmptyCount")}
            </span>
          </summary>
          <ul className="metric-detail-list">
            {empty.map((metricNode) => (
              <MetricNodeListItem
                key={metricNode.id}
                metric={metricNode}
                displayName={nodeName(metricNode.id, metricNode.name)}
                onSelectNode={onSelectNode}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function MetricNodeListItem({
  metric,
  displayName,
  onSelectNode,
}: {
  metric: Node;
  displayName: string;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { t } = useLanguage();
  const inline = metric.metrics?.[0];
  const unit = inline?.unit;
  const currency = inline?.currency;
  const isCost = isCostBearingMetric(metric);
  const asOf = costAsOfVisualFor(inline?.costAsOf);
  const current = formatMetricValue(inline?.currentValue, unit, currency);
  const target = formatMetricValue(inline?.targetValue, unit, currency);
  return (
    <li className="metric-detail-row">
      <div className="metric-detail-row-head">
        {onSelectNode ? (
          <button type="button" className="link-button" onClick={() => onSelectNode(metric.id)}>
            {displayName}
          </button>
        ) : (
          <span>{displayName}</span>
        )}
        {isCost ? (
          <span
            className={["cost-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
            title={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
            aria-label={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
          >
            <span className="cost-asof-pill-icon" aria-hidden="true">¥</span>
            {t("costAsOf")}: {asOf.label}
          </span>
        ) : null}
        {currency && currency !== "RMB" ? (
          <span
            className="currency-pill"
            title={t("currencyPillTooltip").replace("{currency}", currency)}
            aria-label={t("currencyPillTooltip").replace("{currency}", currency)}
          >
            {currency}
          </span>
        ) : null}
      </div>
      <div className="metric-detail-row-values">
        {current.full !== "—" ? (
          <span>
            <strong>{t("current")}:</strong> {current.full}
          </span>
        ) : null}
        {target.full !== "—" ? (
          <span>
            <strong>{t("target")}:</strong> {target.full}
          </span>
        ) : null}
        {current.full === "—" && target.full === "—" ? (
          <span className="muted">{t("metricNoValue")}</span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Per ADR-0003, when a `metric` node is selected its detail panel surfaces
 * the formatted current/target values plus a `costAsOf` year pill if
 * cost-bearing. Mirrors the iter-7 `maturityAsOf` treatment.
 */
function MetricValueDetailRow({ node }: { node: Node }) {
  const { t } = useLanguage();
  const inline = node.metrics?.[0];
  if (!inline) return null;
  const isCost = isCostBearingMetric(node);
  const asOf = costAsOfVisualFor(inline.costAsOf);
  const current = formatMetricValue(inline.currentValue as MetricValue | undefined, inline.unit, inline.currency);
  const target = formatMetricValue(inline.targetValue as MetricValue | undefined, inline.unit, inline.currency);
  const currency = inline.currency as MetricCurrency | undefined;
  return (
    <div className="metric-value-detail">
      <strong>{t("metricValue")}</strong>
      <div className="metric-value-detail-pills">
        {isCost ? (
          <span
            className={["cost-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
            title={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
            aria-label={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
          >
            <span className="cost-asof-pill-icon" aria-hidden="true">¥</span>
            {t("costAsOf")}: {asOf.label}
          </span>
        ) : null}
        {currency && currency !== "RMB" ? (
          <span
            className="currency-pill"
            title={t("currencyPillTooltip").replace("{currency}", currency)}
            aria-label={t("currencyPillTooltip").replace("{currency}", currency)}
          >
            {currency}
          </span>
        ) : null}
      </div>
      <ul>
        {current.full !== "—" ? (
          <li>
            <strong>{t("current")}:</strong> {current.full}
          </li>
        ) : null}
        {target.full !== "—" ? (
          <li>
            <strong>{t("target")}:</strong> {target.full}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Per ADR-0003 the bottom-up cost rollup is exposed at the product level so
 * a learner sees the rolled-up range, the coverage-gap dot (green / amber /
 * red), and the reference target sitting next to each other. The walker is
 * pure but iterates O(N·E) over the eligible-subsystem closure on every
 * call, so we memoize on [graph, product.id] to avoid redoing it on each
 * render of the parent panel (per iter-20 P1 review).
 */
function ProductCostRollupCard({ graph, product }: { graph: GraphData; product: Node }) {
  const { t } = useLanguage();
  const rollup = useMemo<CostRollupResult | null>(() => {
    try {
      return rollupCost(graph, product.id);
    } catch {
      return null;
    }
  }, [graph, product.id]);
  const target = targetCostFor(graph, product.id);
  // Per iter-15 review (P0 #3), the eligible-subsystem filter is hoisted to
  // costRollup.eligibleCostSubsystemIds so panel + ProductView + gate share
  // a single denominator (excludes capability nodes and the target itself).
  const reachable = eligibleCostSubsystemIds(graph, product.id);
  const denominator = Math.max(reachable.size, rollup ? rollup.coverageGap.length : 0, 1);
  const gapCount = rollup ? rollup.coverageGap.length : 0;
  const gapFraction = gapCount / denominator;
  const dotClass = coverageDotClass(gapFraction);
  // Per iter-15 review (P0 #1), when no subsystem contributed real cost data
  // the rolled-up sum is structurally meaningless `{0,0,0}` — render "—"
  // (the existing metricNoValue treatment) instead of "0 RMB" so a learner
  // does not read it as a real number. The coverage-gap dot stays red and
  // a tooltip explains the empty state.
  const hasRollupValue = rollup ? rollup.anyChildContributed : false;
  const rolledUpFull = hasRollupValue && rollup
    ? formatMetricValue(rollup.rolledUp, "RMB", "RMB").full
    : t("metricNoValue");
  const rolledUpTooltip = hasRollupValue ? undefined : t("costRollupNoData");
  const targetFull = target ? formatMetricValue(target.range, "RMB", "RMB").full : null;
  const targetCostString = product.targetContext?.targetCost?.trim();
  return (
    <div className="cost-rollup-card">
      <strong>{t("costRollupTitle")}</strong>
      <div className="cost-rollup-row">
        <span
          className={["cost-rollup-value", hasRollupValue ? "" : "missing"].filter(Boolean).join(" ")}
          title={rolledUpTooltip}
          aria-label={rolledUpTooltip}
        >
          {rolledUpFull}
        </span>
        {/*
          Per iter-44 a11y audit (MAJOR): the green/amber/red dot was the
          only visual signal of coverage state — color-blind users saw
          three identical grey dots. We now overlay a glyph (✓ / ⚠ / ⨯)
          so the signal is non-color-dependent. The text "{n}/{total}
          subsystems missing cost data" already provides redundancy; the
          dot+glyph is reinforcement.
        */}
        <span className={["cost-coverage-dot", dotClass].join(" ")} aria-hidden="true">
          {coverageDotGlyph(dotClass)}
        </span>
        <span className="muted cost-coverage-text">
          {coverageStatusText(t, gapCount, denominator)}
        </span>
      </div>
      {/* Per v3 iter-20: when coverage gap > 50%, the rolled-up
          number is misleading at first glance — surface the warning
          as a callout banner so reviewers know to treat the number
          as a lower bound, not an estimate. */}
      {gapFraction > 0.5 && hasRollupValue ? (
        <p className="cost-coverage-warning" role="alert">
          ⚠ {t("costCoverageHighGapWarning")
            .replace("{percent}", String(Math.round(gapFraction * 100)))}
        </p>
      ) : null}
      {rollup && (rollup.directOnly || rollup.fromChildren) ? (
        <div className="cost-rollup-breakdown">
          {rollup.directOnly ? (
            <span className="cost-rollup-breakdown-chunk">
              <em>{t("costBreakdownDirect")}:</em>{" "}
              {formatMetricValue(rollup.directOnly, "RMB", "RMB").compact}
            </span>
          ) : null}
          {rollup.fromChildren ? (
            <span className="cost-rollup-breakdown-chunk">
              <em>{t("costBreakdownChildren")}:</em>{" "}
              {formatMetricValue(rollup.fromChildren, "RMB", "RMB").compact}
            </span>
          ) : null}
          {rollup.directLowerThanChildren ? (
            <span
              className="cost-rollup-inversion-warning"
              role="img"
              aria-label={t("costInversionWarning")}
              title={t("costInversionWarning")}
            >
              ⚠ {t("costInversionWarning")}
            </span>
          ) : null}
        </div>
      ) : null}
      {targetFull ? (
        <p className="muted cost-rollup-target">
          <strong>{t("target")}:</strong> {targetFull}
          {target?.costAsOf ? <> · {t("costAsOf")} {target.costAsOf}</> : null}
        </p>
      ) : targetCostString ? (
        <p className="muted cost-rollup-target">
          <strong>{t("target")}:</strong> {targetCostString}
        </p>
      ) : null}
      {rollup?.costAsOf ? (
        <p className="muted">
          <em>{t("costAsOfEarliest")}:</em> {rollup.costAsOf}
        </p>
      ) : null}
      <p className="muted cost-rollup-hint">{t("costRollupHint")}</p>
    </div>
  );
}

function coverageDotClass(gapFraction: number): string {
  if (gapFraction <= 0.1) return "green";
  if (gapFraction <= 0.5) return "amber";
  return "red";
}

/**
 * Per iter-44 a11y audit, the cost-coverage dot pairs its color with a
 * glyph so color-blind users get the same signal. ✓ for good coverage,
 * ⚠ for partial, ⨯ for sparse. The glyph sits inside the dot via
 * `.cost-coverage-dot` flex layout in globals.css.
 */
function coverageDotGlyph(dotClass: string): string {
  if (dotClass === "green") return "✓";
  if (dotClass === "amber") return "⚠";
  return "⨯";
}

function coverageStatusText(t: (key: string) => string, gapCount: number, denominator: number): string {
  if (gapCount === 0) return t("costCoverageComplete");
  return t("costCoverageGapStat")
    .replace("{gap}", String(gapCount))
    .replace("{total}", String(denominator));
}

function NodeList({
  title,
  nodes,
  onSelectNode,
  subtitle,
  deprecatedHiddenCount = 0,
}: {
  title: string;
  nodes: Node[];
  onSelectNode?: (nodeId: string) => void;
  subtitle?: string;
  deprecatedHiddenCount?: number;
}) {
  const { nodeName, t } = useLanguage();
  // Per ADR-0001, deprecated children are excluded from the auto-rendered
  // child lists by default. We surface a count inline so the learner knows
  // soft-deleted records exist without burying it in the tree.
  const deprecatedNote =
    deprecatedHiddenCount > 0
      ? t("deprecatedHiddenChildrenSuffix").replace("{count}", String(deprecatedHiddenCount))
      : null;
  return (
    <div>
      <strong>{title}</strong>
      {subtitle ? <span className="muted node-list-subtitle"> ({subtitle})</span> : null}
      {deprecatedNote ? (
        <span className="muted node-list-deprecated-note"> ({deprecatedNote})</span>
      ) : null}
      {nodes.length === 0 ? <p className="muted">{t("none")}</p> : null}
      {nodes.length > 0 ? (
        // Per UX Flow v3 iter-10 (progressive disclosure): when a list
        // has > NODE_LIST_VISIBLE_LIMIT items, render the first N
        // inline and hide the rest behind a "+M more" expander so the
        // panel stays scannable on the flagship product (which has
        // 17+ Downstream children).
        <NodeListBody nodes={nodes} onSelectNode={onSelectNode} />
      ) : null}
    </div>
  );
}

const NODE_LIST_VISIBLE_LIMIT = 5;

type OrganizationLink = {
  organization: Node;
  edge: Edge;
};

function OrganizationNodeList({
  title,
  links,
  onSelectNode,
  subtitle,
  deprecatedHiddenCount = 0,
}: {
  title: string;
  links: OrganizationLink[];
  onSelectNode?: (nodeId: string) => void;
  subtitle?: string;
  deprecatedHiddenCount?: number;
}) {
  const { t } = useLanguage();
  const deprecatedNote =
    deprecatedHiddenCount > 0
      ? t("deprecatedHiddenChildrenSuffix").replace("{count}", String(deprecatedHiddenCount))
      : null;
  return (
    <div>
      <strong>{title}</strong>
      {subtitle ? <span className="muted node-list-subtitle"> ({subtitle})</span> : null}
      {deprecatedNote ? (
        <span className="muted node-list-deprecated-note"> ({deprecatedNote})</span>
      ) : null}
      {links.length === 0 ? <p className="muted">{t("none")}</p> : null}
      {links.length > 0 ? (
        <OrganizationListBody links={links} onSelectNode={onSelectNode} />
      ) : null}
    </div>
  );
}

function OrganizationListBody({
  links,
  onSelectNode,
}: {
  links: OrganizationLink[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { t } = useLanguage();
  if (links.length <= NODE_LIST_VISIBLE_LIMIT) {
    return (
      <ul>
        {links.map((link) => (
          <OrganizationListItem key={link.edge.id} link={link} onSelectNode={onSelectNode} />
        ))}
      </ul>
    );
  }
  const head = links.slice(0, NODE_LIST_VISIBLE_LIMIT);
  const tail = links.slice(NODE_LIST_VISIBLE_LIMIT);
  return (
    <>
      <ul>
        {head.map((link) => (
          <OrganizationListItem key={link.edge.id} link={link} onSelectNode={onSelectNode} />
        ))}
      </ul>
      <details className="panel-section-collapsible">
        <summary aria-label={`${tail.length} ${t("nodeListMoreSuffix")}`}>
          <span className="muted">
            {tail.length} {t("nodeListMoreSuffix")}
          </span>
        </summary>
        <ul>
          {tail.map((link) => (
            <OrganizationListItem key={link.edge.id} link={link} onSelectNode={onSelectNode} />
          ))}
        </ul>
      </details>
    </>
  );
}

function OrganizationListItem({
  link,
  onSelectNode,
}: {
  link: OrganizationLink;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName } = useLanguage();
  const { edge, organization } = link;
  const summary = organizationMetricSummary(organization);
  return (
    <li>
      <div>
        <NodeListLink node={organization} displayName={nodeName(organization.id, organization.name)} onSelectNode={onSelectNode} />
        <ListingChip org={organization} />
      </div>
      {summary ? <span className="muted supplier-list-meta"> {" - "}{summary}</span> : null}
      <EdgeContextSummary edge={edge} />
    </li>
  );
}

type InlineNodeMetric = NonNullable<Node["metrics"]>[number];

function candidateExposureSummary(organization: Node, displayName: string): string {
  const summary = organizationMetricSummary(organization, { includeDescriptions: false, limit: 2 });
  return summary ? `${displayName} (${summary})` : displayName;
}

function organizationMetricSummary(
  organization: Node,
  options: { includeDescriptions?: boolean; limit?: number } = {},
): string | null {
  const includeDescriptions = options.includeDescriptions ?? true;
  const limit = options.limit ?? 3;
  const metrics = organization.metrics ?? [];
  const selected: InlineNodeMetric[] = [];
  const push = (metric: InlineNodeMetric | undefined) => {
    if (!metric || selected.includes(metric)) return;
    if (metric.currentValue === undefined) return;
    selected.push(metric);
  };
  push(metrics.find((metric) => metric.unit === "%" || metric.name.toLowerCase().includes("share")));
  push(metrics.find((metric) => metric.name.toLowerCase().includes("public listing")));
  push(metrics.find((metric) => metric.name.toLowerCase().includes("capacity")));
  push(metrics.find((metric) => metric.currentValue !== undefined));

  const summary = selected
    .slice(0, limit)
    .map((metric) => formatOrganizationMetric(metric, { includeDescription: includeDescriptions }))
    .filter((item): item is string => Boolean(item));
  return summary.length ? summary.join(" · ") : null;
}

function formatOrganizationMetric(
  metric: InlineNodeMetric,
  options: { includeDescription?: boolean } = {},
): string | null {
  if (metric.currentValue === undefined) return null;
  const value = `${metric.name}: ${formatOrganizationMetricValue(metric.currentValue, metric.unit)}`;
  if (options.includeDescription === false) return value;
  const description = metric.description?.trim();
  return description ? `${value} (${truncateText(description, 120)})` : value;
}

function formatOrganizationMetricValue(value: MetricValue, unit?: string): string {
  if (typeof value === "number") return `${formatOrganizationNumber(value)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  if (typeof value === "string") return value;
  return `p50 ${formatOrganizationNumber(value.typical)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

function formatOrganizationNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : String(value);
}

function EdgeContextSummary({ edge }: { edge: Edge }) {
  const status = edge.confidence;
  const claim = edge.claim?.trim();
  const context = edge.context?.trim();
  if (!status && !claim && !context) return null;
  return (
    <div className="muted supplier-link-context">
      {claim ? <span>{claim}</span> : null}
      {status ? <span> ({status})</span> : null}
      {context ? <div>{context}</div> : null}
    </div>
  );
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function NodeListBody({
  nodes,
  onSelectNode,
}: {
  nodes: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  if (nodes.length <= NODE_LIST_VISIBLE_LIMIT) {
    return (
      <ul>
        {nodes.map((node) => (
          <li key={node.id}>
            <NodeListLink node={node} displayName={nodeName(node.id, node.name)} onSelectNode={onSelectNode} />
          </li>
        ))}
      </ul>
    );
  }
  const head = nodes.slice(0, NODE_LIST_VISIBLE_LIMIT);
  const tail = nodes.slice(NODE_LIST_VISIBLE_LIMIT);
  return (
    <>
      <ul>
        {head.map((node) => (
          <li key={node.id}>
            <NodeListLink node={node} displayName={nodeName(node.id, node.name)} onSelectNode={onSelectNode} />
          </li>
        ))}
      </ul>
      <details className="panel-section-collapsible">
        <summary aria-label={`${tail.length} ${t("nodeListMoreSuffix")}`}>
          <span className="muted">
            {tail.length} {t("nodeListMoreSuffix")}
          </span>
        </summary>
        <ul>
          {tail.map((node) => (
            <li key={node.id}>
              <NodeListLink node={node} displayName={nodeName(node.id, node.name)} onSelectNode={onSelectNode} />
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

type RankedInspectCandidate = {
  id: string;
  child: Node;
  risk: number;
  source: "explicit" | "dependency";
};

function rankedInspectCandidatesForNode(graph: GraphData, parent: Node, limit = 3): RankedInspectCandidate[] {
  const explicitBottlenecks = bottlenecksForNode(graph, parent.id)
    .filter((child) => child.reviewStatus !== "deprecated")
    .map((child) => ({
      id: child.id,
      child,
      risk: nodeRiskSignal(child, graph),
      source: "explicit" as const,
    }));
  const explicitIds = new Set(explicitBottlenecks.map((entry) => entry.id));
  const childIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source !== parent.id || edge.relation !== "requires") continue;
    const child = graph.nodes.find((n) => n.id === edge.target);
    if (!child) continue;
    if (explicitIds.has(child.id)) continue;
    if (
      child.kind === "metric" ||
      child.kind === "evidence" ||
      child.kind === "bottleneck" ||
      child.kind === "placeholder_breakthrough"
    ) {
      continue;
    }
    if (child.reviewStatus === "deprecated") continue;
    childIds.add(child.id);
  }
  const scored = Array.from(childIds)
    .map((id): RankedInspectCandidate | null => {
      const child = graph.nodes.find((n) => n.id === id);
      if (!child) return null;
      return {
        id,
        child,
        risk: nodeRiskSignal(child, graph),
        source: "dependency" as const,
      };
    })
    .filter((entry): entry is RankedInspectCandidate => entry !== null);
  scored.sort((a, b) => b.risk - a.risk);
  return [...explicitBottlenecks, ...scored.filter((entry) => entry.risk > 0.1)].slice(0, limit);
}

/**
 * Per UX Flow v3 iter-11: a learner's first question is usually
 * "what's gating this thing?" Put explicit `bottlenecked_by` nodes first,
 * then fill with the highest-risk `requires` children. This keeps the
 * top action aligned with the graph's bottleneck edge semantics instead
 * of making the user scan the lower Bottlenecks list.
 *
 * Risk uses nodeRiskSignal(child, graph), so explicit bottleneck markers
 * rank consistently with the route rail even when cost data is missing.
 * If no bottleneck and no child has risk > 0.1 we render nothing (avoids a useless
 * "top blockers: ..." row when everything is mature).
 */
function TopBlockers({
  graph,
  parent,
  onSelectNode,
}: {
  graph: GraphData;
  parent: Node;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  const ranked = useMemo(() => rankedInspectCandidatesForNode(graph, parent), [graph, parent]);
  if (ranked.length === 0) return null;
  return (
    <div className="top-blockers">
      <strong>🎯 {onSelectNode ? t("topBlockersTitle") : t("topBlockersStaticTitle")}</strong>
      <ol className="top-blockers-list">
        {ranked.map((entry) => {
          const maturityLabel = entry.child.maturityLabel ?? "unknown";
          const maturityText = formatMaturityLabel(maturityLabel);
          const sourceText = entry.source === "explicit" ? t("explicitBottleneck") : maturityText;
          const badgeText = entry.source === "explicit" ? t("bottleneckBadge") : heatScoreLabel(t, entry.risk);
          const factors = constraintFactorsForNode(entry.child, t);
          const riskDrivers = riskDriverText(entry.child, graph, t);
          return (
            <li key={entry.id}>
              {onSelectNode ? (
                <button
                  className="link-button top-blockers-link"
                  type="button"
                  onClick={() => onSelectNode(entry.id)}
                  title={t("topBlockersRiskTooltip")}
                  aria-label={`${nodeName(entry.id, entry.child.name)} — ${sourceText} · ${heatScoreLabel(t, entry.risk)}`}
                >
                  <span className="top-blockers-name">{nodeName(entry.id, entry.child.name)}</span>
                  <span className="top-blockers-meta muted">
                    {sourceText}
                    {factors.length > 0 ? ` · ${factors.map((factor) => factor.label).join(" · ")}` : ""}
                  </span>
                  {riskDrivers ? <span className="top-blockers-drivers muted">{riskDrivers}</span> : null}
                </button>
              ) : (
                <span>
                  {nodeName(entry.id, entry.child.name)}
                  {factors.length > 0 ? (
                    <span className="top-blockers-meta muted">
                      {" "}
                      · {factors.map((factor) => factor.label).join(" · ")}
                    </span>
                  ) : null}
                  {riskDrivers ? <span className="top-blockers-drivers muted"> · {riskDrivers}</span> : null}
                </span>
              )}
              <span className={["top-blockers-risk", entry.source === "explicit" ? "explicit" : ""].filter(Boolean).join(" ")} aria-hidden="true">
                {badgeText}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function riskDriverText(node: Node, graph: GraphData, t: (key: string) => string): string {
  const drivers: string[] = [];
  if (typeof node.maturityScore === "number") {
    drivers.push(`${t("topBlockersMaturityGap")} ${Math.round(100 - node.maturityScore)}%`);
  }
  const cost = topBlockerCostLabel(node, graph);
  if (cost) drivers.push(`${t("topBlockersP50Cost")} ${cost}`);
  return drivers.join(" · ");
}

function topBlockerCostLabel(node: Node, graph: GraphData): string | null {
  if (!isCostSummaryNode(node)) return null;
  try {
    const rollup = rollupCost(graph, node.id);
    if (!rollup.anyChildContributed && !rollup.directOnly) return null;
    return formatMetricValue(rollup.rolledUp.typical, "RMB", "RMB").compact;
  } catch {
    return null;
  }
}

function NodeListLink({
  node,
  displayName,
  onSelectNode,
}: {
  node: Node;
  displayName: string;
  onSelectNode?: (nodeId: string) => void;
}) {
  if (onSelectNode) {
    return (
      <button className="link-button" type="button" onClick={() => onSelectNode(node.id)}>
        {displayName}
      </button>
    );
  }
  return <>{displayName}</>;
}
