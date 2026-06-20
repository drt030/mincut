import type { Edge, GraphData, MetricValue, Node } from "./schema";
import { rollupCost } from "./costRollup";

export type AnswerBasis = "explicit" | "estimated";

export type LeadTimeReasonCode =
  | "explicit"
  | "child_decomposition"
  | "capacity_tooling"
  | "material_qualification"
  | "component_second_source"
  | "regulatory_external"
  | "economic_validation"
  | "engineering_qualification"
  | "early_product"
  | "mature_commodity"
  | "default_proxy";

export type LeadTimeAnswer = {
  months: number;
  basis: AnswerBasis;
  reason: string;
  reasonCode: LeadTimeReasonCode;
};

export type CommercialScaleProxyKind = "public" | "subsidiary" | "private" | "unknown";

export type CommercialScaleAnswer = {
  basis: AnswerBasis;
  text: string;
  proxyKind?: CommercialScaleProxyKind;
  ticker?: string;
};

const STRUCTURAL_LEAD_TIME_KINDS = new Set<Node["kind"]>([
  "product",
  "capability",
  "module",
  "technical_route",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

const STRUCTURAL_COMMERCIAL_SCALE_KINDS = STRUCTURAL_LEAD_TIME_KINDS;

const OUTGOING_STRUCTURAL_DECOMPOSITION_RELATIONS = new Set<Edge["relation"]>([
  "requires",
  "has_route",
  "implemented_by",
]);

const NON_STRUCTURAL_DECOMPOSITION_CHILD_KINDS = new Set<Node["kind"]>([
  "metric",
  "evidence",
  "bottleneck",
  "placeholder_breakthrough",
  "standard_or_regulation",
  "organization",
]);

const SUPPLIER_RELATIONS = new Set<Edge["relation"]>([
  "manufactured_by",
  "implemented_by",
  "qualified_supplier",
  "reported_capable_supplier",
  "strategic_supplier_to",
  "capacity_provider",
  "second_source_candidate",
  "allocation_locked_by",
]);

const COMMERCIAL_SCALE_METRIC_PATTERN =
  /revenue|sales|net sales|enterprise value|market share|market status|production|capacity|shipment|shipments|backlog|bookings|public listing|listing|市值|收入|销售|产量|份额/i;

type InlineMetric = NonNullable<Node["metrics"]>[number];

export function isStructuralLeadTimeNode(node: Node): boolean {
  return node.reviewStatus !== "deprecated" && STRUCTURAL_LEAD_TIME_KINDS.has(node.kind);
}

export function leadTimeAnswerForNode(node: Node): LeadTimeAnswer | null {
  if (!isStructuralLeadTimeNode(node)) return null;
  if (typeof node.capacityLeadTimeMonths === "number") {
    return {
      months: node.capacityLeadTimeMonths,
      basis: "explicit",
      reason: "explicit graph capacityLeadTimeMonths field",
      reasonCode: "explicit",
    };
  }
  return estimatedLeadTimeForNode(node);
}

export function structuralLeadTimeMissingNodes(graph: GraphData): string[] {
  return graph.nodes
    .filter(isStructuralLeadTimeNode)
    .filter((node) => leadTimeAnswerForNode(node) === null)
    .map((node) => node.id);
}

export function leadTimeAnswerForGraphNode(graph: GraphData, node: Node): LeadTimeAnswer | null {
  const memo = new Map<string, LeadTimeAnswer | null>();
  const visiting = new Set<string>();
  return graphLeadTimeAnswer(graph, node, memo, visiting);
}

export function structuralLeadTimeHierarchyViolations(graph: GraphData): string[] {
  const violations: string[] = [];
  for (const parent of graph.nodes) {
    if (!isStructuralLeadTimeNode(parent)) continue;
    const parentAnswer = leadTimeAnswerForGraphNode(graph, parent);
    if (!parentAnswer) continue;
    for (const child of directStructuralChildren(graph, parent.id)) {
      const childAnswer = leadTimeAnswerForGraphNode(graph, child);
      if (!childAnswer || parentAnswer.months >= childAnswer.months) continue;
      violations.push(
        `${parent.id} relief-cycle ${parentAnswer.months} months is shorter than direct child ${child.id} ${childAnswer.months} months`,
      );
    }
  }
  return violations;
}

export function commercialScaleRollupViolations(graph: GraphData): string[] {
  const violations: string[] = [];
  for (const node of graph.nodes) {
    if (node.reviewStatus === "deprecated" || !STRUCTURAL_COMMERCIAL_SCALE_KINDS.has(node.kind)) continue;
    try {
      const result = rollupCost(graph, node.id);
      if (!result.directOnly || !result.fromChildren || !result.directLowerThanChildren) continue;
      violations.push(
        `${node.id} direct commercial-scale cost ${Math.round(result.directOnly.typical)} RMB is below child rollup ${Math.round(result.fromChildren.typical)} RMB`,
      );
    } catch {
      // rollupCost's cycle/missing-node failures are covered by existing graph validation.
    }
  }
  return violations;
}

export function explicitLeadTimeHierarchyViolations(graph: GraphData): string[] {
  const violations: string[] = [];
  for (const parent of graph.nodes) {
    if (!isStructuralLeadTimeNode(parent) || typeof parent.capacityLeadTimeMonths !== "number") continue;
    for (const child of directStructuralChildren(graph, parent.id)) {
      if (typeof child.capacityLeadTimeMonths !== "number") continue;
      if (parent.capacityLeadTimeMonths >= child.capacityLeadTimeMonths) continue;
      violations.push(
        `${parent.id} capacityLeadTimeMonths ${parent.capacityLeadTimeMonths} is shorter than direct child ${child.id} ${child.capacityLeadTimeMonths}`,
      );
    }
  }
  return violations;
}

export function commercialScaleAnswerForOrganization(organization: Node): CommercialScaleAnswer {
  const metric = commercialScaleMetricForOrganization(organization);
  if (metric) {
    return {
      basis: "explicit",
      text: `${metric.name}: ${formatMetricValue(metric.currentValue!, metric.unit)}`,
    };
  }

  const ticker = organization.ticker && organization.ticker !== "private" ? organization.ticker : undefined;
  if (organization.listingStatus === "public") {
    return {
      basis: "estimated",
      proxyKind: "public",
      ticker,
      text: `Public-market scale proxy${ticker ? ` (${ticker})` : ""}; exact revenue/share metric still needs sourcing.`,
    };
  }
  if (organization.listingStatus === "subsidiary") {
    return {
      basis: "estimated",
      proxyKind: "subsidiary",
      ticker,
      text: `Listed-parent scale proxy${ticker ? ` (${ticker})` : ""}; exact segment revenue/share metric still needs sourcing.`,
    };
  }
  if (organization.listingStatus === "private") {
    return {
      basis: "estimated",
      proxyKind: "private",
      text: "Private-supplier scale proxy; exact revenue/share metric still needs sourcing.",
    };
  }
  return {
    basis: "estimated",
    proxyKind: "unknown",
    text: "Unverified supplier-scale proxy from graph relationship; exact revenue/share metric still needs sourcing.",
  };
}

export function commercialScaleMissingSupplierOrganizations(graph: GraphData): string[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const supplierIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.reviewStatus === "deprecated") continue;
    if (!SUPPLIER_RELATIONS.has(edge.relation)) continue;
    const target = nodeById.get(edge.target);
    if (!target || target.kind !== "organization" || target.reviewStatus === "deprecated") continue;
    supplierIds.add(target.id);
  }
  return [...supplierIds].filter((id) => {
    const organization = nodeById.get(id);
    return !organization || commercialScaleAnswerForOrganization(organization).text.trim().length === 0;
  }).sort((a, b) => a.localeCompare(b));
}

function estimatedLeadTimeForNode(node: Node): LeadTimeAnswer {
  const tags = new Set(node.tags ?? []);
  const textProfile = [
    node.name,
    node.description,
    node.notes,
    node.tags?.join(" "),
  ].filter(Boolean).join(" ").toLowerCase();

  if (tags.has("constraint_regulatory_approval")) {
    return estimate(36, "regulatory or safety approval cycle", "regulatory_external");
  }
  if (tags.has("constraint_economic_validation")) {
    return estimate(12, "demand, utilization, and unit-economics validation cycle", "economic_validation");
  }
  if (tags.has("constraint_material_supply_chain")) {
    return estimate(24, "material supply and qualification cycle", "material_qualification");
  }
  if (tags.has("constraint_capacity_scale")) {
    return estimate(24, "capacity, tooling, and qualification cycle", "capacity_tooling");
  }
  if (tags.has("constraint_component_availability")) {
    return estimate(18, "qualified component and second-source cycle", "component_second_source");
  }
  if (
    /\b(capacity constraint|capacity constraints|capacity expansion|capacity bottleneck|capacity ramp|tool lead time|tool lead times|long tool lead|long-tool-lead|tooling)\b/.test(textProfile)
  ) {
    return estimate(24, "capacity, tooling, and qualification cycle", "capacity_tooling");
  }
  if (
    /\b(material shortage|material shortages|supply shortage|supply shortages|supply-chain shortage|qualification bottleneck)\b/.test(textProfile)
  ) {
    return estimate(24, "material supply and qualification cycle", "material_qualification");
  }
  if (
    tags.has("constraint_integration_commissioning") ||
    tags.has("constraint_technical_maturity") ||
    tags.has("hard_to_develop") ||
    tags.has("process_frontier") ||
    node.transactability === "must_build"
  ) {
    return estimate(18, "engineering, process, and qualification cycle", "engineering_qualification");
  }

  if (node.kind === "manufacturing_process") {
    return estimate(
      node.maturityLabel === "mature" || node.maturityLabel === "widely_adopted" ? 6 : 18,
      "process setup and qualification cycle",
      "engineering_qualification",
    );
  }
  if (node.kind === "equipment") {
    return estimate(12, "equipment procurement and integration cycle", "component_second_source");
  }
  if (node.kind === "product" || node.kind === "capability" || node.kind === "technical_route") {
    const early = node.maturityLabel === "hypothesis" ||
      node.maturityLabel === "lab_proven" ||
      node.maturityLabel === "prototype" ||
      node.maturityLabel === "unknown";
    return estimate(early ? 24 : 12, "product-scale execution cycle", "early_product");
  }
  if (
    node.maturityLabel === "mature" ||
    node.maturityLabel === "widely_adopted" ||
    node.maturityLabel === "commercially_available"
  ) {
    return estimate(6, "mature commodity sourcing cycle", "mature_commodity");
  }
  return estimate(12, "default graph proxy from kind and maturity", "default_proxy");
}

function graphLeadTimeAnswer(
  graph: GraphData,
  node: Node,
  memo: Map<string, LeadTimeAnswer | null>,
  visiting: Set<string>,
): LeadTimeAnswer | null {
  if (memo.has(node.id)) return memo.get(node.id)!;
  if (visiting.has(node.id)) return leadTimeAnswerForNode(node);
  visiting.add(node.id);
  try {
    const local = leadTimeAnswerForNode(node);
    let answer = local;
    for (const child of directStructuralChildren(graph, node.id)) {
      const childAnswer = graphLeadTimeAnswer(graph, child, memo, visiting);
      if (!childAnswer) continue;
      if (!answer || childAnswer.months > answer.months) {
        answer = {
          months: childAnswer.months,
          basis: "estimated",
          reason: "direct child maximum relief-cycle from graph decomposition",
          reasonCode: "child_decomposition",
        };
      }
    }
    memo.set(node.id, answer);
    return answer;
  } finally {
    visiting.delete(node.id);
  }
}

function directStructuralChildren(graph: GraphData, parentId: string): Node[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const children: Node[] = [];
  const seen = new Set<string>();
  const addChild = (child: Node | undefined) => {
    if (!child || seen.has(child.id)) return;
    if (child.reviewStatus === "deprecated") return;
    if (!isStructuralLeadTimeNode(child)) return;
    if (NON_STRUCTURAL_DECOMPOSITION_CHILD_KINDS.has(child.kind)) return;
    seen.add(child.id);
    children.push(child);
  };

  for (const edge of graph.edges) {
    if (edge.reviewStatus === "deprecated") continue;
    if (edge.source === parentId && OUTGOING_STRUCTURAL_DECOMPOSITION_RELATIONS.has(edge.relation)) {
      addChild(nodeById.get(edge.target));
    }
    if (edge.target === parentId && edge.relation === "part_of") {
      addChild(nodeById.get(edge.source));
    }
  }
  return children;
}

function estimate(months: number, reason: string, reasonCode: LeadTimeReasonCode): LeadTimeAnswer {
  return { months, basis: "estimated", reason, reasonCode };
}

function commercialScaleMetricForOrganization(organization: Node): InlineMetric | null {
  const metrics = organization.metrics ?? [];
  return metrics.find((metric) => {
    if (metric.currentValue === undefined) return false;
    return COMMERCIAL_SCALE_METRIC_PATTERN.test(`${metric.name} ${metric.description ?? ""} ${metric.unit ?? ""}`);
  }) ?? metrics.find((metric) => metric.currentValue !== undefined) ?? null;
}

function formatMetricValue(value: MetricValue, unit: string | undefined): string {
  if (typeof value === "number") {
    return `${formatNumber(value)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  }
  if (typeof value === "string") return value;
  return `est. ${formatNumber(value.typical)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : String(value);
}
