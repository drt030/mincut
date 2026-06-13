import type { GraphData } from "@/lib/schema";

export type GatedDomain = { domainTag: string; entitlement: string };
type GraphNode = GraphData["nodes"][number];
type GraphEdge = GraphData["edges"][number];

export const GATED_DOMAINS: GatedDomain[] = [
  // Future paid exposure domains. AI compute is intentionally absent:
  // /d/ai-compute is the complete free flagship demo.
  { domainTag: "humanoid_actuator", entitlement: "humanoid" },
  { domainTag: "humanoid_robotics", entitlement: "humanoid" },
  { domainTag: "ai_dc_power_chain", entitlement: "power" },
  { domainTag: "controlled_fusion", entitlement: "power" },
  { domainTag: "spacex_reusable_launch", entitlement: "space" },
  { domainTag: "spacex_orbital_data_center", entitlement: "space" },
  // world_model chains can be added here once registered.
];

/**
 * Chain tags identifying fully-free domains. Real imported nodes mix chain
 * tags with category labels inside `domain` (investable_supplier,
 * semiconductor_equipment, ...), so gating keys on registered chain tags
 * only and fails closed: an org escapes stripping only through a free
 * chain tag, an entitlement on one of its chains, or an explicit
 * `free_teaser` tag (Decision 5) — never through a category label.
 */
export const FREE_CHAIN_TAGS = ["ai_compute_chain", "parcel_sorting_robot"];

const LOCKED_SUPPLIER_REDACTION = "locked supplier";
const lockedOrganizationNamePatternCache = new Map<string, RegExp>();
const lockedOrganizationIdentifierPatternCache = new Map<string, RegExp>();
const compactIdentityCache = new Map<string, string>();

export function stripExposureLayer(
  graph: GraphData,
  entitlements: string[],
  gatedDomains: GatedDomain[] = GATED_DOMAINS,
) {
  const lockedDomains = gatedDomains.filter(
    (d) => !entitlements.includes("all") && !entitlements.includes(d.entitlement),
  );
  const lockedChainTags = new Set(lockedDomains.map((d) => d.domainTag));
  const openChainTags = new Set([
    ...FREE_CHAIN_TAGS.filter((tag) => !lockedChainTags.has(tag)),
    ...gatedDomains.filter((d) => !lockedChainTags.has(d.domainTag)).map((d) => d.domainTag),
  ]);

  const hiddenNodeIds = new Set<string>();
  for (const n of graph.nodes) {
    if (n.kind !== "organization") continue;
    if ((n.tags ?? []).includes("free_teaser")) continue;
    const domainTags = n.domain ?? [];
    if (!domainTags.some((t) => lockedChainTags.has(t))) continue;
    if (domainTags.some((t) => openChainTags.has(t))) continue;
    hiddenNodeIds.add(n.id);
  }

  const locked = lockedDomains.map((d) => ({
    domainTag: d.domainTag,
    entitlement: d.entitlement,
    hiddenOrgCount: graph.nodes.filter(
      (n) => hiddenNodeIds.has(n.id) && (n.domain ?? []).includes(d.domainTag),
    ).length,
  }));

  if (hiddenNodeIds.size === 0) return { graph, locked };

  const lockedOrgNames = lockedOrganizationNames(graph.nodes, hiddenNodeIds);
  const nodes = graph.nodes
    .filter((n) => !hiddenNodeIds.has(n.id))
    .map((n) => redactNodeProse(n, lockedOrgNames));
  const edges = graph.edges
    .filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target))
    .map((e) => redactEdgeProse(e, lockedOrgNames));
  const referencedEvidenceIds = new Set([
    ...nodes.flatMap((n) => n.evidenceIds ?? []),
    ...edges.flatMap((e) => e.evidenceIds ?? []),
  ]);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const visibleEdgeIds = new Set(edges.map((edge) => edge.id));
  const evidence = graph.evidence.flatMap((ev) => {
    if (evidenceMentionsLockedOrganization(ev, lockedOrgNames)) return [];
    const pruned = pruneEvidenceSupports(ev, visibleNodeIds, visibleEdgeIds);
    if (!pruned) return [];
    if (
      referencedEvidenceIds.size === 0 ||
      referencedEvidenceIds.has(pruned.id) ||
      evidenceHasSupports(pruned)
    ) {
      return [pruned];
    }
    return [];
  });
  const visibleEvidenceIds = new Set(evidence.map((ev) => ev.id));
  const nodesWithEvidence = nodes.map((node) => removeStrippedEvidenceReferences(node, visibleEvidenceIds));
  const edgesWithEvidence = edges.map((edge) => removeStrippedEvidenceReferences(edge, visibleEvidenceIds));
  const { nodes: safeNodes, edges: safeEdges, nodeIdMap, edgeIdMap } = redactIdentifiers(
    nodesWithEvidence,
    edgesWithEvidence,
    lockedOrgNames,
  );
  const safeEvidence = evidence.map((ev) => remapEvidenceSupports(ev, nodeIdMap, edgeIdMap));

  return { graph: { ...graph, nodes: safeNodes, edges: safeEdges, evidence: safeEvidence }, locked };
}

function lockedOrganizationNames(nodes: GraphNode[], hiddenNodeIds: Set<string>): string[] {
  const visibleOrgNames = new Set(
    nodes
      .filter((n) => n.kind === "organization" && !hiddenNodeIds.has(n.id))
      .flatMap(visibleOrganizationIdentityTerms)
      .map((name) => name.toLocaleLowerCase()),
  );
  const names = nodes
    .filter((n) => n.kind === "organization" && hiddenNodeIds.has(n.id))
    .flatMap((n) => organizationIdentityTerms(n.name))
    .filter((name) => name.length > 0 && !visibleOrgNames.has(name.toLocaleLowerCase()));

  return uniqueTerms(names);
}

function visibleOrganizationIdentityTerms(node: GraphNode): string[] {
  return uniqueTerms([
    ...organizationIdentityTerms(node.name),
    typeof node.ticker === "string" ? node.ticker : "",
    ...(node.metrics ?? []).flatMap((metric) => [
      typeof metric.currentValue === "string" ? metric.currentValue : "",
      typeof metric.targetValue === "string" ? metric.targetValue : "",
    ]),
  ]);
}

function redactNodeProse(node: GraphNode, lockedOrgNames: string[]): GraphNode {
  let next = node;
  const name = redactLockedOrganizationNames(node.name, lockedOrgNames);
  if (name !== node.name) next = { ...next, name };

  const description = redactOptionalText(node.description, lockedOrgNames);
  if (description !== node.description) next = { ...next, description };

  const notes = redactOptionalText(node.notes, lockedOrgNames);
  if (notes !== node.notes) next = { ...next, notes };

  if (node.targetContext) {
    const targetContext = redactStringRecord(node.targetContext, lockedOrgNames);
    if (targetContext !== node.targetContext) next = { ...next, targetContext };
  }

  if (node.metrics) {
    let changed = false;
    const metrics = node.metrics.map((metric) => {
      let nextMetric = metric;
      const metricName = redactLockedOrganizationNames(metric.name, lockedOrgNames);
      const metricUnit = redactOptionalText(metric.unit, lockedOrgNames);
      const metricDescription = redactOptionalText(metric.description, lockedOrgNames);
      const currentValue =
        typeof metric.currentValue === "string"
          ? redactLockedOrganizationNames(metric.currentValue, lockedOrgNames)
          : metric.currentValue;
      const targetValue =
        typeof metric.targetValue === "string"
          ? redactLockedOrganizationNames(metric.targetValue, lockedOrgNames)
          : metric.targetValue;
      if (metricName !== metric.name) nextMetric = { ...nextMetric, name: metricName };
      if (metricUnit !== metric.unit) nextMetric = { ...nextMetric, unit: metricUnit };
      if (metricDescription !== metric.description) nextMetric = { ...nextMetric, description: metricDescription };
      if (currentValue !== metric.currentValue) nextMetric = { ...nextMetric, currentValue };
      if (targetValue !== metric.targetValue) nextMetric = { ...nextMetric, targetValue };
      if (nextMetric !== metric) changed = true;
      return nextMetric;
    });
    if (changed) next = { ...next, metrics };
  }

  return next;
}

function redactEdgeProse(edge: GraphEdge, lockedOrgNames: string[]): GraphEdge {
  let next = edge;
  const claim = redactOptionalText(edge.claim, lockedOrgNames);
  if (claim !== edge.claim) next = { ...next, claim };

  const context = redactOptionalText(edge.context, lockedOrgNames);
  if (context !== edge.context) next = { ...next, context };

  const routeId = redactOptionalIdentifier(edge.routeId, lockedOrgNames);
  if (routeId !== edge.routeId) next = { ...next, routeId };

  return next;
}

function evidenceMentionsLockedOrganization(evidence: GraphData["evidence"][number], lockedOrgNames: string[]): boolean {
  return evidenceStringsForLeak(evidence).some((value) => containsLockedOrganizationName(value, lockedOrgNames));
}

function evidenceStringsForLeak(evidence: GraphData["evidence"][number]): string[] {
  return Object.entries(evidence).flatMap(([key, value]) => {
    if (key === "supportsNodeIds" || key === "supportsEdgeIds") return [];
    return objectStrings(value);
  });
}

function pruneEvidenceSupports(
  evidence: GraphData["evidence"][number],
  visibleNodeIds: Set<string>,
  visibleEdgeIds: Set<string>,
): GraphData["evidence"][number] | undefined {
  const hadSupports = evidenceHasSupports(evidence);
  const supportsNodeIds = filterIds(evidence.supportsNodeIds, visibleNodeIds);
  const supportsEdgeIds = filterIds(evidence.supportsEdgeIds, visibleEdgeIds);
  const hasVisibleSupports = (supportsNodeIds?.length ?? 0) > 0 || (supportsEdgeIds?.length ?? 0) > 0;
  if (hadSupports && !hasVisibleSupports) return undefined;

  let next = evidence;
  if (supportsNodeIds !== evidence.supportsNodeIds) next = { ...next, supportsNodeIds };
  if (supportsEdgeIds !== evidence.supportsEdgeIds) next = { ...next, supportsEdgeIds };
  return next;
}

function evidenceHasSupports(evidence: GraphData["evidence"][number]): boolean {
  return (evidence.supportsNodeIds?.length ?? 0) > 0 || (evidence.supportsEdgeIds?.length ?? 0) > 0;
}

function filterIds(ids: string[] | undefined, visibleIds: Set<string>): string[] | undefined {
  if (!ids) return ids;
  const filtered = ids.filter((id) => visibleIds.has(id));
  if (filtered.length === ids.length) return ids;
  return filtered.length === 0 ? undefined : filtered;
}

function removeStrippedEvidenceReferences<T extends { evidenceIds?: string[]; rejectedEvidenceIds?: string[] }>(
  item: T,
  visibleEvidenceIds: Set<string>,
): T {
  let next = item;
  const evidenceIds = filterEvidenceIds(item.evidenceIds, visibleEvidenceIds);
  if (evidenceIds !== item.evidenceIds) next = { ...next, evidenceIds };

  const rejectedEvidenceIds = filterEvidenceIds(item.rejectedEvidenceIds, visibleEvidenceIds);
  if (rejectedEvidenceIds !== item.rejectedEvidenceIds) next = { ...next, rejectedEvidenceIds };

  return next;
}

function filterEvidenceIds(ids: string[] | undefined, visibleEvidenceIds: Set<string>): string[] | undefined {
  if (!ids) return ids;
  const filtered = ids.filter((id) => visibleEvidenceIds.has(id));
  if (filtered.length === ids.length) return ids;
  return filtered.length === 0 ? undefined : filtered;
}

function redactIdentifiers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  lockedOrgNames: string[],
): { nodes: GraphNode[]; edges: GraphEdge[]; nodeIdMap: Map<string, string>; edgeIdMap: Map<string, string> } {
  const nodeIdMap = buildRedactedIdentifierMap(
    nodes.map((node) => node.id),
    lockedOrgNames,
  );
  const edgeIdMap = buildRedactedIdentifierMap(
    edges.map((edge) => edge.id),
    lockedOrgNames,
  );

  return {
    nodes: nodes.map((node) => {
      let next = node;
      const id = nodeIdMap.get(node.id) ?? node.id;
      if (id !== node.id) next = { ...next, id };

      const bottleneckOf = remapIdentifierArray(node.bottleneckOf, nodeIdMap, lockedOrgNames);
      if (bottleneckOf !== node.bottleneckOf) next = { ...next, bottleneckOf };

      const frontierFor = remapIdentifierArray(node.frontierFor, nodeIdMap, lockedOrgNames);
      if (frontierFor !== node.frontierFor) next = { ...next, frontierFor };

      const tags = redactIdentifierArray(node.tags, lockedOrgNames);
      if (tags !== node.tags) next = { ...next, tags };

      return next;
    }),
    edges: edges.map((edge) => {
      let next = edge;
      const id = edgeIdMap.get(edge.id) ?? edge.id;
      const source = nodeIdMap.get(edge.source) ?? edge.source;
      const target = nodeIdMap.get(edge.target) ?? edge.target;
      if (id !== edge.id) next = { ...next, id };
      if (source !== edge.source) next = { ...next, source };
      if (target !== edge.target) next = { ...next, target };
      return next;
    }),
    nodeIdMap,
    edgeIdMap,
  };
}

function remapEvidenceSupports(
  evidence: GraphData["evidence"][number],
  nodeIdMap: Map<string, string>,
  edgeIdMap: Map<string, string>,
): GraphData["evidence"][number] {
  let next = evidence;
  const supportsNodeIds = remapIds(evidence.supportsNodeIds, nodeIdMap);
  if (supportsNodeIds !== evidence.supportsNodeIds) next = { ...next, supportsNodeIds };
  const supportsEdgeIds = remapIds(evidence.supportsEdgeIds, edgeIdMap);
  if (supportsEdgeIds !== evidence.supportsEdgeIds) next = { ...next, supportsEdgeIds };
  return next;
}

function remapIds(ids: string[] | undefined, idMap: Map<string, string>): string[] | undefined {
  if (!ids) return ids;
  let changed = false;
  const mapped = ids.map((id) => {
    const next = idMap.get(id) ?? id;
    if (next !== id) changed = true;
    return next;
  });
  return changed ? mapped : ids;
}

function buildRedactedIdentifierMap(ids: string[], lockedOrgNames: string[]): Map<string, string> {
  const used = new Set<string>();
  const redacted = new Map<string, string>();

  for (const id of ids) {
    const base = redactLockedOrganizationIdentifiers(id, lockedOrgNames);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    if (candidate !== id) redacted.set(id, candidate);
  }

  return redacted;
}

function remapIdentifierArray(
  values: string[] | undefined,
  idMap: Map<string, string>,
  lockedOrgNames: string[],
): string[] | undefined {
  if (!values) return values;
  let changed = false;
  const next = values.map((value) => {
    const mapped = idMap.get(value) ?? redactLockedOrganizationIdentifiers(value, lockedOrgNames);
    if (mapped !== value) changed = true;
    return mapped;
  });
  return changed ? next : values;
}

function redactIdentifierArray(values: string[] | undefined, lockedOrgNames: string[]): string[] | undefined {
  if (!values) return values;
  let changed = false;
  const next = values.map((value) => {
    const redacted = redactLockedOrganizationIdentifiers(value, lockedOrgNames);
    if (redacted !== value) changed = true;
    return redacted;
  });
  return changed ? next : values;
}

function objectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => objectStrings(entry));
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((entry) => objectStrings(entry));
}

function redactStringRecord<T extends Record<string, unknown>>(value: T, lockedOrgNames: string[]): T {
  let changed = false;
  const redacted = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry !== "string") return [key, entry];
      const next = redactLockedOrganizationNames(entry, lockedOrgNames);
      if (next !== entry) changed = true;
      return [key, next];
    }),
  ) as T;

  return changed ? redacted : value;
}

function redactOptionalText(value: string | undefined, lockedOrgNames: string[]): string | undefined {
  return value === undefined ? undefined : redactLockedOrganizationNames(value, lockedOrgNames);
}

function redactOptionalIdentifier(value: string | undefined, lockedOrgNames: string[]): string | undefined {
  return value === undefined ? undefined : redactLockedOrganizationIdentifiers(value, lockedOrgNames);
}

function containsLockedOrganizationName(value: string, lockedOrgNames: string[]): boolean {
  const compactValue = compactIdentityString(value);
  return lockedOrgNames.some(
    (name) =>
      patternMatches(lockedOrganizationNamePattern(name), value) ||
      patternMatches(lockedOrganizationIdentifierPattern(name), value) ||
      compactLockedOrganizationName(compactValue, name),
  );
}

function redactLockedOrganizationNames(value: string, lockedOrgNames: string[]): string {
  let redacted = value;
  for (const name of lockedOrgNames) {
    const textPattern = lockedOrganizationNamePattern(name);
    const identifierPattern = lockedOrganizationIdentifierPattern(name);
    redacted = redacted.replace(
      textPattern,
      (_match, prefix: string) => `${prefix}${LOCKED_SUPPLIER_REDACTION}`,
    );
    redacted = redacted.replace(
      identifierPattern,
      (_match, prefix: string) => `${prefix}${LOCKED_SUPPLIER_REDACTION}`,
    );
  }
  return redacted;
}

function redactLockedOrganizationIdentifiers(value: string, lockedOrgNames: string[]): string {
  let redacted = value;
  for (const name of lockedOrgNames) {
    const identifierPattern = lockedOrganizationIdentifierPattern(name);
    redacted = redacted.replace(
      identifierPattern,
      (_match, prefix: string) => `${prefix}${LOCKED_SUPPLIER_REDACTION.replace(/\s+/g, "_")}`,
    );
  }
  return redacted;
}

function lockedOrganizationNamePattern(name: string): RegExp {
  const cached = lockedOrganizationNamePatternCache.get(name);
  if (cached) return cached;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, "giu");
  lockedOrganizationNamePatternCache.set(name, pattern);
  return pattern;
}

function lockedOrganizationIdentifierPattern(name: string): RegExp {
  const cached = lockedOrganizationIdentifierPatternCache.get(name);
  if (cached) return cached;
  const parts = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return /$a/;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}(?=$|[^\\p{L}\\p{N}])`, "giu");
  lockedOrganizationIdentifierPatternCache.set(name, pattern);
  return pattern;
}

function compactLockedOrganizationName(compactValue: string, name: string): boolean {
  const compactName = compactIdentityString(name);
  if (compactName.length < 5) return false;
  return compactValue.includes(compactName);
}

function compactIdentityString(value: string): string {
  const cached = compactIdentityCache.get(value);
  if (cached !== undefined) return cached;
  const compact = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  compactIdentityCache.set(value, compact);
  return compact;
}

function patternMatches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function organizationIdentityTerms(name: string): string[] {
  const primaryName = name.replace(/\s*\([^)]*\)/g, "").trim();
  const primarySegments = primaryName.split(/\s+\/\s+/).map((part) => normalizeOrganizationName(part));
  const parentheticalAliases = [...name.matchAll(/\(([^)]*)\)/g)]
    .flatMap((match) => match[1].split(/[;,/]/))
    .map((part) => normalizeOrganizationName(part))
    .filter(isUsefulAlias);

  return uniqueTerms([
    name.trim(),
    primaryName,
    ...primarySegments,
    ...parentheticalAliases,
    ...primarySegments.flatMap((term) => organizationRootTerms(term)),
  ]).filter((term) => term.length >= 3);
}

function normalizeOrganizationName(name: string): string {
  const beforeComma = name.split(",")[0]?.trim() ?? name.trim();
  let next = beforeComma;
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next
      .replace(
        /(?:[\s,]+(?:Inc\.?|Incorporated|Corporation|Corp\.?|Co\.?|Company|Ltd\.?|Limited|plc|S\.?A\.?|N\.?V\.?|B\.?V\.?|GmbH|KGaA|SE|S\.?E\.?|Holdings?|Industries?))\.?$/i,
        "",
      )
      .trim();
  }
  return next;
}

function organizationRootTerms(name: string): string[] {
  const firstToken = name.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}&.-]/gu, "") ?? "";
  const words = name.split(/\s+/).filter((part) => part !== "&");
  const ampersandAcronym =
    name.includes("&") && words.length >= 2 ? words.map((part) => part[0]).join("&") : undefined;

  return [isDistinctiveRootTerm(firstToken) ? firstToken : undefined, ampersandAcronym].filter(
    (term): term is string => Boolean(term),
  );
}

function isUsefulAlias(value: string): boolean {
  if (value.length < 2) return false;
  if (
    /^(formerly|former|division|foundry|usa|germany|japan|korea|hong kong|switzerland|austria|private|netherlands|asia|sweden|israeli?|optics|photonics)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  if (/\b(foundry|division)\b/i.test(value)) return false;
  if (/^[A-Z0-9&.+-]{2,12}$/.test(value)) return true;
  if (/^(?=.*[a-z])(?=.*[A-Z])[\p{L}\p{N}&.+-]{4,24}$/u.test(value)) return true;
  return /^[A-Z][\p{L}\p{N}&.+-]*(?:\s+[A-Z][\p{L}\p{N}&.+-]*){1,3}$/u.test(value);
}

function isDistinctiveRootTerm(value: string): boolean {
  if (value.length < 3) return false;
  if (/^(Applied|Air|Power|Delta|Advanced|Visual|Intelligent|Onto|Illinois|Tokyo)$/i.test(value)) return false;
  return true;
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms.map((item) => item.trim()).filter(Boolean)) {
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
