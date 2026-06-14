import { isArtifactCanvasNode } from "./canvasGraph";
import type { Node } from "./schema";

export type EstimatedCostRangeRmb = {
  min: number;
  typical: number;
  max: number;
};

export type EstimatedCostSignal = {
  range: EstimatedCostRangeRmb;
  basis: string;
  confidence: "low";
  costAsOf: "2026";
};

const ESTIMATE_SPREAD = { min: 0.4, max: 2.5 } as const;

export function estimatedCostForNode(node: Node): EstimatedCostSignal | null {
  if (!isArtifactCanvasNode(node)) return null;
  if (node.kind === "product") return null;
  if (node.reviewStatus === "deprecated") return null;

  const domain = new Set(node.domain ?? []);
  const text = `${node.id} ${node.name} ${node.description ?? ""} ${(node.tags ?? []).join(" ")}`.toLowerCase();

  if (domain.has("humanoid_robotics")) return makeEstimate(humanoidTypicalRmb(node, text), node);
  if (domain.has("ai_compute_chain")) return makeEstimate(aiComputeTypicalRmb(node, text), node);
  if (domain.has("controlled_fusion")) return makeEstimate(fusionTypicalRmb(node, text), node);
  if (
    domain.has("space_spacex") ||
    domain.has("spacex_reusable_launch") ||
    domain.has("spacex_orbital_data_center")
  ) {
    return makeEstimate(spaceTypicalRmb(node, text), node);
  }

  return null;
}

function makeEstimate(typical: number | null, node: Node): EstimatedCostSignal | null {
  if (typical === null || typical <= 0) return null;
  return {
    range: {
      min: Math.round(typical * ESTIMATE_SPREAD.min),
      typical: Math.round(typical),
      max: Math.round(typical * ESTIMATE_SPREAD.max),
    },
    basis: `Low-confidence heuristic estimate from node kind (${node.kind}), domain, tags, and bottleneck labels. Not a supplier quote, audited BOM, or reviewed capex source.`,
    confidence: "low",
    costAsOf: "2026",
  };
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
