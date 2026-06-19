import type { Edge, Evidence, GraphData, Node } from "./schema";

const ARTIFACT_KINDS = new Set<Node["kind"]>([
  "product",
  "technical_route",
  "module",
  "equipment",
  "material",
]);

const SUPPLIER_RELATIONS = new Set<Edge["relation"]>([
  "manufactured_by",
  "implemented_by",
  "qualified_supplier",
  "reported_capable_supplier",
  "strategic_supplier_to",
  "capacity_provider",
  "second_source_candidate",
]);

const WEAK_SOURCE_STATUSES = new Set<Evidence["sourceStatus"]>([
  "404",
  "unreachable",
  "wrong_topic",
  "generic_homepage",
  "shared_url_suspect",
  "market_report_seo",
  "paywalled_snippet",
]);

export type NodeDetailIaIssueKind =
  | "missing_description"
  | "root_missing_decomposition"
  | "supplier_edge_missing_org"
  | "supplier_org_missing_ticker"
  | "supplier_edge_missing_association_basis"
  | "supplier_edge_missing_evidence"
  | "supplier_edge_weak_evidence";

export type NodeDetailIaIssue = {
  severity: "error" | "warn";
  kind: NodeDetailIaIssueKind;
  domainSlug: string;
  rootId: string;
  nodeId: string;
  message: string;
  edgeId?: string;
  orgId?: string;
  evidenceId?: string;
};

export type NodeDetailIaAuditOptions = {
  domainSlug: string;
  rootId: string;
};

export function auditNodeDetailIa(graph: GraphData, options: NodeDetailIaAuditOptions): NodeDetailIaIssue[] {
  const issues: NodeDetailIaIssue[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const evidenceById = new Map(graph.evidence.map((item) => [item.id, item]));

  for (const node of graph.nodes) {
    if (node.reviewStatus === "deprecated") continue;
    if (!ARTIFACT_KINDS.has(node.kind)) continue;

    if (!node.description?.trim()) {
      issues.push(issue(options, {
        severity: "warn",
        kind: "missing_description",
        nodeId: node.id,
        message: `${node.id} has no description to derive the plain-language role sentence.`,
      }));
    }

    if (node.id === options.rootId && directDecompositionChildren(graph, node.id, nodeById).length === 0) {
      issues.push(issue(options, {
        severity: "error",
        kind: "root_missing_decomposition",
        nodeId: node.id,
        message: `${node.id} is a route root but has no direct decomposition children.`,
      }));
    }

    for (const edge of supplierEdgesForNode(graph, node.id)) {
      const org = nodeById.get(edge.target);
      if (!org) {
        issues.push(issue(options, {
          severity: "error",
          kind: "supplier_edge_missing_org",
          nodeId: node.id,
          edgeId: edge.id,
          orgId: edge.target,
          message: `${edge.id} points at missing organization node ${edge.target}.`,
        }));
        continue;
      }
      if (org.kind !== "organization") continue;
      if (requiresCollapsedTicker(org) && !org.ticker?.trim()) {
        issues.push(issue(options, {
          severity: "warn",
          kind: "supplier_org_missing_ticker",
          nodeId: node.id,
          edgeId: edge.id,
          orgId: org.id,
          message: `${org.id} is ${org.listingStatus} but has no ticker for the collapsed company card.`,
        }));
      }

      if (!edge.claim?.trim() && !edge.context?.trim()) {
        issues.push(issue(options, {
          severity: "warn",
          kind: "supplier_edge_missing_association_basis",
          nodeId: node.id,
          edgeId: edge.id,
          orgId: org.id,
          message: `${edge.id} has no claim/context for the association-basis field.`,
        }));
      }

      const evidence = (edge.evidenceIds ?? [])
        .map((id) => evidenceById.get(id))
        .filter((item): item is Evidence => Boolean(item && item.reviewStatus !== "deprecated"));
      if (evidence.length === 0) {
        issues.push(issue(options, {
          severity: "warn",
          kind: "supplier_edge_missing_evidence",
          nodeId: node.id,
          edgeId: edge.id,
          orgId: org.id,
          message: `${edge.id} has no active evidence link for the expanded supplier card.`,
        }));
        continue;
      }

      for (const item of evidence) {
        if (!WEAK_SOURCE_STATUSES.has(item.sourceStatus)) continue;
        issues.push(issue(options, {
          severity: "warn",
          kind: "supplier_edge_weak_evidence",
          nodeId: node.id,
          edgeId: edge.id,
          orgId: org.id,
          evidenceId: item.id,
          message: `${edge.id} depends on weak evidence ${item.id} (${item.sourceStatus}).`,
        }));
      }
    }
  }

  return issues.sort((a, b) =>
    a.domainSlug.localeCompare(b.domainSlug) ||
    a.nodeId.localeCompare(b.nodeId) ||
    (a.edgeId ?? "").localeCompare(b.edgeId ?? "") ||
    a.kind.localeCompare(b.kind),
  );
}

function issue(
  options: NodeDetailIaAuditOptions,
  fields: Omit<NodeDetailIaIssue, "domainSlug" | "rootId">,
): NodeDetailIaIssue {
  return {
    ...fields,
    domainSlug: options.domainSlug,
    rootId: options.rootId,
  };
}

function directDecompositionChildren(graph: GraphData, nodeId: string, nodeById: Map<string, Node>): Node[] {
  return graph.edges
    .filter((edge) => edge.source === nodeId && edge.reviewStatus !== "deprecated")
    .filter((edge) => edge.relation === "requires" || edge.relation === "has_route" || edge.relation === "implemented_by")
    .map((edge) => nodeById.get(edge.target))
    .filter((node): node is Node => Boolean(node && node.reviewStatus !== "deprecated" && ARTIFACT_KINDS.has(node.kind)));
}

function requiresCollapsedTicker(org: Node): boolean {
  if (org.listingStatus === "public") return true;
  if (org.listingStatus !== "subsidiary") return false;

  const visibilityText = [
    org.description,
    org.notes,
    ...(org.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return !/\b(delisted|taken private|taking [^.;]* private|wholly[- ]owned|no standalone (listing|ticker)|private[_ -]company|private benchmark|private exposure)\b/.test(visibilityText);
}

function supplierEdgesForNode(graph: GraphData, nodeId: string): Edge[] {
  return graph.edges.filter((edge) => {
    if (edge.source !== nodeId) return false;
    if (edge.reviewStatus === "deprecated") return false;
    return SUPPLIER_RELATIONS.has(edge.relation);
  });
}
