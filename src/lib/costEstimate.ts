import { isArtifactCanvasNode } from "./canvasGraph";
import { isNonCostRequiresChild, rollupCost } from "./costRollup";
import { incomingEdges, nodeById, outgoingEdges } from "./graphTraversal";
import type { GraphData, Node } from "./schema";

export type EstimatedCostRangeRmb = {
  min: number;
  typical: number;
  max: number;
};

export type EstimatedCostSignal = {
  range: EstimatedCostRangeRmb;
  basis: string;
  basisKind: "heuristic" | "parent_bounded";
  confidence: "low";
  costAsOf: "2026";
  parentId?: string;
  parentName?: string;
};

const ESTIMATE_SPREAD = { min: 0.4, max: 2.5 } as const;
const graphEstimateCache = new WeakMap<GraphData, Map<string, EstimatedCostSignal | null>>();

export function estimatedCostForNode(node: Node): EstimatedCostSignal | null {
  if (!isArtifactCanvasNode(node)) return null;
  if (node.kind === "product") return null;
  if (node.reviewStatus === "deprecated") return null;

  const domain = new Set(node.domain ?? []);
  const text = `${node.id} ${node.name} ${node.description ?? ""} ${(node.tags ?? []).join(" ")}`.toLowerCase();

  if (domain.has("test")) return null;
  if (domain.has("humanoid_robotics")) return makeEstimate(humanoidTypicalRmb(node, text), node);
  if (domain.has("ai_compute_chain")) return makeEstimate(aiComputeTypicalRmb(node, text), node);
  if (domain.has("controlled_fusion") || domain.has("commercial_fusion")) return makeEstimate(fusionTypicalRmb(node, text), node);
  if (
    domain.has("space_spacex") ||
    domain.has("spacex_reusable_launch") ||
    domain.has("spacex_orbital_data_center") ||
    domain.has("reusable_space_transport")
  ) {
    return makeEstimate(spaceTypicalRmb(node, text), node);
  }
  if (domain.has("parcel_sorting_robot")) return makeEstimate(parcelTypicalRmb(node, text), node);
  if (domain.has("iphone_4")) return makeEstimate(iphoneTypicalRmb(node, text), node);
  if (domain.has("glp1_weight_loss_drugs")) return makeEstimate(pharmaTypicalRmb(node, text), node);
  if (domain.has("ultra_small_nuclear_reactor")) return makeEstimate(nuclearTypicalRmb(node, text), node);
  if (domain.has("ak47_industrial_case")) return makeEstimate(historicalManufacturingTypicalRmb(node, text), node);

  return makeEstimate(genericTypicalRmb(node, text), node);
}

export function estimatedCostForGraphNode(graph: GraphData, node: Node): EstimatedCostSignal | null {
  let cache = graphEstimateCache.get(graph);
  if (!cache) {
    cache = new Map<string, EstimatedCostSignal | null>();
    graphEstimateCache.set(graph, cache);
  }
  if (cache.has(node.id)) return cache.get(node.id)!;

  const baseline = estimatedCostForNode(node);
  if (!baseline) {
    cache.set(node.id, null);
    return null;
  }

  const bounded = parentBoundedEstimateFor(graph, node, baseline);
  const result = bounded ?? baseline;
  cache.set(node.id, result);
  return result;
}

function makeEstimate(typical: number | null, node: Node): EstimatedCostSignal | null {
  if (typical === null || typical <= 0) return null;
  return {
    range: rangeFromTypical(typical),
    basis: `Low-confidence heuristic estimate from node kind (${node.kind}), domain, tags, and bottleneck labels. Not a supplier quote, audited BOM, or reviewed capex source.`,
    basisKind: "heuristic",
    confidence: "low",
    costAsOf: "2026",
  };
}

function rangeFromTypical(typical: number): EstimatedCostRangeRmb {
  return {
    min: Math.round(typical * ESTIMATE_SPREAD.min),
    typical: Math.round(typical),
    max: Math.round(typical * ESTIMATE_SPREAD.max),
  };
}

function parentBoundedEstimateFor(
  graph: GraphData,
  node: Node,
  baseline: EstimatedCostSignal,
): EstimatedCostSignal | null {
  let strictest: EstimatedCostSignal | null = null;
  for (const edge of incomingEdges(graph, node.id, "requires")) {
    if (edge.reviewStatus === "deprecated" || edge.reviewStatus === "disputed") continue;
    const parent = nodeById(graph, edge.source);
    if (!parent || parent.reviewStatus === "deprecated") continue;
    const allocation = allocateFromDirectParentBudget(graph, parent, node, baseline);
    if (!allocation) continue;
    if (!strictest || allocation.range.typical < strictest.range.typical) {
      strictest = allocation;
    }
  }
  return strictest;
}

function allocateFromDirectParentBudget(
  graph: GraphData,
  parent: Node,
  node: Node,
  baseline: EstimatedCostSignal,
): EstimatedCostSignal | null {
  const parentDirect = directParentBudgetTypical(graph, parent.id);
  if (parentDirect === null || parentDirect <= 0) return null;

  const children = activeCostChildren(graph, parent.id);
  if (!children.some((child) => child.id === node.id)) return null;

  let knownChildrenTypical = 0;
  let unknownBaselineTypical = 0;
  for (const child of children) {
    const known = sourcedCostTypicalRmb(graph, child.id);
    if (known !== null && known > 0) {
      knownChildrenTypical += known;
      continue;
    }
    const childEstimate = child.id === node.id ? baseline : estimatedCostForNode(child);
    if (childEstimate) unknownBaselineTypical += childEstimate.range.typical;
  }

  const remainingBudget = parentDirect - knownChildrenTypical;
  if (remainingBudget <= 0 || unknownBaselineTypical <= 0) {
    return null;
  }
  if (unknownBaselineTypical <= remainingBudget) {
    return null;
  }

  const allocatedTypical = baseline.range.typical * (remainingBudget / unknownBaselineTypical);
  if (!Number.isFinite(allocatedTypical) || allocatedTypical <= 0) return null;
  if (allocatedTypical >= baseline.range.typical) return null;

  return {
    range: rangeFromTypical(allocatedTypical),
    basis:
      `Low-confidence heuristic estimate scaled against direct parent cost/capex on ${parent.id}. ` +
      "Known child rollups are subtracted first; remaining budget is allocated across unpriced children by heuristic weight. Not a supplier quote, audited BOM, or reviewed capex source.",
    basisKind: "parent_bounded",
    confidence: "low",
    costAsOf: "2026",
    parentId: parent.id,
    parentName: parent.name,
  };
}

function directParentBudgetTypical(graph: GraphData, parentId: string): number | null {
  try {
    const result = rollupCost(graph, parentId);
    return result.directOnly?.typical ?? null;
  } catch {
    return null;
  }
}

function sourcedCostTypicalRmb(graph: GraphData, nodeId: string): number | null {
  try {
    const result = rollupCost(graph, nodeId);
    if (result.directOnly || result.anyChildContributed) return result.rolledUp.typical;
    return null;
  } catch {
    return null;
  }
}

function activeCostChildren(graph: GraphData, parentId: string): Node[] {
  const children: Node[] = [];
  for (const edge of outgoingEdges(graph, parentId, "requires")) {
    if (edge.reviewStatus === "deprecated" || edge.reviewStatus === "disputed") continue;
    const child = nodeById(graph, edge.target);
    if (!child || child.reviewStatus === "deprecated") continue;
    if (isNonCostRequiresChild(child)) continue;
    children.push(child);
  }
  return children;
}

function hasAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function humanoidTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["factory", "end-of-line", "calibration rig", "burn-in", "field service"])) return 250_000;
  if (hasAny(text, ["actuation", "joint", "reducer", "strain wave", "motor", "linear actuator"])) return 45_000;
  if (hasAny(text, ["battery", "charging", "power"])) return 28_000;
  if (hasAny(text, ["compute", "gpu", "ai accelerator", "jetson"])) return 35_000;
  if (hasAny(text, ["lidar", "camera", "imu", "sensor", "tactile", "force"])) return 12_000;
  if (hasAny(text, ["thermal", "cooling", "heat"])) return 10_000;
  if (hasAny(text, ["safety", "controller", "mcu", "estop", "e-stop"])) return 8_000;
  if (node.kind === "equipment") return 15_000;
  if (node.kind === "material") return 6_000;
  return 20_000;
}

function aiComputeTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["high-na", "euv", "projection optics", "lithography"])) return 300_000_000;
  if (hasAny(text, ["hbm", "thermocompression", "tcb", "bonding", "test equipment"])) return 80_000_000;
  if (hasAny(text, ["advanced packaging", "cowos", "interposer", "substrate"])) return 60_000_000;
  if (hasAny(text, ["mocvd", "epi", "laser", "optical", "transceiver"])) return 25_000_000;
  if (hasAny(text, ["thermal", "cooling", "cold plate", "liquid"])) return 12_000_000;
  if (node.kind === "equipment") return 18_000_000;
  if (node.kind === "material") return 8_000_000;
  return 20_000_000;
}

function fusionTypicalRmb(node: Node, text: string): number {
  if (node.kind === "technical_route") return 1_000_000_000;
  if (hasAny(text, ["magnet", "coil", "superconduct", "cryoplant"])) return 500_000_000;
  if (hasAny(text, ["laser", "beam", "driver", "injector"])) return 450_000_000;
  if (hasAny(text, ["tritium", "blanket", "breeding", "fuel cycle"])) return 300_000_000;
  if (hasAny(text, ["first wall", "divertor", "plasma facing", "tungsten", "neutron"])) return 200_000_000;
  if (node.kind === "equipment") return 150_000_000;
  if (node.kind === "material") return 50_000_000;
  return 180_000_000;
}

function spaceTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["booster", "starship", "stage", "launch vehicle"])) return 500_000_000;
  if (hasAny(text, ["raptor", "engine", "turbopump", "combustion"])) return 80_000_000;
  if (hasAny(text, ["satellite", "orbital data center", "data center", "compute payload"])) return 200_000_000;
  if (hasAny(text, ["thermal", "power", "solar", "battery", "radiator"])) return 60_000_000;
  if (hasAny(text, ["optical", "laser", "network", "gateway", "antenna"])) return 40_000_000;
  if (hasAny(text, ["propellant", "methane", "oxygen", "cryo"])) return 20_000_000;
  if (node.kind === "equipment") return 50_000_000;
  if (node.kind === "material") return 15_000_000;
  return 40_000_000;
}

function parcelTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["robot arm", "industrial arm", "manipulator"])) return 120_000;
  if (hasAny(text, ["vision", "camera", "barcode", "ocr", "compute"])) return 25_000;
  if (hasAny(text, ["conveyor", "induction", "drive", "sortation"])) return 45_000;
  if (hasAny(text, ["vacuum", "suction", "gripper", "end effector"])) return 18_000;
  if (hasAny(text, ["safety", "sensor", "light curtain"])) return 12_000;
  if (node.kind === "equipment") return 30_000;
  if (node.kind === "material") return 6_000;
  return 20_000;
}

function iphoneTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["display", "retina", "touch"])) return 320;
  if (hasAny(text, ["soc", "compute", "a4", "semiconductor"])) return 160;
  if (hasAny(text, ["radio", "rf", "wireless"])) return 90;
  if (hasAny(text, ["glass", "enclosure", "stainless", "mechanical"])) return 140;
  if (hasAny(text, ["battery"])) return 55;
  if (hasAny(text, ["camera"])) return 45;
  if (hasAny(text, ["software"])) return 120;
  return 100;
}

function pharmaTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["clinical", "safety", "efficacy"])) return 500_000_000;
  if (hasAny(text, ["api", "active ingredient", "peptide"])) return 80_000_000;
  if (hasAny(text, ["device", "delivery", "pen", "injector"])) return 12_000_000;
  if (hasAny(text, ["cold chain", "capacity", "manufacturing"])) return 120_000_000;
  return 50_000_000;
}

function nuclearTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["core", "fuel"])) return 600_000_000;
  if (hasAny(text, ["heat", "thermal", "transport"])) return 180_000_000;
  if (hasAny(text, ["power conversion", "turbine", "generator"])) return 120_000_000;
  if (hasAny(text, ["spent fuel", "transport", "storage"])) return 80_000_000;
  if (node.kind === "equipment") return 120_000_000;
  return 150_000_000;
}

function historicalManufacturingTypicalRmb(node: Node, text: string): number {
  if (hasAny(text, ["tooling", "gauge", "inspection", "acceptance"])) return 250_000;
  if (hasAny(text, ["receiver", "manufacturing", "route"])) return 500_000;
  if (hasAny(text, ["barrel", "heat treat"])) return 120_000;
  if (hasAny(text, ["stock", "furniture", "materials"])) return 20_000;
  return 80_000;
}

function genericTypicalRmb(node: Node, text: string): number {
  if (node.kind === "technical_route") return 5_000_000;
  if (hasAny(text, ["factory", "line", "facility", "plant"])) return 2_000_000;
  if (hasAny(text, ["equipment", "tooling", "rig", "test"])) return 250_000;
  if (hasAny(text, ["thermal", "power", "compute", "sensor", "control"])) return 60_000;
  if (node.kind === "equipment") return 200_000;
  if (node.kind === "material") return 30_000;
  return 80_000;
}
