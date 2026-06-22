import type { PackedPoint } from "./cardAwareLayout";

export type GraphLayoutLayer = "product" | "knowhow";

export type GraphLayoutArtifact = {
  schemaVersion: 1;
  slug: string;
  rootId: string;
  layer: GraphLayoutLayer;
  fingerprint: string;
  generatedAt: string;
  nodePositions: Record<string, PackedPoint>;
};

export function graphLayoutPositionMap(artifact: GraphLayoutArtifact): Map<string, PackedPoint> {
  return new Map(
    Object.entries(artifact.nodePositions).map(([id, point]) => [id, { x: point.x, y: point.y }]),
  );
}
