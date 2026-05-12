"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  bottlenecksForNode,
  downstream,
  evidenceForNode,
  isDecompositionFrontier,
  metricsForNode,
  siblingProductsForProduct,
  upstream,
} from "@/lib/graphTraversal";
import { formatMaturityLabel, maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import {
  eligibleCostSubsystemIds,
  isCostBearingMetric,
  rollupCost,
  targetCostFor,
  type CostRollupResult,
} from "@/lib/costRollup";
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import { nodeRisk } from "@/lib/nodeRisk";
import type { GraphData, MetricCurrency, MetricValue, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  graph: GraphData;
  node: Node;
  onSelectNode?: (nodeId: string) => void;
};

export function NodeDetailPanel({ graph, node, onSelectNode }: Props) {
  const { kindName, nodeName, t } = useLanguage();
  // Per v3 iter-14: when the user clicks a different node, the previous
  // scroll position in the panel was preserved → they could land
  // mid-Evidence section and miss the headline cost / maturity /
  // bottleneck info at the top. Scroll the panel to top whenever the
  // selected node changes.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [node.id]);
  const up = upstream(graph, node.id);
  // Per ADR-0001: exclude deprecated children from the auto-rendered child
  // lists (Downstream / Bottlenecks / Sibling). The selected node itself is
  // always shown — the user explicitly clicked through — but its child
  // lists hide deprecated entries by default and surface a count.
  const downRawAll = downstream(graph, node.id);
  const downRaw = downRawAll.filter((child) => child.kind !== "metric");
  const down = downRaw.filter((child) => child.reviewStatus !== "deprecated");
  const downDeprecatedCount = downRaw.length - down.length;
  const metrics = metricsForNode(graph, node.id).filter((child) => child.reviewStatus !== "deprecated");
  const bottlenecksAll = bottlenecksForNode(graph, node.id).filter((child) => child.kind !== "metric");
  const bottlenecks = bottlenecksAll.filter((child) => child.reviewStatus !== "deprecated");
  const bottlenecksDeprecatedCount = bottlenecksAll.length - bottlenecks.length;
  const evidence = evidenceForNode(graph, node.id);
  const isExpansionFrontier = node.tags?.includes("decomposition_frontier") ?? false;
  // Per ADR-0005, the broader frontier judgment is: explicit `decomposition_frontier`
  // tag OR (maturityLabel ∉ {mature, widely_adopted} AND no expanded children).
  // The Frontier pill below surfaces that judgment for the learner.
  const isFrontierByJudgment = isDecompositionFrontier(graph, node);
  const isHardToDevelop = node.tags?.includes("hard_to_develop") ?? false;
  const siblingCandidatesAll = node.kind === "product" ? siblingProductsForProduct(graph, node.id) : [];
  const siblingCandidates = siblingCandidatesAll.filter((child) => child.reviewStatus !== "deprecated");
  const siblingDeprecatedCount = siblingCandidatesAll.length - siblingCandidates.length;
  const isDeprecated = node.reviewStatus === "deprecated";
  const isDisputed = node.reviewStatus === "disputed";

  return (
    /*
     * Per iter-44 a11y audit (MAJOR): selecting a different node silently
     * rerendered this aside. role="region" + aria-live="polite" wires it
     * up as a live region so SR users hear the new node name when
     * selection changes. aria-labelledby points at the h2 below so the
     * region is announced as e.g. "{node-name}, region".
     */
    <aside
      ref={panelRef}
      className="panel detail-list"
      role="region"
      aria-live="polite"
      aria-labelledby="detail-heading"
    >
      <div>
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
        <div className="pill-row">
          <span className="pill">{kindName(node.kind)}</span>
          {node.domain.map((item) => (
            <span className="pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
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
      <MetricNodeList title={t("metrics")} metrics={metrics} onSelectNode={onSelectNode} />
      {/*
        Slice-1 follow-up (2026-05-10 ux-flow Flow 1.5/1.6): the cost
        rollup card + ⚠ inversion badge were gated to `product` kind
        only — which meant the very node the user reported the bug on
        (parcel_manipulation_or_diverter, kind=module) couldn't surface
        the inversion. Expand to all "physical thing" kinds where cost
        rollup is semantically meaningful.
      */}
      {(node.kind === "product" ||
        node.kind === "module" ||
        node.kind === "equipment" ||
        node.kind === "material") ? (
        <ProductCostRollupCard graph={graph} product={node} />
      ) : null}
      <p>{node.description ?? t("noDescription")}</p>
      {node.targetContext ? (
        // Per UX Flow v3 iter-7 (progressive disclosure): target
        // context is reference detail (6 fields of free-form text),
        // useful to read but not first-glance signal. Default
        // collapsed so the panel surfaces cost / maturity / bottlenecks
        // first; user expands when curious.
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
      {/*
        Per UX Flow v3 iter-11: surface the top-3 highest-risk
        `requires` children directly at the top of the panel so the
        user has a one-click drill-target for "what's gating my
        product". Only shown for kinds where requires makes sense.
      */}
      {(node.kind === "product" || node.kind === "module") ? (
        <TopBlockers graph={graph} parent={node} onSelectNode={onSelectNode} />
      ) : null}
      {node.kind === "metric" ? <MetricValueDetailRow node={node} /> : null}
      <NodeList
        title={t("bottlenecks")}
        nodes={bottlenecks}
        onSelectNode={onSelectNode}
        deprecatedHiddenCount={bottlenecksDeprecatedCount}
      />
      <NodeList title={t("upstream")} nodes={up} onSelectNode={onSelectNode} />
      <NodeList
        title={t("downstream")}
        nodes={down}
        onSelectNode={onSelectNode}
        subtitle={t("nonMetricChildrenHint")}
        deprecatedHiddenCount={downDeprecatedCount}
      />
      {node.kind === "product" ? (
        <NodeList
          title={t("siblingCandidates")}
          nodes={siblingCandidates}
          onSelectNode={onSelectNode}
          subtitle={t("siblingCandidatesHint")}
          deprecatedHiddenCount={siblingDeprecatedCount}
        />
      ) : null}
      <div>
        <strong>{t("evidence")}</strong>
        {evidence.length ? (
          <ul>
            {evidence.map((item) => (
              <li key={item.id}>
                {item.title} <span className="muted">({item.type}, {item.reviewStatus ?? "unreviewed"})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="warning">{t("noDirectEvidence")}</p>
        )}
      </div>
    </aside>
  );
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
          {t("costCoverageGapStat")
            .replace("{gap}", String(gapCount))
            .replace("{total}", String(denominator))}
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

/**
 * Per UX Flow v3 iter-11: a learner's first question is usually
 * "what's gating this thing?" — show the top-3 highest-risk
 * `requires` children at the top of the detail panel as a clickable
 * shortcut so they can drill in one click instead of scanning the
 * 12-row Downstream list and guessing.
 *
 * Risk uses nodeRisk(child, graph) = (1 - maturity/100) × cost_share.
 * If no child has risk > 0.1 we render nothing (avoids a useless
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
  const ranked = useMemo(() => {
    const childIds = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.source !== parent.id || edge.relation !== "requires") continue;
      const child = graph.nodes.find((n) => n.id === edge.target);
      if (!child) continue;
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
      .map((id) => {
        const child = graph.nodes.find((n) => n.id === id);
        if (!child) return null;
        return { id, child, risk: nodeRisk(child, graph) };
      })
      .filter((entry): entry is { id: string; child: Node; risk: number } => entry !== null);
    scored.sort((a, b) => b.risk - a.risk);
    return scored.slice(0, 3).filter((entry) => entry.risk > 0.1);
  }, [graph, parent.id]);
  if (ranked.length === 0) return null;
  return (
    <div className="top-blockers">
      <strong>🎯 {t("topBlockersTitle")}</strong>
      <ol className="top-blockers-list">
        {ranked.map((entry) => {
          const maturityLabel = entry.child.maturityLabel ?? "unknown";
          const maturityText = formatMaturityLabel(maturityLabel);
          return (
            <li key={entry.id}>
              {onSelectNode ? (
                <button
                  className="link-button top-blockers-link"
                  type="button"
                  onClick={() => onSelectNode(entry.id)}
                  title={t("topBlockersRiskTooltip").replace("{risk}", entry.risk.toFixed(2))}
                  aria-label={`${nodeName(entry.id, entry.child.name)} — ${maturityText} · risk ${Math.round(entry.risk * 100)}%`}
                >
                  <span className="top-blockers-name">{nodeName(entry.id, entry.child.name)}</span>
                  <span className="top-blockers-meta muted">{maturityText}</span>
                </button>
              ) : (
                <span>{nodeName(entry.id, entry.child.name)}</span>
              )}
              <span className="top-blockers-risk" aria-hidden="true">
                {Math.round(entry.risk * 100)}%
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
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
