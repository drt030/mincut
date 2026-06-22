import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DOMAIN_PORTFOLIO_ENTRIES } from "./domains";
import { filterCanvasGraph } from "./canvasGraph";
import { computeGraphLayoutPositions } from "./graphLayoutPositions";
import type { GraphLayoutArtifact, GraphLayoutLayer } from "./graphLayoutArtifactTypes";
import type { Edge, GraphData, Node } from "./schema";

export type GraphLayoutSpec = {
  slug: string;
  rootId: string;
  layer: GraphLayoutLayer;
};

const LAYOUT_LAYERS: readonly GraphLayoutLayer[] = ["product", "knowhow"];
const dataRoot = path.join(process.cwd(), "data");
const layoutRoot = path.join(dataRoot, "layouts");

export function requiredGraphLayoutSpecs(): GraphLayoutSpec[] {
  return DOMAIN_PORTFOLIO_ENTRIES.flatMap((entry) => {
    if (!entry.liveGraphRoute) return [];
    return LAYOUT_LAYERS.map((layer) => ({
      slug: entry.slug,
      rootId: entry.rootId,
      layer,
    }));
  });
}

export function graphLayoutArtifactPath(spec: GraphLayoutSpec): string {
  return path.join(layoutRoot, `${spec.slug}.${spec.layer}.json`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function layoutRelevantNode(node: Node) {
  return {
    id: node.id,
    kind: node.kind,
    reviewStatus: node.reviewStatus,
    tags: [...(node.tags ?? [])].sort(),
  };
}

function layoutRelevantEdge(edge: Edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relation: edge.relation,
    reviewStatus: edge.reviewStatus,
    weight: edge.weight ?? null,
  };
}

export function graphLayoutFingerprint(
  graph: GraphData,
  rootId: string,
  layer: GraphLayoutLayer,
): string {
  const canvasGraph = filterCanvasGraph(graph, rootId);
  const payload = {
    schemaVersion: 1,
    rootId,
    layer,
    nodes: canvasGraph.nodes
      .map(layoutRelevantNode)
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: canvasGraph.edges
      .map(layoutRelevantEdge)
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return crypto.createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function buildGraphLayoutArtifact(
  spec: GraphLayoutSpec,
  graph: GraphData,
  generatedAt = new Date().toISOString(),
): GraphLayoutArtifact {
  const positions = computeGraphLayoutPositions(graph, spec.rootId, spec.layer);
  const nodePositions = Object.fromEntries(
    [...positions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, point]) => [id, { x: Number(point.x.toFixed(6)), y: Number(point.y.toFixed(6)) }]),
  );
  return {
    schemaVersion: 1,
    slug: spec.slug,
    rootId: spec.rootId,
    layer: spec.layer,
    fingerprint: graphLayoutFingerprint(graph, spec.rootId, spec.layer),
    generatedAt,
    nodePositions,
  };
}

export function loadGraphLayoutArtifact(spec: GraphLayoutSpec): GraphLayoutArtifact {
  const artifact = JSON.parse(fs.readFileSync(graphLayoutArtifactPath(spec), "utf8")) as GraphLayoutArtifact;
  if (artifact.schemaVersion !== 1) {
    throw new Error(`Unsupported graph layout artifact schema: ${graphLayoutArtifactPath(spec)}`);
  }
  return artifact;
}

export function writeGraphLayoutArtifact(spec: GraphLayoutSpec, artifact: GraphLayoutArtifact): void {
  fs.mkdirSync(layoutRoot, { recursive: true });
  fs.writeFileSync(graphLayoutArtifactPath(spec), `${JSON.stringify(artifact, null, 2)}\n`);
}

export function loadCurrentGraphLayoutArtifactsForRoot(rootId: string, graph: GraphData): GraphLayoutArtifact[] {
  return requiredGraphLayoutSpecs()
    .filter((spec) => spec.rootId === rootId)
    .map((spec) => {
      const filePath = graphLayoutArtifactPath(spec);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing precomputed graph layout artifact: ${filePath}`);
      }
      const artifact = loadGraphLayoutArtifact(spec);
      const expected = graphLayoutFingerprint(graph, spec.rootId, spec.layer);
      if (artifact.fingerprint !== expected) {
        throw new Error(`Stale precomputed graph layout artifact: ${filePath}`);
      }
      return artifact;
    });
}
