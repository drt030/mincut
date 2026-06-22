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
import { isArtifactCanvasNode, isKnowHowNode } from "@/lib/canvasGraph";
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
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import { nodeRisk, nodeRiskSignal } from "@/lib/nodeRisk";
import { nodeCostDriverRmb } from "@/lib/edgeStyleFor";
import {
  chokepointScores,
  chokepointVerdictBandFor,
  directDependents,
  dependentAncestors,
  quantileNormalizer,
  type ChokepointResult,
} from "@/lib/chokepointScore";
import {
  commercialScaleAnswerForOrganization,
  leadTimeAnswerForGraphNode,
  type CommercialScaleAnswer,
  type LeadTimeAnswer,
} from "@/lib/commercialDataCompleteness";
import {
  readerFacingCostSignalText,
  readerFacingNote,
  readerFacingStartupOpportunity,
} from "@/lib/readerFacingText";
import {
  CORE_READOUT_BLOCKING_LABEL_KEYS,
  CORE_READOUT_FIELD_LABEL_KEYS,
  CORE_READOUT_SCOPE_LABEL_KEYS,
  CORE_READOUT_STATUS_LABEL_KEYS,
  CORE_READOUT_SUBSTITUTION_LABEL_KEYS,
  coreReadoutForNode,
} from "@/lib/nodeCoreReadout";
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
      className="listing-chip"
      data-listing-status={info.status}
      data-listing-venue={venue ?? undefined}
      title={info.ticker && venue ? `${info.ticker} listing venue: ${venue}` : undefined}
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
type LockedExposureMode = "paid-candidate" | "audit-preview";

export function NodeDetailContent({
  graph,
  node,
  onSelectNode,
  lockedExposureMode = "paid-candidate",
  showExposureSummary = true,
  defaultOpenExposureSummary = false,
}: {
  graph: GraphData;
  node: Node;
  onSelectNode?: (nodeId: string) => void;
  lockedExposureMode?: LockedExposureMode;
  showExposureSummary?: boolean;
  defaultOpenExposureSummary?: boolean;
}) {
  const { kindName, language, nodeDescription, nodeName, t } = useLanguage();
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
  const localizedDescription =
    language === "zh"
      ? nodeDescription(node.id, node.description ?? "") || node.description
      : node.description;
  const heroQuote = firstSentenceDescription(
    isAiComputeNode(node) && node.kind === "product"
      ? t("readerAiComputeImportance")
      : localizedDescription,
  );
  const hasSecondaryResearch =
    ((node.kind === "product" || node.kind === "module") && rankedInspectCandidatesForNode(graph, node).length > 0) ||
    opportunityCandidates.length > 0 ||
    knowHowDeps.length > 0 ||
    manufacturerLinksAll.length > 0 ||
    implementerLinksAll.length > 0 ||
    supplierExposure.length > 0 ||
    implementationExposure.length > 0;

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
      className="detail-list detail-commercial-supplier-ia"
      role="region"
      aria-live="polite"
      aria-labelledby="detail-heading"
    >
      <div className="detail-reader-header detail-reader-hero">
        <span className="detail-reader-context">{kindName(node.kind)}</span>
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
        <div className="detail-reader-tags" aria-label="Node tags">
          <span>{kindName(node.kind)}</span>
          {isFrontierByJudgment ? <span className="frontier">{t("frontierPill")}</span> : null}
          {isHardToDevelop ? <span>{t("hardToDevelopGlyphTooltip")}</span> : null}
        </div>
        {heroQuote ? (
          <p className="detail-reader-quote">{heroQuote}</p>
        ) : null}
      </div>
      <NodeReaderPriority
        graph={graph}
        node={node}
        evidence={evidence}
        lockedEntry={lockedEntry}
        lockedExposureMode={lockedExposureMode}
        showExposureSummary={showExposureSummary}
        defaultOpenExposureSummary={defaultOpenExposureSummary}
        beforeEvidence={
          <DecompositionRationalePanel
            graph={graph}
            node={node}
            onSelectNode={onSelectNode}
          />
        }
      />
      {node.kind === "product" ? (
        <InvestorAnswerPanel
          graph={graph}
          product={node}
          opportunityCandidates={opportunityCandidates}
          onSelectNode={onSelectNode}
          lockedExposureMode={lockedExposureMode}
        />
      ) : null}
      {isKnowHowNode(node) ? (
        <section className="panel-section detail-knowhow-context" data-testid="detail-knowhow-context">
          <strong>{t("knowHowSectionTitle")}</strong>
          <div className="detail-knowhow-context-grid">
            <div>
              <span className="detail-reader-mini-heading">{t("knowHowTransactability")}</span>
              <TransactabilityChip value={node.transactability} t={t} />
            </div>
            {holderSummary ? (
              <div>
                <span className="detail-reader-mini-heading">{t("knowHowHoldersLabel")}</span>
                <p
                  data-testid="holders-summary"
                  data-holders-total={holderSummary.total}
                  data-holders-listed={holderSummary.listed}
                  style={holderSummary.total === 0 ? { color: "#dc2626", fontWeight: "bold" } : undefined}
                >
                  {holderSummary.total} {t("knowHowHoldersLabel")} · {holderSummary.listed} {t("knowHowListedLabel")}
                </p>
              </div>
            ) : null}
          </div>
          {knowHowHosts.length > 0 ? (
            <div className="detail-knowhow-hosts" data-testid="knowhow-hosted-by">
              <span className="detail-reader-mini-heading">{t("knowHowHostedBy")}</span>
              <div>
                {knowHowHosts.map((host) => (
                  <span key={host.id}>{nodeName(host.id, host.name)}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
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
          <p>{readerFacingNote(node.notes) || t("expansionFrontierHint")}</p>
        </div>
      ) : null}
      {hasSecondaryResearch ? (
        <section className="panel-section detail-secondary-research" data-testid="detail-secondary-research">
          <strong>{t("detailSecondaryResearch")}</strong>
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
        </section>
      ) : null}
      <details
        className="panel-section panel-section-collapsible detail-supplementary-appendix"
        data-testid="detail-supplementary-appendix"
      >
        <summary>
          <strong>{t("detailSupplementaryAppendix")}</strong>
        </summary>
        <section className="detail-supplementary-section" data-testid="detail-model-breakdown">
          <ChokepointHeadline graph={graph} node={node} />
          <ChokepointAxisBreakdown graph={graph} node={node} />
        </section>
        <section className="detail-supplementary-section" data-testid="detail-full-evidence-list">
          <strong>{t("fullEvidenceList")}</strong>
          <EvidenceList evidence={evidence} />
        </section>
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
  topCostEstimated: boolean;
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
  lockedExposureMode,
}: {
  graph: GraphData;
  product: Node;
  opportunityCandidates: Node[];
  onSelectNode?: (nodeId: string) => void;
  lockedExposureMode: LockedExposureMode;
}) {
  const { nodeName, t } = useLanguage();
  const rawLockedEntry = useLockedDomainForNode(product);
  const lockedEntry = isAiComputeNode(product) ? null : rawLockedEntry;
  const showPaidLockCta = Boolean(lockedEntry && lockedExposureMode !== "audit-preview");
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
    showPaidLockCta;
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
                <span className="pill">
                  {readerFacingCostSignalText({
                    valueText: formatMetricValue(answer.topCostTypicalRmb, "RMB", "RMB").compact,
                    kind: answer.topCostEstimated ? "estimated" : "modeled",
                    t,
                  })}
                </span>
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
        {showPaidLockCta && lockedEntry ? (
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
                  <strong>{factors.length > 0 ? t("readerWhereStuck") : t("readerRouteRole")}:</strong>{" "}
                  {factors.length > 0
                    ? factors.map((factor) => factor.label).join(" · ")
                    : t("readerConstraintUnclassified")}
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
    topCostEstimated: topCostStep ? topCostStep.costSignalKind === "estimated" : false,
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
  const node = nodeById(graph, nodeId);
  if (!node) return null;
  return nodeCostDriverRmb(node, graph)?.value ?? null;
}

function constraintTagCount(node: Node): number {
  return (node.tags ?? []).filter((tag) => tag.startsWith("constraint_")).length;
}

const INVESTOR_RISK_NODE_KINDS = new Set<Node["kind"]>([
  "module",
  "technical_route",
  "equipment",
  "material",
]);

function topRiskNodeForProduct(graph: GraphData, productId: string): Node | null {
  const reachable = requiresReachableIds(graph, productId);
  let best: { node: Node; risk: number } | null = null;
  for (const node of graph.nodes) {
    if (node.id === productId || !reachable.has(node.id)) continue;
    if (node.reviewStatus === "deprecated") continue;
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind) || !isArtifactCanvasNode(node)) continue;
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
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind) || !isArtifactCanvasNode(node)) continue;
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
  return readerFacingStartupOpportunity(node.notes);
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
  // CJK terminators (。！？) carry no trailing whitespace, so the old
  // `(?:\s|$)` guard matched only at the final terminator and returned the
  // whole zh body — leaking later-sentence supplier names (FF-1) that EN keeps
  // out of its first sentence. Match CJK terminators directly; keep ASCII
  // terminators gated on whitespace/end so abbreviations don't over-split.
  const match = trimmed.match(/^[\s\S]*?(?:[。！？]|[.!?](?=\s|$))/);
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

function readerClauseFragment(text: string): string {
  return text.trim().replace(/[.!?。！？…]+$/u, "");
}

function isAiComputeNode(node: Pick<Node, "domain"> | null | undefined): boolean {
  return Boolean(node?.domain?.includes("ai_compute_chain"));
}

function readerEvidenceStatusText(evidence: Evidence[], t: (key: string) => string): string {
  if (evidence.length === 0) return t("noDirectEvidence");
  if (evidence.length === 1) return t("readerEvidenceStatusCountSingular");
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
  // FF-3 (Gate F): when the active language is zh the caller passes the
  // localized description body so the 核心判断 sentence reads Chinese instead
  // of splicing the English `description` in. Defaults to the English field
  // for the /graph and /product callers that have not (yet) localized.
  localizedDescription: string | undefined = node.description,
): string {
  const where = sentenceClause(compactReaderClause(
    isAiComputeNode(node) && node.kind === "product"
      ? t("readerAiComputeImportance")
      : firstSentenceDescription(localizedDescription) ?? t("noDescription"),
  ));
  const parents = (node.bottleneckOf ?? [])
    .map((parentId) => nodeById(graph, parentId))
    .filter((parent): parent is Node => Boolean(parent && parent.reviewStatus !== "deprecated"));
  const targetNames = parents.slice(0, 2).map((parent) => nodeName(parent.id, parent.name));
  const impact = targetNames.length > 0 ? targetNames.join(", ") : t("readerSelectedRouteImpact");
  return formatCopy(t("readerDetailBottleneckThesisSentence"), {
    where,
    impact,
    factors: constraintSummaryText(graph, node, t),
    relief: readerClauseFragment(reliefTimingText(graph, node, t)),
    evidence: readerClauseFragment(readerEvidenceStatusText(evidence, t)),
  });
}

function structuralConstraintSignals(graph: GraphData, node: Node, t: (key: string) => string): string[] {
  const headline = chokepointHeadlineFor(graph, node, t);
  if (
    headline.axisSentence &&
    headline.axisSentence !== t("chokepointAxisConcentrationGap") &&
    headline.axisSentence !== t("chokepointVerdictFlagged")
  ) {
    return [headline.axisSentence];
  }
  return [];
}

function constraintSummaryText(graph: GraphData, node: Node, t: (key: string) => string): string {
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  if (factors.length > 0) return factors.join(" · ");
  if (isAiComputeNode(node) && node.kind === "product") return t("readerAiComputeConstraintSummary");
  const signals = structuralConstraintSignals(graph, node, t);
  if (signals.length > 0) return signals.join(" · ");
  return t("readerConstraintUnclassified");
}

function reliefTimingText(graph: GraphData, node: Node, t: (key: string) => string): string {
  const answer = leadTimeAnswerForGraphNode(graph, node);
  if (answer) {
    const { months } = answer;
    if (answer.basis === "estimated") {
      return formatCopy(t("readerReliefTimingEstimated"), {
        months,
        reason: leadTimeReasonText(answer, t),
      });
    }
    if (months <= 3) return formatCopy(t("readerReliefTimingShort"), { months });
    if (months <= 12) return formatCopy(t("readerReliefTimingMedium"), { months });
    const reason = reliefTimingReasonText(node, t);
    if (reason !== t("readerReliefTimingUnknown")) {
      return formatCopy(t("readerReliefTimingLongWithReason"), { months, reason });
    }
    return formatCopy(t("readerReliefTimingLong"), { months });
  }
  if (isAiComputeNode(node) && node.kind === "product") return t("readerReliefTimingLikelyLong");
  return reliefTimingReasonText(node, t);
}

function leadTimeReasonText(answer: LeadTimeAnswer, t: (key: string) => string): string {
  const key = (() => {
    switch (answer.reasonCode) {
      case "capacity_tooling":
        return "readerReliefReasonCapacityTooling";
      case "material_qualification":
        return "readerReliefReasonMaterialQualification";
      case "component_second_source":
        return "readerReliefReasonComponentSecondSource";
      case "regulatory_external":
        return "readerReliefReasonRegulatoryExternal";
      case "economic_validation":
        return "readerReliefReasonEconomicValidation";
      case "engineering_qualification":
        return "readerReliefReasonEngineeringQualification";
      case "early_product":
        return "readerReliefReasonEarlyProduct";
      case "mature_commodity":
        return "readerReliefReasonMatureCommodity";
      case "child_decomposition":
        return "readerReliefReasonChildDecomposition";
      case "default_proxy":
      case "explicit":
      default:
        return "readerReliefReasonDefaultProxy";
    }
  })();
  const localized = t(key);
  return localized === key ? answer.reason : localized;
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

/**
 * First-glance chokepoint readout (docs/ACCEPTANCE.md §3a, ADR-0010).
 *
 * The four structural axes the §2 model scores on are Cost · Dependency
 * (downstream criticality) · Concentration · Barrier. `chokepointScores`
 * already returns quantile-normalized criticality / concentration / barrier
 * (and a composite `score` + structural `incomplete` flag); Cost is
 * deliberately NOT folded into that composite (it is an orthogonal $-overlay),
 * so to pick the *elevated* axis among all four on the same [0,1] footing we
 * normalize node cost the SAME way — an empirical quantile rank over every
 * priced node — using the shared `quantileNormalizer`. The elevated axis is
 * the highest-rank KNOWN axis; the headline then states it as a concrete
 * sentence (a % / count / barrier phrase), never a raw `maturity:` tag.
 *
 * Both the rank (for the comparison) and the human number (for the sentence)
 * are kept: the comparison uses the cross-graph cost rank; the Cost sentence
 * shows the node's share of its product's rolled-up build cost.
 */
type ElevatedAxisKind = "cost" | "criticality" | "concentration" | "barrier";

/** The chokepoint AXES per ADR-0010 / §2 — Cost is excluded (it is the
 *  orthogonal $-overlay, never a chokepoint reason). The "why" line is drawn
 *  only from these. */
const CHOKEPOINT_AXES: ReadonlyArray<Exclude<ElevatedAxisKind, "cost">> = [
  "criticality",
  "concentration",
  "barrier",
];

/** Cost-rank threshold (top quintile) above which the SEPARATE "Cost driver"
 *  line shows — mirrors the band-5 Q80 cutoff so "high cost" reads the same
 *  way the canvas Cost lens does. */
const COST_DRIVER_RANK_FLOOR = 0.8;

type ChokepointHeadline = {
  /** The shared verdict band (authored-override applied) — IDENTICAL to the
   *  canvas band, so the headline verdict can never contradict the canvas. */
  band: 1 | 2 | 3 | 4 | 5;
  verdictKey: "chokepointVerdictChokepoint" | "chokepointVerdictLower";
  structuralRoot: boolean;
  /** The elevated chokepoint axis (∈ CHOKEPOINT_AXES) whose concrete sentence
   *  forms the "why" line; null when no structural axis sentence applies. */
  elevated: Exclude<ElevatedAxisKind, "cost"> | null;
  /** The chokepoint "why" line — a structural-axis sentence, or the authored
   *  "Flagged bottleneck" fallback. NEVER Cost. */
  axisSentence: string | null;
  /** Separate Cost statement (orthogonal to chokepoint-ness), shown only when
   *  the node is a top-quintile cost driver. */
  costSentence: string | null;
  /** Four-axis breakdown for the drill-in: rank in [0,1] or null when unknown. */
  axes: Record<ElevatedAxisKind, number | null>;
};

/** Node rolled-up typical cost (RMB), falling back to a direct/estimated
 *  reading. Null when the node carries no cost signal at all. */
function nodeRolledUpCostRmb(graph: GraphData, node: Node): number | null {
  try {
    const rollup = rollupCost(graph, node.id);
    if (rollup.anyChildContributed || (rollup.directOnly?.typical ?? 0) > 0) {
      return rollup.rolledUp.typical;
    }
  } catch {
    // fall through to the direct/estimated reading
  }
  return nodeCostDriverRmb(node, graph)?.value ?? null;
}

const costRankCache = new WeakMap<GraphData, (nodeId: string) => number | null>();

/** Per-graph memoized cost quantile-rank in [0,1] over every priced node, so
 *  Cost is comparable to the composite's quantile-normalized axes. */
function costRankFor(graph: GraphData): (nodeId: string) => number | null {
  const cached = costRankCache.get(graph);
  if (cached) return cached;
  const costByNode = new Map<string, number>();
  for (const n of graph.nodes) {
    const cost = nodeRolledUpCostRmb(graph, n);
    if (cost !== null && cost > 0) costByNode.set(n.id, cost);
  }
  const norm = quantileNormalizer([...costByNode.values()]);
  const fn = (nodeId: string): number | null => {
    const cost = costByNode.get(nodeId);
    return cost === undefined ? null : norm(cost);
  };
  costRankCache.set(graph, fn);
  return fn;
}

/** Nearest product the node rolls up into (a dependent-ancestor product, or
 *  the node itself when it is a product). Used as the build-cost denominator
 *  for the Cost sentence. */
function buildCostDenominatorRmb(graph: GraphData, node: Node): number | null {
  if (node.kind === "product") return nodeRolledUpCostRmb(graph, node);
  let best: { cost: number } | null = null;
  for (const ancestorId of dependentAncestors(graph, node.id)) {
    const ancestor = nodeById(graph, ancestorId);
    if (ancestor?.kind !== "product") continue;
    const cost = nodeRolledUpCostRmb(graph, ancestor);
    if (cost !== null && cost > 0 && (!best || cost > best.cost)) best = { cost };
  }
  return best?.cost ?? null;
}

const ELEVATED_AXIS_LABEL_KEY: Record<ElevatedAxisKind, string> = {
  cost: "chokepointAxisLabelCost",
  criticality: "chokepointAxisLabelCriticality",
  concentration: "chokepointAxisLabelConcentration",
  barrier: "chokepointAxisLabelBarrier",
};

function barrierDetailKey(node: Node): "chokepointBarrierMustBuild" | "chokepointBarrierHardToReplicate" {
  if (node.transactability === "must_build") return "chokepointBarrierMustBuild";
  return "chokepointBarrierHardToReplicate";
}

/** Build the concrete elevated-axis sentence for the headline. */
function elevatedAxisSentence(
  graph: GraphData,
  node: Node,
  axis: ElevatedAxisKind,
  t: (key: string) => string,
): string | null {
  switch (axis) {
    case "cost": {
      const own = nodeRolledUpCostRmb(graph, node);
      const denom = buildCostDenominatorRmb(graph, node);
      if (own === null || denom === null || denom <= 0) return null;
      const pct = Math.max(1, Math.round((own / denom) * 100));
      return formatCopy(t("chokepointAxisCost"), { value: pct });
    }
    case "criticality": {
      const count = directDependents(graph, node.id).length;
      if (count <= 0) return null;
      return formatCopy(t("chokepointAxisCriticality"), { count });
    }
    case "concentration": {
      const { total } = holdersForNode(graph, node.id);
      if (total <= 0) return t("chokepointAxisConcentrationGap");
      return formatCopy(t("chokepointAxisConcentration"), { count: total });
    }
    case "barrier":
      return formatCopy(t("chokepointAxisBarrier"), { detail: t(barrierDetailKey(node)) });
  }
}

function concreteMechanismSentence(graph: GraphData, node: Node, t: (key: string) => string): string | null {
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  if (factors.length > 0) return factors.slice(0, 3).join(" · ");
  const decompositionSignals = decompositionConstraintSignals(graph, node, t);
  if (decompositionSignals.length > 0) return decompositionSignals.slice(0, 3).join(" · ");
  return null;
}

function chokepointHeadlineFor(
  graph: GraphData,
  node: Node,
  t: (key: string) => string,
): ChokepointHeadline {
  const result: ChokepointResult | undefined = chokepointScores(graph).get(node.id);
  // The SHARED verdict band (authored `bottleneckOf` ⇒ band 5) — the same
  // function the canvas edge/sector/top-N read, so the headline verdict can
  // never contradict the canvas (docs/ACCEPTANCE.md §3b).
  const band = chokepointVerdictBandFor(graph)(node.id);
  const costRank = costRankFor(graph)(node.id);
  const axes: Record<ElevatedAxisKind, number | null> = {
    cost: costRank,
    criticality: result?.axes.criticality ?? null,
    concentration: result?.axes.concentration ?? null,
    barrier: result?.axes.barrier ?? null,
  };
  // Binary verdict: only the warmest band is a "Chokepoint"; everything else
  // reads "Not a top chokepoint". (§3a: the verdict label comes from the band,
  // never from Cost.)
  const verdictKey =
    band >= 5 ? "chokepointVerdictChokepoint" : "chokepointVerdictLower";
  // Cost is the orthogonal $-overlay — a SEPARATE statement, shown only when
  // the node is a top-quintile cost driver, independent of chokepoint-ness.
  const costSentence =
    costRank !== null && costRank >= COST_DRIVER_RANK_FLOOR
      ? elevatedAxisSentence(graph, node, "cost", t)
      : null;
  // Product / root nodes are structurally `incomplete` (criticality is unknown
  // because nothing downstream depends on a top-level product) — they are not
  // themselves chokepoints, so we say so rather than inventing an elevated axis.
  // The verdict is forced to "Not a top chokepoint" so it cannot contradict the
  // "Structural root · not itself a chokepoint" why-line (a root product can
  // otherwise land in band 5 of its OWN composite distribution).
  const structuralRoot = node.kind === "product" && Boolean(result?.incomplete);
  if (structuralRoot) {
    return {
      band,
      verdictKey: "chokepointVerdictLower",
      structuralRoot: true,
      elevated: null,
      axisSentence: null,
      costSentence,
      axes,
    };
  }
  // The chokepoint "why" line is drawn ONLY from the chokepoint axes
  // {criticality, concentration, barrier} — never Cost (§3a). Walk
  // highest-rank-first; skip an axis whose concrete sentence can't be built
  // (e.g. criticality rank present but fan-in 0).
  const known = CHOKEPOINT_AXES.map((axis) => ({ axis, rank: axes[axis] }))
    .filter((entry): entry is { axis: Exclude<ElevatedAxisKind, "cost">; rank: number } => entry.rank !== null)
    .sort((a, b) => b.rank - a.rank);
  for (const { axis } of known) {
    const sentence = elevatedAxisSentence(graph, node, axis, t);
    if (sentence) {
      if (axis === "concentration" && sentence !== t("chokepointAxisConcentrationGap")) {
        const concrete = concreteMechanismSentence(graph, node, t);
        if (concrete) {
          return { band, verdictKey, structuralRoot: false, elevated: null, axisSentence: concrete, costSentence, axes };
        }
      }
      if (axis === "barrier") {
        const decompositionSignals = decompositionConstraintSignals(graph, node, t);
        if (decompositionSignals.length > 0) {
          return {
            band,
            verdictKey,
            structuralRoot: false,
            elevated: "barrier",
            axisSentence: decompositionSignals.slice(0, 3).join(" · "),
            costSentence,
            axes,
          };
        }
      }
      if (sentence === t("chokepointAxisConcentrationGap")) {
        const concrete = concreteMechanismSentence(graph, node, t);
        if (concrete) {
          return { band, verdictKey, structuralRoot: false, elevated: null, axisSentence: concrete, costSentence, axes };
        }
        return { band, verdictKey, structuralRoot: false, elevated: "concentration", axisSentence: sentence, costSentence, axes };
      }
      if (axis === "barrier") {
        const concrete = concreteMechanismSentence(graph, node, t);
        if (concrete) {
          return { band, verdictKey, structuralRoot: false, elevated: axis, axisSentence: concrete, costSentence, axes };
        }
      }
      return { band, verdictKey, structuralRoot: false, elevated: axis, axisSentence: sentence, costSentence, axes };
    }
  }
  // No structural axis sentence available. If the node is an authored
  // bottleneck, state the authored claim rather than borrowing Cost as a
  // reason ("Flagged bottleneck"); otherwise leave the why-line empty.
  const authoredFallback =
    (node.bottleneckOf?.length ?? 0) > 0 ? t("chokepointVerdictFlagged") : null;
  if (authoredFallback) {
    return { band, verdictKey, structuralRoot: false, elevated: null, axisSentence: authoredFallback, costSentence, axes };
  }
  return { band, verdictKey, structuralRoot: false, elevated: null, axisSentence: authoredFallback, costSentence, axes };
}

/**
 * First-glance chokepoint headline. Rendered at the TOP of the reader-priority
 * surface and NOT gated on the canvas `colorMode`, so it persists across lens
 * switch and node drill (docs/ACCEPTANCE.md §1 "Sustained"). The `graph` is the
 * same scope the canvas/lens colors with (the rail is mounted with
 * `workingGraph`), so the verdict here matches the node's canvas coloring.
 */
export function ChokepointHeadline({ graph, node }: { graph: GraphData; node: Node }) {
  const { t } = useLanguage();
  const headline = chokepointHeadlineFor(graph, node, t);
  const verdict = t(headline.verdictKey);
  // The chokepoint "why" line: structural-root copy, a structural-axis
  // sentence, or the authored "Flagged bottleneck" fallback — NEVER Cost.
  const whyLine = headline.structuralRoot ? t("chokepointStructuralRoot") : headline.axisSentence;
  return (
    <div
      className="detail-decision-tile tone-verdict detail-chokepoint-headline"
      data-testid="detail-chokepoint-headline"
      data-chokepoint-band={headline.band}
      data-elevated-axis={headline.elevated ?? (headline.structuralRoot ? "structural-root" : "none")}
    >
      <span className="detail-core-tile-label">{t("detailChokepointVerdict")}</span>
      <span className="detail-chokepoint-verdict">{verdict}</span>
      {whyLine ? <strong className="detail-chokepoint-axis">{whyLine}</strong> : null}
      {/* Cost is the orthogonal $-overlay — its OWN line, separate from the
          chokepoint verdict/why (§3a). */}
      {headline.costSentence ? (
        <small className="detail-chokepoint-cost" data-testid="detail-chokepoint-cost">
          {headline.costSentence}
        </small>
      ) : null}
    </div>
  );
}

/** Four-axis model breakdown for the collapsed diagnostic appendix. */
function ChokepointAxisBreakdown({ graph, node }: { graph: GraphData; node: Node }) {
  const { t } = useLanguage();
  const headline = chokepointHeadlineFor(graph, node, t);
  const order: ElevatedAxisKind[] = ["cost", "criticality", "concentration", "barrier"];
  return (
    <div className="detail-chokepoint-axes" data-testid="detail-chokepoint-axes">
      <span className="detail-reader-mini-heading">{t("chokepointBreakdownTitle")}</span>
      <dl className="detail-chokepoint-axes-grid">
        {order.map((axis) => {
          const rank = headline.axes[axis];
          const known = rank !== null;
          return (
            <div key={axis} data-axis={axis} data-axis-known={known ? "true" : "false"}>
              <dt>{t(ELEVATED_AXIS_LABEL_KEY[axis])}</dt>
              <dd>{known ? `${Math.round(rank * 100)}/100` : t("chokepointAxisUnknown")}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function NodeCoreReadoutBrief({
  graph,
  node,
  className,
  testId = "detail-decision-brief",
}: {
  graph: GraphData;
  node: Node;
  className?: string;
  testId?: string;
}) {
  const { t } = useLanguage();
  const readout = coreReadoutForNode(graph, node);
  const statusParts = [t(CORE_READOUT_STATUS_LABEL_KEYS[readout.status.value])];
  if (readout.status.months !== undefined) {
    statusParts.push(formatCopy(t("coreReadoutMonthsSuffix"), { months: readout.status.months }));
  }
  return (
    <div className={["detail-decision-brief", className].filter(Boolean).join(" ")} data-testid={testId}>
      <strong>{t("detailCoreReadout")}</strong>
      <div className="detail-decision-grid">
        <div
          className="detail-decision-tile tone-scope"
          data-readout-basis={readout.scope.basis}
          data-readout-value={readout.scope.value}
        >
          <span>{t(CORE_READOUT_FIELD_LABEL_KEYS.scope)}</span>
          <strong>{t(CORE_READOUT_SCOPE_LABEL_KEYS[readout.scope.value])}</strong>
        </div>
        <div
          className="detail-decision-tile tone-substitution"
          data-readout-basis={readout.substitution.basis}
          data-readout-value={readout.substitution.value}
        >
          <span>{t(CORE_READOUT_FIELD_LABEL_KEYS.substitution)}</span>
          <strong>{t(CORE_READOUT_SUBSTITUTION_LABEL_KEYS[readout.substitution.value])}</strong>
        </div>
        <div
          className="detail-decision-tile tone-blocking"
          data-readout-basis={readout.blocking.basis}
          data-readout-value={readout.blocking.values.join(" ")}
        >
          <span>{t(CORE_READOUT_FIELD_LABEL_KEYS.blocking)}</span>
          <strong>
            {readout.blocking.values.map((value) => t(CORE_READOUT_BLOCKING_LABEL_KEYS[value])).join(" · ")}
          </strong>
        </div>
        <div
          className="detail-decision-tile tone-status"
          data-readout-basis={readout.status.basis}
          data-readout-value={readout.status.value}
        >
          <span>{t(CORE_READOUT_FIELD_LABEL_KEYS.status)}</span>
          <strong>{statusParts.join(" · ")}</strong>
        </div>
      </div>
    </div>
  );
}

function NodeReaderPriority({
  graph,
  node,
  evidence,
  lockedEntry,
  lockedExposureMode,
  showExposureSummary,
  defaultOpenExposureSummary,
  beforeEvidence,
}: {
  graph: GraphData;
  node: Node;
  evidence: Evidence[];
  lockedEntry: LockedDomainSummary | null;
  lockedExposureMode: LockedExposureMode;
  showExposureSummary: boolean;
  defaultOpenExposureSummary: boolean;
  beforeEvidence?: React.ReactNode;
}) {
  const { language, nodeDescription, nodeName, t } = useLanguage();
  const quickPath = evidenceQuickPathForNode(graph, node, evidence, t);
  // FF-3 (Gate F): resolve the zh description body (falling back to English)
  // so the Detail-tab 核心判断 / 节点解读 render Chinese in zh mode.
  const localizedDescription = language === "zh"
    ? nodeDescription(node.id, node.description ?? "") || node.description
    : node.description;
  return (
    <section className="detail-reader-priority" data-testid="detail-reader-priority">
      <NodeCoreReadoutBrief graph={graph} node={node} />
      <div className="detail-reader-role detail-reader-section" data-testid="detail-bottleneck-thesis">
        <span>{t("detailNodeInterpretation")}</span>
        <p>{detailBottleneckThesisText(graph, node, nodeName, t, evidence, localizedDescription)}</p>
      </div>
      {beforeEvidence}
      <div className="detail-reader-role detail-reader-section detail-evidence-card" data-testid="detail-evidence-summary">
        <span>{t("detailEvidenceTrail")}</span>
        <p>{quickPath.text}</p>
      </div>
      {showExposureSummary ? (
        <ExposureEvidenceSummary
          graph={graph}
          node={node}
          lockedEntry={lockedEntry}
          lockedExposureMode={lockedExposureMode}
          defaultOpen={defaultOpenExposureSummary}
        />
      ) : null}
    </section>
  );
}

const EXPOSURE_ORG_RELATIONS = [
  "manufactured_by",
  "implemented_by",
  "qualified_supplier",
  "reported_capable_supplier",
  "strategic_supplier_to",
  "capacity_provider",
  "second_source_candidate",
] as const;
const EXPOSURE_ROLLUP_RELATIONS = ["requires", "part_of", "has_route", "implemented_by"] as const;
const EXPOSURE_ROLLUP_MAX_DEPTH = 4;

type ExposureOrgRelation = (typeof EXPOSURE_ORG_RELATIONS)[number];

type ExposureCandidate = {
  organization: Node;
  edge: Edge | null;
  relation: ExposureOrgRelation | "organization";
  viaNode: Node | null;
  depth: number;
  sourceRank: number;
};

type EvidenceQuickPath = {
  text: string;
  viaNode: Node | null;
};

function evidenceRank(item: Evidence, index: number): number {
  const review = item.reviewStatus === "reviewed" ? 0 : item.reviewStatus === "disputed" ? 2 : 1;
  const sourceStatus = item.sourceStatus === "ok_exact" ? 0 : item.sourceStatus === "fetch_ok" ? 1 : 2;
  const typeRank = item.type === "standard" ||
    item.type === "paper" ||
    item.type === "regulatory_approval" ||
    item.type === "expert_review" ||
    item.type === "benchmark" ||
    item.type === "field_case"
    ? 0
    : item.type === "vendor_claim" || item.type === "news"
      ? 2
      : 1;
  const confidence = item.confidence === "high" ? 0 : item.confidence === "medium" ? 1 : 2;
  return review * 100_000 + sourceStatus * 10_000 + typeRank * 1_000 + confidence * 100 + index;
}

function strongestEvidence(evidence: Evidence[]): Evidence | null {
  const active = evidence.filter((item) => item.reviewStatus !== "deprecated");
  if (active.length === 0) return null;
  return active
    .map((item, index) => ({ item, rank: evidenceRank(item, index) }))
    .sort((left, right) => left.rank - right.rank)[0]?.item ?? null;
}

function evidenceQualityText(item: Evidence): string {
  return [
    item.type.replace(/_/g, " "),
    item.sourceName,
    item.confidence ? `${item.confidence} confidence` : null,
  ].filter(Boolean).join(" · ");
}

function evidenceReaderSummary(item: Evidence, total: number, t: (key: string) => string): string {
  const limitation = readerFacingNote(item.limitations);
  const prefix = total > 1
    ? `${formatCopy(t("evidenceDirectSourceSummary"), { total })} `
    : `${t("evidenceDirectSourceSummarySingular")} `;
  const sourceText = formatCopy(t("evidenceStrongestSource"), {
    title: item.title,
    quality: evidenceQualityText(item),
  });
  const limitText = limitation ? ` ${formatCopy(t("evidenceLimitation"), { limitation })}` : "";
  return `${prefix}${sourceText}${limitText}`;
}

function ExposureEvidenceSummary({
  graph,
  node,
  lockedEntry,
  lockedExposureMode,
  defaultOpen,
}: {
  graph: GraphData;
  node: Node;
  lockedEntry: LockedDomainSummary | null;
  lockedExposureMode: LockedExposureMode;
  defaultOpen: boolean;
}) {
  const { nodeName, relationName, t } = useLanguage();
  const candidates = lockedEntry ? [] : exposureCandidatesForNode(graph, node, 3);
  const isAuditPreviewLocked = Boolean(lockedEntry && lockedExposureMode === "audit-preview");
  const summaryTitle = isAuditPreviewLocked ? t("exposureEvidencePolicyTitle") : t("exposureEvidenceSummaryTitle");
  const candidateHeading = isAuditPreviewLocked ? t("exposureCandidateAuditHeading") : t("exposureCandidateHeading");
  const candidateHint = isAuditPreviewLocked ? t("exposureCandidateAuditHint") : t("exposureCandidateHint");
  return (
    <section
      className={["detail-reader-exposure-evidence", defaultOpen ? "point-of-need" : ""].filter(Boolean).join(" ")}
      data-point-of-need={defaultOpen ? "true" : undefined}
      data-testid="detail-exposure-evidence-summary"
    >
      <div className="detail-reader-exposure-head">
        <strong>{summaryTitle}</strong>
        <span className="muted">
          {candidates.length > 0
            ? formatCopy(t("exposureCandidateCount"), { n: String(candidates.length) })
            : candidateHeading}
        </span>
      </div>
      <div className="detail-reader-exposure-grid">
        <span className="detail-reader-mini-heading">{candidateHeading}</span>
        <p className="muted">{candidateHint}</p>
        {candidates.length > 0 ? (
          <ul className="metric-detail-list detail-supplier-card-list">
            {candidates.map((candidate, index) => (
              <SupplierLeadCard
                key={`${candidate.organization.id}-${candidate.edge?.id ?? "self"}`}
                graph={graph}
                candidate={candidate}
                defaultOpen={defaultOpen && index === 0}
                nodeName={nodeName}
                relationName={relationName}
                t={t}
              />
            ))}
          </ul>
        ) : lockedEntry ? (
          <p className="muted">
            {formatCopy(
              t(
                lockedExposureMode === "audit-preview"
                  ? "exposureCandidateAuditPreviewFallback"
                  : "exposureCandidateLockedFallback",
              ),
              { n: lockedEntry.hiddenOrgCount },
            )}
          </p>
        ) : (
          <p className="muted">{t("exposureCandidateFallback")}</p>
        )}
      </div>
    </section>
  );
}

function SupplierLeadCard({
  graph,
  candidate,
  defaultOpen,
  nodeName,
  relationName,
  t,
}: {
  graph: GraphData;
  candidate: ExposureCandidate;
  defaultOpen: boolean;
  nodeName: (id: string, fallback: string) => string;
  relationName: (relation: string) => string;
  t: (key: string) => string;
}) {
  const displayName = nodeName(candidate.organization.id, candidate.organization.name);
  const position = supplierChainPositionText(candidate, nodeName, t);
  const associationBasis = supplierAssociationBasisText(candidate, nodeName, relationName, t);
  const evidenceLinks = evidenceForEdge(graph, candidate.edge);
  const evidenceLimitations = supplierEvidenceLimitations(evidenceLinks);
  const sourceCheck = supplierSourceCheckText(evidenceLinks, t);
  const metricSummary = organizationMetricSummary(candidate.organization, {
    includeDescriptions: false,
    limit: 2,
  });
  const bomStatus = candidate.edge ? t("supplierBomCandidate") : t("supplierBomSelf");
  return (
    <li className="metric-detail-row detail-supplier-card" data-testid="supplier-company-card">
      <details open={defaultOpen}>
        <summary>
          <div className="detail-supplier-card-head">
            <span>{displayName}</span>
            <ListingChip org={candidate.organization} />
          </div>
          <dl className="detail-supplier-card-collapsed">
            <div>
              <dt>{t("supplierChainPosition")}</dt>
              <dd>{position}</dd>
            </div>
            <div>
              <dt>{t("supplierAssociationBasis")}</dt>
              <dd>{associationBasis}</dd>
            </div>
          </dl>
        </summary>
        <div className="details-body detail-supplier-card-expanded">
          <div>
            <span className="detail-reader-mini-heading">{t("supplierEvidenceLinks")}</span>
            {evidenceLinks.length > 0 ? (
              <ul>
                {evidenceLinks.map((item) => (
                  <li key={item.id}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                    {item.sourceName ? <span className="muted"> · {item.sourceName}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("supplierEvidenceMissing")}</p>
            )}
          </div>
          <div>
            <span className="detail-reader-mini-heading">{t("supplierTrustContext")}</span>
            <dl className="detail-supplier-card-collapsed">
              <div>
                <dt>{t("supplierRelationshipType")}</dt>
                <dd>{supplierRelationTypeText(candidate, relationName)}</dd>
              </div>
              <div>
                <dt>{t("supplierRelationshipConfidence")}</dt>
                <dd>{supplierConfidenceText(candidate.edge, t)}</dd>
              </div>
              <div>
                <dt>{t("supplierReviewState")}</dt>
                <dd>{supplierReviewStateText(candidate.edge, t)}</dd>
              </div>
              <div>
                <dt>{t("supplierEvidenceSourceCheck")}</dt>
                <dd>{sourceCheck}</dd>
              </div>
            </dl>
          </div>
          {evidenceLimitations ? (
            <div>
              <span className="detail-reader-mini-heading">{t("supplierEvidenceLimitations")}</span>
              <p className="muted">{evidenceLimitations}</p>
            </div>
          ) : null}
          {metricSummary ? (
            <div>
              <span className="detail-reader-mini-heading">{t("supplierFinancialCapacityClues")}</span>
              <p className="muted">{metricSummary}</p>
            </div>
          ) : null}
          <div>
            <span className="detail-reader-mini-heading">{t("supplierBomStatus")}</span>
            <p className="muted">{bomStatus}</p>
          </div>
        </div>
      </details>
    </li>
  );
}

function evidenceForEdge(graph: GraphData, edge: Edge | null): Evidence[] {
  if (!edge?.evidenceIds?.length) return [];
  const byId = new Map(graph.evidence.map((item) => [item.id, item]));
  return edge.evidenceIds
    .map((id) => byId.get(id))
    .filter((item): item is Evidence => Boolean(item && item.reviewStatus !== "deprecated"));
}

function supplierRelationTypeText(
  candidate: ExposureCandidate,
  relationName: (relation: string) => string,
): string {
  if (candidate.relation === "organization") return relationName(candidate.relation);
  const label = relationName(candidate.relation);
  return label.includes("_") ? label.replace(/_/g, " ") : label;
}

function supplierConfidenceText(edge: Edge | null, t: (key: string) => string): string {
  switch (edge?.confidence) {
    case "high":
      return t("supplierConfidenceHigh");
    case "medium":
      return t("supplierConfidenceMedium");
    case "low":
      return t("supplierConfidenceLow");
    default:
      return t("supplierConfidenceMissing");
  }
}

function supplierReviewStateText(edge: Edge | null, t: (key: string) => string): string {
  switch (edge?.reviewStatus) {
    case "reviewed":
      return t("supplierReviewReviewed");
    case "disputed":
      return t("supplierReviewDisputed");
    case "deprecated":
      return t("supplierReviewDeprecated");
    case "unreviewed":
    default:
      return t("supplierReviewNeedsHuman");
  }
}

function supplierSourceCheckText(evidence: Evidence[], t: (key: string) => string): string {
  if (evidence.length === 0) return t("supplierSourceCheckNotChecked");
  const verified = evidence.filter((item) => item.machineCheck?.status === "verified").length;
  if (verified > 0) return formatCopy(t("supplierSourceCheckVerified"), { n: verified });
  const failed = evidence.filter((item) => item.machineCheck?.status === "failed").length;
  if (failed > 0) return formatCopy(t("supplierSourceCheckFailed"), { n: failed });
  const needsFetch = evidence.filter((item) => item.machineCheck?.status === "needs_fetch").length;
  if (needsFetch > 0) return formatCopy(t("supplierSourceCheckNeedsFetch"), { n: needsFetch });
  return t("supplierSourceCheckNotChecked");
}

function supplierEvidenceLimitations(evidence: Evidence[]): string | null {
  const limitations = [...new Set(evidence.map((item) => item.limitations?.trim()).filter(Boolean) as string[])];
  if (limitations.length === 0) return null;
  const visible = limitations.slice(0, 2);
  const suffix = limitations.length > visible.length ? ` +${limitations.length - visible.length}` : "";
  return `${visible.join(" ")}${suffix}`;
}

function supplierChainPositionText(
  candidate: ExposureCandidate,
  nodeName: (id: string, fallback: string) => string,
  t: (key: string) => string,
): string {
  const viaNode = candidate.viaNode ? nodeName(candidate.viaNode.id, candidate.viaNode.name) : null;
  const key = (() => {
    switch (candidate.relation) {
      case "implemented_by":
        return viaNode ? "supplierPositionServiceVia" : "supplierPositionService";
      case "strategic_supplier_to":
        return viaNode ? "supplierPositionStrategicVia" : "supplierPositionStrategic";
      case "capacity_provider":
        return viaNode ? "supplierPositionCapacityVia" : "supplierPositionCapacity";
      case "organization":
        return "supplierPositionSelf";
      case "manufactured_by":
      case "qualified_supplier":
      case "reported_capable_supplier":
      case "second_source_candidate":
      default:
        return viaNode ? "supplierPositionManufacturerVia" : "supplierPositionManufacturer";
    }
  })();
  return viaNode ? formatCopy(t(key), { node: viaNode }) : t(key);
}

function supplierAssociationBasisText(
  candidate: ExposureCandidate,
  nodeName: (id: string, fallback: string) => string,
  relationName: (relation: string) => string,
  t: (key: string) => string,
): string {
  const claim = candidate.edge?.claim?.trim();
  if (claim) return claim;
  const context = candidate.edge?.context?.trim();
  if (context) return context;
  if (candidate.viaNode) {
    return formatCopy(t("supplierAssociationVia"), {
      node: nodeName(candidate.viaNode.id, candidate.viaNode.name),
    });
  }
  if (candidate.relation === "organization") return t("supplierAssociationSelf");
  return formatCopy(t("supplierAssociationRelation"), {
    relation: relationName(candidate.relation),
  });
}

function exposureCandidatesForNode(graph: GraphData, node: Node, limit: number): ExposureCandidate[] {
  const candidates: ExposureCandidate[] = [];
  const addCandidate = (candidate: ExposureCandidate) => {
    if (candidate.organization.reviewStatus === "deprecated") return;
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

  const rollupSources = exposureRollupSources(graph, node);
  for (const { child, depth, rank } of rollupSources) {
    for (const edge of organizationEdgesFromSource(graph, child.id)) {
      const organization = nodeById(graph, edge.target);
      if (!organization || organization.kind !== "organization") continue;
      addCandidate({
        organization,
        edge,
        relation: edge.relation as ExposureOrgRelation,
        viaNode: child,
        depth,
        sourceRank: rank,
      });
    }
  }

  return candidates
    .sort((a, b) => exposureCandidateRank(graph, node, a) - exposureCandidateRank(graph, node, b))
    .filter((candidate, index, sorted) =>
      sorted.findIndex((entry) => entry.organization.id === candidate.organization.id) === index)
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

function exposureRollupSources(
  graph: GraphData,
  node: Node,
  maxDepth = EXPOSURE_ROLLUP_MAX_DEPTH,
): Array<{ child: Node; depth: number; rank: number }> {
  const sources: Array<{ child: Node; depth: number; rank: number }> = [];
  const visited = new Set<string>([node.id]);
  const queue: Array<{ current: Node; depth: number; pathRank: number }> = [{ current: node, depth: 0, pathRank: 0 }];
  let traversalRank = 0;

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry || entry.depth >= maxDepth) continue;

    const next = graph.edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => edge.source === entry.current.id && edge.reviewStatus !== "deprecated")
      .filter(({ edge }) => EXPOSURE_ROLLUP_RELATIONS.includes(edge.relation as (typeof EXPOSURE_ROLLUP_RELATIONS)[number]))
      .map(({ edge, index }) => ({ child: nodeById(graph, edge.target), index }))
      .filter((candidate): candidate is { child: Node; index: number } => Boolean(candidate.child))
      .filter(({ child }) => child.reviewStatus !== "deprecated")
      .filter(({ child }) => child.kind !== "organization" && child.kind !== "metric" && child.kind !== "evidence")
      .sort((a, b) => exposureSourceRank(entry.current, a.child, a.index) - exposureSourceRank(entry.current, b.child, b.index));

    for (const { child, index } of next) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      const depth = entry.depth + 1;
      const rank = entry.pathRank + depth * 1_000 + traversalRank + index / 1_000;
      traversalRank += 1;
      sources.push({ child, depth, rank });
      queue.push({ current: child, depth, pathRank: rank });
    }
  }

  return sources.sort((a, b) => a.rank - b.rank);
}

function exposureSourceRank(parent: Node, child: Node, index: number): number {
  const bottleneckBoost = child.bottleneckOf?.includes(parent.id) ? 0 : 1;
  const maturity = typeof child.maturityScore === "number" ? child.maturityScore : 101;
  return bottleneckBoost * 10_000 + maturity * 100 + index;
}

function exposureCandidateRank(graph: GraphData, node: Node, candidate: ExposureCandidate): number {
  const relation = exposureRelationRank(candidate.relation) * 10_000;
  const depth = candidate.depth * 1_000;
  const source = candidate.sourceRank * 10;
  const listing = listingInfoForOrg(candidate.organization);
  const listingPenalty = listing.ticker || listing.status !== "unknown" ? 0 : 500;
  const edgeIndex = candidate.edge ? graph.edges.findIndex((edge) => edge.id === candidate.edge?.id) : 0;
  const stableEdge = edgeIndex >= 0 ? edgeIndex : graph.edges.length;
  const selfPenalty = candidate.organization.id === node.id ? -1_000 : 0;
  return relation + depth + source + listingPenalty + stableEdge + selfPenalty;
}

function exposureRelationRank(relation: ExposureCandidate["relation"]): number {
  switch (relation) {
    case "manufactured_by":
      return 0;
    case "qualified_supplier":
      return 1;
    case "reported_capable_supplier":
      return 2;
    case "strategic_supplier_to":
      return 3;
    case "capacity_provider":
      return 4;
    case "second_source_candidate":
      return 20;
    case "implemented_by":
      return 25;
    case "organization":
    default:
      return 30;
  }
}

function evidenceQuickPathForNode(
  graph: GraphData,
  node: Node,
  evidence: Evidence[],
  t: (key: string) => string,
): EvidenceQuickPath {
  const directEvidence = evidence.filter((item) => item.reviewStatus !== "deprecated");
  const strongestDirect = strongestEvidence(directEvidence);
  if (strongestDirect) {
    return {
      text: evidenceReaderSummary(strongestDirect, directEvidence.length, t),
      viaNode: null,
    };
  }

  const nearest = nearestEvidenceForNode(graph, node);
  if (nearest) {
    return {
      text: `${formatCopy(t("evidenceNearestTitle"), { title: nearest.evidence.title })} (${evidenceQualityText(nearest.evidence)}).${
        nearest.evidence.limitations ? ` ${formatCopy(t("evidenceLimitation"), { limitation: readerFacingNote(nearest.evidence.limitations) })}` : ""
      }`,
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
  for (const { child, rank } of exposureRollupSources(graph, node, 2)) {
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

const DECOMPOSITION_RELATIONS = new Set<Edge["relation"]>(["requires", "has_route", "implemented_by"]);
const NON_DECOMPOSITION_CHILD_KINDS = new Set<Node["kind"]>([
  "organization",
  "metric",
  "evidence",
  "bottleneck",
  "placeholder_breakthrough",
  "standard_or_regulation",
]);

type DecompositionEntry = {
  edge: Edge;
  child: Node;
  reason: string;
};

function directDecompositionEntries(
  graph: GraphData,
  node: Node,
  language: "en" | "zh",
  nodeDescription: (id: string, fallback: string) => string,
  t: (key: string) => string,
): DecompositionEntry[] {
  return graph.edges
    .filter((edge) => edge.source === node.id && edge.reviewStatus !== "deprecated" && DECOMPOSITION_RELATIONS.has(edge.relation))
    .map((edge) => ({ edge, child: nodeById(graph, edge.target) }))
    .filter((entry): entry is { edge: Edge; child: Node } => Boolean(entry.child))
    .filter(({ child }) => child.reviewStatus !== "deprecated" && !NON_DECOMPOSITION_CHILD_KINDS.has(child.kind))
    .map(({ edge, child }) => ({
      edge,
      child,
      reason: decompositionChildReason(node, child, edge, language, nodeDescription, t),
    }));
}

function decompositionChildReason(
  parent: Node,
  child: Node,
  edge: Edge,
  language: "en" | "zh",
  nodeDescription: (id: string, fallback: string) => string,
  t: (key: string) => string,
): string {
  const aiComputeReason = aiComputeFirstLayerReason(parent.id, child.id, t);
  if (aiComputeReason) return aiComputeReason;
  if (language !== "zh" && edge.claim?.trim()) return sentenceClause(edge.claim.trim());
  const localized = nodeDescription(child.id, child.description ?? "");
  const first = firstSentenceDescription(localized);
  if (first) return first;
  if (edge.claim?.trim()) return sentenceClause(edge.claim.trim());
  return t("decompositionRationaleGenericChildReason");
}

function aiComputeFirstLayerReason(parentId: string, childId: string, t: (key: string) => string): string | null {
  if (parentId !== "ai_accelerator_module_hbm_cowos") return null;
  const keyByChild: Record<string, string> = {
    logic_die_fabrication: "decompositionAiComputeLogic",
    advanced_packaging: "decompositionAiComputePackaging",
    high_bandwidth_memory: "decompositionAiComputeHbm",
    substrate_and_interposer: "decompositionAiComputeSubstrate",
    interconnect_and_optics: "decompositionAiComputeInterconnect",
    power_delivery: "decompositionAiComputePower",
    thermal_cooling: "decompositionAiComputeThermal",
  };
  const key = keyByChild[childId];
  return key ? t(key) : null;
}

function decompositionConstraintSignals(graph: GraphData, node: Node, t: (key: string) => string): string[] {
  const special: Record<string, string[]> = {
    ai_accelerator_module_hbm_cowos: [
      t("readerAiComputeStuckHbmCapacity"),
      t("readerAiComputeStuckPackagingCapacity"),
      t("readerAiComputeStuckYieldLearning"),
      t("readerAiComputeStuckSupplierConcentration"),
    ],
    logic_die_fabrication: [t("decompositionSignalFoundry"), t("decompositionSignalEuv"), t("decompositionSignalYield")],
    advanced_packaging: [t("decompositionSignalCowos"), t("decompositionSignalBonding"), t("decompositionSignalInspection")],
    high_bandwidth_memory: [t("decompositionSignalHbmSupply"), t("decompositionSignalHbmAssembly"), t("decompositionSignalHbmTest")],
    substrate_and_interposer: [t("decompositionSignalOrganicSubstrate"), t("decompositionSignalInterposer"), t("decompositionSignalPdn")],
    interconnect_and_optics: [t("decompositionSignalSerdes"), t("decompositionSignalOptics"), t("decompositionSignalCopper")],
    power_delivery: [t("decompositionSignalVrm"), t("decompositionSignalPowerStage"), t("decompositionSignal48v")],
    thermal_cooling: [t("decompositionSignalColdPlate"), t("decompositionSignalLiquidLoop"), t("decompositionSignalCdu")],
  };
  const signals = special[node.id];
  if (signals) return signals;
  const childNames = graph.edges
    .filter((edge) => edge.source === node.id && edge.relation === "requires" && edge.reviewStatus !== "deprecated")
    .map((edge) => nodeById(graph, edge.target))
    .filter((child): child is Node => Boolean(child && child.reviewStatus !== "deprecated" && !NON_DECOMPOSITION_CHILD_KINDS.has(child.kind)))
    .slice(0, 3)
    .map((child) => child.name);
  return childNames;
}

function DecompositionRationalePanel({
  graph,
  node,
  onSelectNode,
}: {
  graph: GraphData;
  node: Node;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { language, nodeDescription, nodeName, relationName, t } = useLanguage();
  const entries = useMemo(
    () => directDecompositionEntries(graph, node, language, nodeDescription, t),
    [graph, language, node, nodeDescription, t],
  );
  const isFrontier = isDecompositionFrontier(graph, node);
  if (entries.length === 0 && !isFrontier) return null;
  const summary = node.id === "ai_accelerator_module_hbm_cowos"
    ? t("decompositionRationaleAiComputeSummary")
    : entries.length > 0
      ? t("decompositionRationaleSummary")
      : t("decompositionRationaleFrontierSummary");
  return (
    <div className="detail-decomposition-rationale" data-testid="detail-decomposition-rationale">
      <div className="detail-decomposition-head">
        <strong>{t("detailDecomposition")}</strong>
        {entries.length > 0 ? (
          <span>{formatCopy(t("decompositionRationaleChildCount"), { count: entries.length })}</span>
        ) : null}
      </div>
      <p>{summary}</p>
      {entries.length > 0 ? (
        <ul className="detail-decomposition-list detail-decomposition-table">
          {entries.map(({ child, edge, reason }) => (
            <li key={edge.id}>
              <div className="detail-decomposition-item-head">
                <NodeListLink node={child} displayName={nodeName(child.id, child.name)} onSelectNode={onSelectNode} />
                <span>{relationName(edge.relation)}</span>
              </div>
              <p>{reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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

function readerFacingCandidateSignal(
  node: Node,
  source: RankedInspectCandidate["source"],
  t: (key: string) => string,
): string {
  if (source === "explicit") return t("bottleneckBadge");
  const factors = constraintFactorsForNode(node, t).map((factor) => factor.label);
  if (factors.length > 0) return factors.slice(0, 2).join(" · ");
  return t("readerConstraintUnclassified");
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
  const { nodeName, t } = useLanguage();
  const { edge, organization } = link;
  const summary = organizationMetricSummary(organization, { t });
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
  options: { includeDescriptions?: boolean; limit?: number; t?: (key: string) => string } = {},
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
  if (summary.length) return summary.join(" · ");
  const scale = commercialScaleAnswerForOrganization(organization);
  if (scale.basis === "estimated") return commercialScaleProxyText(scale, options.t);
  return scale.text || null;
}

function commercialScaleProxyText(answer: CommercialScaleAnswer, t?: (key: string) => string): string {
  if (!t || answer.basis === "explicit") return answer.text;
  const ticker = answer.ticker ?? t("supplierScaleProxyTickerUnavailable");
  const key = (() => {
    switch (answer.proxyKind) {
      case "public":
        return "supplierScaleProxyPublic";
      case "subsidiary":
        return "supplierScaleProxySubsidiary";
      case "private":
        return "supplierScaleProxyPrivate";
      case "unknown":
      default:
        return "supplierScaleProxyUnknown";
    }
  })();
  return formatCopy(t(key), { ticker });
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
  return `est. ${formatOrganizationNumber(value.typical)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
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
      <strong>{onSelectNode ? t("topBlockersTitle") : t("topBlockersStaticTitle")}</strong>
      <ol className="top-blockers-list">
        {ranked.map((entry) => {
          const maturityLabel = entry.child.maturityLabel ?? "unknown";
          const maturityText = formatMaturityLabel(maturityLabel);
          const sourceText = entry.source === "explicit" ? t("explicitBottleneck") : maturityText;
          const badgeText = readerFacingCandidateSignal(entry.child, entry.source, t);
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
                  aria-label={`${nodeName(entry.id, entry.child.name)} — ${sourceText} · ${badgeText}`}
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
  // Readiness gap (100 − maturityScore) is the readiness component of the
  // Barrier axis (ADR-0010 / §2: Barrier absorbs the old "maturity"), so it
  // is labelled "Barrier gap" — never the deprecated "Maturity" wording.
  if (typeof node.maturityScore === "number") {
    drivers.push(`${t("topBlockersBarrierGap")} ${Math.round(100 - node.maturityScore)}%`);
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
