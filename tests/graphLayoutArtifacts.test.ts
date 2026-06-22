import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  graphLayoutArtifactPath,
  graphLayoutFingerprint,
  loadGraphLayoutArtifact,
  requiredGraphLayoutSpecs,
} from "../src/lib/graphLayoutArtifacts";
import { loadActiveGraphData } from "../src/lib/graphLoader";

test("live domain graph layouts are persisted and match the current graph data", () => {
  const specs = requiredGraphLayoutSpecs();
  assert.ok(specs.length > 0, "expected at least one required graph layout spec");
  assert.ok(
    specs.some((spec) => spec.slug === "ai-compute" && spec.layer === "product"),
    "ai-compute product layout must be a required persisted artifact",
  );

  for (const spec of specs) {
    const filePath = graphLayoutArtifactPath(spec);
    assert.ok(fs.existsSync(filePath), `missing graph layout artifact: ${filePath}`);

    const artifact = loadGraphLayoutArtifact(spec);
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.slug, spec.slug);
    assert.equal(artifact.rootId, spec.rootId);
    assert.equal(artifact.layer, spec.layer);
    assert.equal(
      artifact.fingerprint,
      graphLayoutFingerprint(loadActiveGraphData(spec.rootId), spec.rootId, spec.layer),
      `stale graph layout artifact: ${filePath}`,
    );
    assert.ok(
      Object.keys(artifact.nodePositions).length > 0,
      `graph layout artifact must contain node positions: ${filePath}`,
    );
  }
});

test("GraphExplorer uses persisted layout artifacts before running edge-aware packing", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "components", "GraphExplorer.tsx"), "utf8");
  const layoutSelectionBlock =
    source.match(/const precomputedNodePositions = useMemo\([\s\S]*?const packedNodePositions = useMemo\([\s\S]*?\n  }, \[[^\]]+\]\);/)?.[0] ?? "";
  const precomputedIndex = layoutSelectionBlock.indexOf("precomputedNodePositions");
  const fallbackIndex = layoutSelectionBlock.indexOf("computeGraphLayoutPositions");

  assert.notEqual(precomputedIndex, -1, "GraphExplorer must accept precomputed graph layout artifacts");
  assert.notEqual(fallbackIndex, -1, "GraphExplorer may keep a layout fallback for custom roots");
  assert.ok(
    precomputedIndex < fallbackIndex,
    "GraphExplorer should consult precomputed layouts before the expensive edge-aware fallback",
  );
});
