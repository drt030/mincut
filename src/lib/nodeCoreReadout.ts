import aiComputeReadouts from "../../data/readouts/ai_compute_chain.json";
import { directDependents, dependentAncestors } from "./chokepointScore";
import { nodeById } from "./graphTraversal";
import type { Edge, GraphData, Node } from "./schema";

export type ReadoutBasis =
  | "stored_override"
  | "explicit_graph"
  | "derived_graph"
  | "text_inference"
  | "insufficient_signal";

export type ReadoutConfidence = "low" | "medium" | "high";

export type LoadBearingScope =
  | "product_mainline"
  | "route_or_module"
  | "structural_dependency"
  | "local_dependency"
  | "unknown";

export type SubstitutionFeasibility =
  | "no_equivalent_substitution"
  | "partial_substitution"
  | "degraded_substitution"
  | "supply_relief"
  | "equivalent_substitution"
  | "not_assessed";

export type BlockingMode =
  | "capacity_scale"
  | "yield_ramp"
  | "equipment_lead_time"
  | "material_supply"
  | "component_availability"
  | "integration_qualification"
  | "technical_maturity"
  | "regulatory_approval"
  | "economic_validation"
  | "operations_maintenance"
  | "supply_concentration"
  | "unclassified";

export type CurrentStatus =
  | "constraining_now"
  | "expansion_relief"
  | "qualification"
  | "partially_easing"
  | "structural_long_cycle"
  | "evidence_gap";

export type ReadoutValue<T extends string> = {
  value: T;
  basis: ReadoutBasis;
  confidence: ReadoutConfidence;
};

export type NodeCoreReadout = {
  scope: ReadoutValue<LoadBearingScope>;
  substitution: ReadoutValue<SubstitutionFeasibility> & {
    performanceParityRequired: boolean;
  };
  blocking: {
    values: BlockingMode[];
    basis: ReadoutBasis;
    confidence: ReadoutConfidence;
  };
  status: ReadoutValue<CurrentStatus> & {
    months?: number;
  };
};

type StoredNodeCoreReadout = NodeCoreReadout & { nodeId: string };

export const CORE_READOUT_FIELD_LABEL_KEYS = {
  scope: "coreReadoutScope",
  substitution: "coreReadoutSubstitution",
  blocking: "coreReadoutBlocking",
  status: "coreReadoutStatus",
} as const;

export const CORE_READOUT_SCOPE_LABEL_KEYS: Record<LoadBearingScope, string> = {
  product_mainline: "coreReadoutScopeProductMainline",
  route_or_module: "coreReadoutScopeRouteOrModule",
  structural_dependency: "coreReadoutScopeStructuralDependency",
  local_dependency: "coreReadoutScopeLocalDependency",
  unknown: "coreReadoutScopeUnknown",
};

export const CORE_READOUT_SUBSTITUTION_LABEL_KEYS: Record<SubstitutionFeasibility, string> = {
  no_equivalent_substitution: "coreReadoutSubstitutionNoEquivalent",
  partial_substitution: "coreReadoutSubstitutionPartial",
  degraded_substitution: "coreReadoutSubstitutionDegraded",
  supply_relief: "coreReadoutSubstitutionSupplyRelief",
  equivalent_substitution: "coreReadoutSubstitutionEquivalent",
  not_assessed: "coreReadoutSubstitutionNotAssessed",
};

export const CORE_READOUT_BLOCKING_LABEL_KEYS: Record<BlockingMode, string> = {
  capacity_scale: "coreReadoutBlockingCapacityScale",
  yield_ramp: "coreReadoutBlockingYieldRamp",
  equipment_lead_time: "coreReadoutBlockingEquipmentLeadTime",
  material_supply: "coreReadoutBlockingMaterialSupply",
  component_availability: "coreReadoutBlockingComponentAvailability",
  integration_qualification: "coreReadoutBlockingIntegrationQualification",
  technical_maturity: "coreReadoutBlockingTechnicalMaturity",
  regulatory_approval: "coreReadoutBlockingRegulatoryApproval",
  economic_validation: "coreReadoutBlockingEconomicValidation",
  operations_maintenance: "coreReadoutBlockingOperationsMaintenance",
  supply_concentration: "coreReadoutBlockingSupplyConcentration",
  unclassified: "coreReadoutBlockingUnclassified",
};

export const CORE_READOUT_STATUS_LABEL_KEYS: Record<CurrentStatus, string> = {
  constraining_now: "coreReadoutStatusConstrainingNow",
  expansion_relief: "coreReadoutStatusExpansionRelief",
  qualification: "coreReadoutStatusQualification",
  partially_easing: "coreReadoutStatusPartiallyEasing",
  structural_long_cycle: "coreReadoutStatusStructuralLongCycle",
  evidence_gap: "coreReadoutStatusEvidenceGap",
};

const storedReadoutsByNodeId = new Map(
  (aiComputeReadouts as StoredNodeCoreReadout[]).map((readout) => [readout.nodeId, readout]),
);

const CONSTRAINT_TAG_TO_BLOCKING_MODE: ReadonlyArray<[tag: string, mode: BlockingMode]> = [
  ["constraint_capacity_scale", "capacity_scale"],
  ["constraint_component_availability", "component_availability"],
  ["constraint_material_supply_chain", "material_supply"],
  ["constraint_integration_commissioning", "integration_qualification"],
  ["constraint_technical_maturity", "technical_maturity"],
  ["constraint_regulatory_approval", "regulatory_approval"],
  ["constraint_economic_validation", "economic_validation"],
  ["constraint_maintenance_operations", "operations_maintenance"],
  ["constraint_supply_concentration", "supply_concentration"],
];

const LOAD_BEARING_PARENT_KINDS = new Set<Node["kind"]>([
  "product",
  "capability",
  "module",
  "technical_route",
]);

export function coreReadoutForNode(graph: GraphData, node: Node): NodeCoreReadout {
  const stored = storedReadoutsByNodeId.get(node.id);
  if (stored) return stripStoredNodeId(stored);
  return {
    scope: deriveLoadBearingScope(graph, node),
    substitution: deriveSubstitutionFeasibility(graph, node),
    blocking: deriveBlockingModes(graph, node),
    status: deriveCurrentStatus(graph, node),
  };
}

function stripStoredNodeId(readout: StoredNodeCoreReadout): NodeCoreReadout {
  const { nodeId: _nodeId, ...core } = readout;
  return core;
}

function deriveLoadBearingScope(graph: GraphData, node: Node): ReadoutValue<LoadBearingScope> {
  if (node.kind === "product") {
    return { value: "product_mainline", basis: "explicit_graph", confidence: "high" };
  }

  const bottleneckTargets = (node.bottleneckOf ?? [])
    .map((id) => nodeById(graph, id))
    .filter((target): target is Node => Boolean(target && target.reviewStatus !== "deprecated"));
  const directParents = directDependents(graph, node.id)
    .map((id) => nodeById(graph, id))
    .filter((parent): parent is Node => Boolean(parent && parent.reviewStatus !== "deprecated"));

  if ([...bottleneckTargets, ...directParents].some((parent) => parent.kind === "product")) {
    return { value: "product_mainline", basis: "explicit_graph", confidence: "high" };
  }

  if (
    [...bottleneckTargets, ...directParents].some(
      (parent) => parent.kind === "module" || parent.kind === "technical_route" || parent.kind === "capability",
    )
  ) {
    return { value: "route_or_module", basis: "explicit_graph", confidence: "medium" };
  }

  const ancestorProducts = [...dependentAncestors(graph, node.id)]
    .map((id) => nodeById(graph, id))
    .filter((ancestor): ancestor is Node => Boolean(ancestor && ancestor.reviewStatus !== "deprecated" && ancestor.kind === "product"));
  if (ancestorProducts.length > 0) {
    return { value: "structural_dependency", basis: "derived_graph", confidence: "medium" };
  }

  if (directParents.some((parent) => LOAD_BEARING_PARENT_KINDS.has(parent.kind))) {
    return { value: "local_dependency", basis: "derived_graph", confidence: "low" };
  }

  return { value: "unknown", basis: "insufficient_signal", confidence: "low" };
}

function deriveSubstitutionFeasibility(
  graph: GraphData,
  node: Node,
): NodeCoreReadout["substitution"] {
  const edges = graph.edges.filter(
    (edge) =>
      edge.reviewStatus !== "deprecated" &&
      (edge.source === node.id || edge.target === node.id),
  );
  const text = nodeTextBundle(graph, node, edges);

  if (edges.some((edge) => edge.relation === "substitutes")) {
    return {
      value: "equivalent_substitution",
      basis: "explicit_graph",
      confidence: "medium",
      performanceParityRequired: false,
    };
  }

  if (edges.some((edge) => edge.relation === "second_source_candidate")) {
    return {
      value: "partial_substitution",
      basis: "explicit_graph",
      confidence: "low",
      performanceParityRequired: true,
    };
  }

  if (hasNoEquivalentSignal(text)) {
    return {
      value: "no_equivalent_substitution",
      basis: "text_inference",
      confidence: "medium",
      performanceParityRequired: true,
    };
  }

  const hasAlternativeSupplySignal = hasAlternativeSignal(text);
  const hasParityConstraint = hasPerformanceParityConstraint(text);
  if (hasAlternativeSupplySignal && hasParityConstraint) {
    return {
      value: "partial_substitution",
      basis: "text_inference",
      confidence: "medium",
      performanceParityRequired: true,
    };
  }

  if (hasAlternativeSupplySignal) {
    return {
      value: "supply_relief",
      basis: "text_inference",
      confidence: "low",
      performanceParityRequired: false,
    };
  }

  return {
    value: "not_assessed",
    basis: "insufficient_signal",
    confidence: "low",
    performanceParityRequired: false,
  };
}

function deriveBlockingModes(graph: GraphData, node: Node): NodeCoreReadout["blocking"] {
  const modes: BlockingMode[] = [];
  for (const [tag, mode] of CONSTRAINT_TAG_TO_BLOCKING_MODE) {
    if (node.tags?.includes(tag)) addUnique(modes, mode);
  }

  const text = nodeTextBundle(graph, node);
  if (/\b(capacity|scale|scaling|ramp|throughput|utilization|allocation)\b/.test(text)) addUnique(modes, "capacity_scale");
  if (/\b(yield|scrap|defect|learning curve)\b/.test(text)) addUnique(modes, "yield_ramp");
  if (/\b(equipment|tooling|tool lead|lead time|cycle time|delivery slot)\b/.test(text)) addUnique(modes, "equipment_lead_time");
  if (/\b(material|substrate|wafer|film|resin|glass|copper|chemical)\b/.test(text)) addUnique(modes, "material_supply");
  if (/\b(component|supply|supplier|single source|sole source|allocation)\b/.test(text)) addUnique(modes, "component_availability");
  if (/\b(integration|qualification|qualified|customer qual|certification|validation)\b/.test(text)) {
    addUnique(modes, "integration_qualification");
  }
  if (/\b(immature|prototype|technical maturity|engineering maturity)\b/.test(text)) addUnique(modes, "technical_maturity");
  if (/\b(regulatory|approval|permit|license)\b/.test(text)) addUnique(modes, "regulatory_approval");
  if (/\b(economic|unit economics|payback|business model|margin)\b/.test(text)) addUnique(modes, "economic_validation");
  if (/\b(maintenance|operations|uptime|service)\b/.test(text)) addUnique(modes, "operations_maintenance");
  if (/\b(concentrated|monopoly|duopoly|few suppliers|supplier concentration)\b/.test(text)) {
    addUnique(modes, "supply_concentration");
  }

  if (modes.length === 0) {
    return { values: ["unclassified"], basis: "insufficient_signal", confidence: "low" };
  }
  return {
    values: modes.slice(0, 4),
    basis: node.tags?.some((tag) => tag.startsWith("constraint_")) ? "explicit_graph" : "text_inference",
    confidence: node.tags?.some((tag) => tag.startsWith("constraint_")) ? "medium" : "low",
  };
}

function deriveCurrentStatus(graph: GraphData, node: Node): NodeCoreReadout["status"] {
  if (typeof node.capacityLeadTimeMonths === "number") {
    return {
      value: "constraining_now",
      basis: "explicit_graph",
      confidence: "medium",
      months: Math.round(node.capacityLeadTimeMonths),
    };
  }

  const metricMonths = monthsFromMetrics(node);
  if (metricMonths !== null) {
    return {
      value: metricMonths >= 18 ? "expansion_relief" : "partially_easing",
      basis: "explicit_graph",
      confidence: "medium",
      months: metricMonths,
    };
  }

  const text = nodeTextBundle(graph, node);
  const textMonths = firstMonthSignal(text);
  if (/\b(expansion|expanding|ramp|new capacity|capacity addition)\b/.test(text)) {
    return {
      value: "expansion_relief",
      basis: "text_inference",
      confidence: "low",
      ...(textMonths ? { months: textMonths } : {}),
    };
  }
  if (/\b(qualification|qualified|certification|validation)\b/.test(text)) {
    return {
      value: "qualification",
      basis: "text_inference",
      confidence: "low",
      ...(textMonths ? { months: textMonths } : {}),
    };
  }
  if (/\b(structural|long cycle|multi-year|multi year|monopoly|sole source|single source)\b/.test(text)) {
    return {
      value: "structural_long_cycle",
      basis: "text_inference",
      confidence: "low",
      ...(textMonths ? { months: textMonths } : {}),
    };
  }

  if ((node.bottleneckOf?.length ?? 0) > 0) {
    return { value: "constraining_now", basis: "explicit_graph", confidence: "medium" };
  }

  return { value: "evidence_gap", basis: "insufficient_signal", confidence: "low" };
}

function nodeTextBundle(graph: GraphData, node: Node, edges: Edge[] = graph.edges): string {
  const edgeText = edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .flatMap((edge) => [edge.claim, edge.context]);
  const metricText = (node.metrics ?? []).flatMap((metric) => [
    metric.name,
    metric.unit,
    metric.description,
    String(metric.currentValue ?? ""),
    String(metric.targetValue ?? ""),
  ]);
  return [
    node.id,
    node.name,
    node.description,
    node.notes,
    ...(node.tags ?? []),
    ...edgeText,
    ...metricText,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function hasAlternativeSignal(text: string): boolean {
  return /\b(alternative|alternate|second source|secondary source|second-source|multi-source|multi supplier|substitute|backup supplier|dual source|dual-source)\b/.test(text);
}

function hasPerformanceParityConstraint(text: string): boolean {
  return /\b(performance parity|parity|high-end|high end|leading edge|advanced node|qualification|qualified|customer qual|yield|reliability|lower-performance|lower performance|degraded|inferior)\b/.test(text);
}

function hasNoEquivalentSignal(text: string): boolean {
  return /\b(no equivalent|no drop-in|not drop-in|sole source|single source|only supplier|monopoly|duopoly|unique capability|cannot bypass|not substitutable|irreplaceable)\b/.test(text);
}

function monthsFromMetrics(node: Node): number | null {
  for (const metric of node.metrics ?? []) {
    const text = [metric.name, metric.unit, metric.description].filter(Boolean).join(" ").toLowerCase();
    if (!/\b(month|lead|ramp|cycle|capacity)\b/.test(text)) continue;
    const value = metric.currentValue;
    if (typeof value === "number") return Math.round(value);
    if (value && typeof value === "object") return Math.round(value.typical);
  }
  return null;
}

function firstMonthSignal(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*(?:month|months|mo)\b/);
  return match ? Number(match[1]) : null;
}

function addUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}
