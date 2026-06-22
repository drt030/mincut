import fs from "node:fs";
import {
  buildGraphLayoutArtifact,
  graphLayoutArtifactPath,
  graphLayoutFingerprint,
  loadGraphLayoutArtifact,
  requiredGraphLayoutSpecs,
  writeGraphLayoutArtifact,
} from "../src/lib/graphLayoutArtifacts";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const checkOnly = process.argv.includes("--check");

let failures = 0;

for (const spec of requiredGraphLayoutSpecs()) {
  const graph = loadActiveGraphData(spec.rootId);
  const filePath = graphLayoutArtifactPath(spec);

  if (checkOnly) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing graph layout artifact: ${filePath}`);
      failures += 1;
      continue;
    }
    const artifact = loadGraphLayoutArtifact(spec);
    const expected = graphLayoutFingerprint(graph, spec.rootId, spec.layer);
    if (artifact.fingerprint !== expected) {
      console.error(`Stale graph layout artifact: ${filePath}`);
      failures += 1;
    }
    continue;
  }

  const artifact = buildGraphLayoutArtifact(spec, graph);
  writeGraphLayoutArtifact(spec, artifact);
  console.log(`Wrote ${filePath}`);
}

if (failures > 0) {
  process.exitCode = 1;
}
