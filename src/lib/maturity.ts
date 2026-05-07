import { bottlenecksForNode, metricsForNode, requiredModules, routesForModule, routesForProduct, targets } from "./graphTraversal";
import type { GraphData, Node } from "./schema";

export type MaturityBreakdown = {
  nodeId: string;
  score: number;
  label: string;
  explanation: string;
  blockers: Node[];
};

function baseScore(node: Node | undefined): number {
  if (!node) return 0;
  if (typeof node.maturityScore === "number") return node.maturityScore;
  switch (node.maturityLabel) {
    case "mature":
      return 90;
    case "widely_adopted":
      return 85;
    case "commercially_available":
      return 75;
    case "early_deployment":
      return 60;
    case "prototype":
      return 45;
    case "lab_proven":
      return 35;
    case "hypothesis":
      return 20;
    case "blocked":
      return 10;
    default:
      return 25;
  }
}

function labelForScore(score: number): string {
  if (score >= 85) return "mature";
  if (score >= 75) return "commercially_available";
  if (score >= 60) return "early_deployment";
  if (score >= 45) return "prototype";
  if (score >= 30) return "lab_proven";
  if (score >= 15) return "hypothesis";
  return "blocked";
}

export function routeMaturity(graph: GraphData, route: Node): MaturityBreakdown {
  const enablers = targets(graph, route.id, "requires");
  const metrics = metricsForNode(graph, route.id);
  const blockers = bottlenecksForNode(graph, route.id);
  const enablerScore = enablers.length ? average(enablers.map(baseScore)) : baseScore(route);
  const metricScore = metrics.length ? average(metrics.map(baseScore)) : enablerScore;
  const blockerCap = blockers.some((node) => node.kind === "placeholder_breakthrough") ? 45 : blockers.length ? 65 : 100;
  const score = Math.round(Math.min(average([enablerScore, metricScore, baseScore(route)]), blockerCap));

  return {
    nodeId: route.id,
    score,
    label: labelForScore(score),
    blockers,
    explanation: `${route.name} score combines route maturity, required enablers, metric progress, and bottleneck caps.`,
  };
}

export function moduleMaturity(graph: GraphData, module: Node): MaturityBreakdown {
  const routes = routesForModule(graph, module.id);
  if (!routes.length) {
    const blockers = bottlenecksForNode(graph, module.id);
    const score = Math.min(baseScore(module), blockers.length ? 65 : 100);
    return {
      nodeId: module.id,
      score,
      label: labelForScore(score),
      blockers,
      explanation: `${module.name} has no explicit routes yet, so its score uses direct maturity and bottlenecks.`,
    };
  }
  const routeScores = routes.map((route) => routeMaturity(graph, route));
  const best = routeScores.reduce((current, candidate) => (candidate.score > current.score ? candidate : current));
  return {
    ...best,
    nodeId: module.id,
    explanation: `${module.name} uses the strongest currently available route: ${best.nodeId}.`,
  };
}

export function productMaturity(graph: GraphData, product: Node): MaturityBreakdown {
  const modules = requiredModules(graph, product.id);
  const moduleScores = modules.map((module) => moduleMaturity(graph, module));
  const productRoutes = routesForProduct(graph, product.id).map((route) => routeMaturity(graph, route));
  const blockers = [...bottlenecksForNode(graph, product.id), ...moduleScores.flatMap((item) => item.blockers)];
  const moduleAverage = moduleScores.length ? average(moduleScores.map((item) => item.score)) : baseScore(product);
  const routeAverage = productRoutes.length ? average(productRoutes.map((item) => item.score)) : moduleAverage;
  const blockerCap = blockers.some((node) => node.kind === "placeholder_breakthrough") ? 55 : blockers.length ? 70 : 100;
  const score = Math.round(Math.min(average([baseScore(product), moduleAverage, routeAverage]), blockerCap));

  return {
    nodeId: product.id,
    score,
    label: labelForScore(score),
    blockers,
    explanation: `${product.name} score is derived from required modules, route maturity, metric progress, and active bottlenecks.`,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
