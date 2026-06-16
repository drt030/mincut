import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { filterCanvasGraph } from "../src/lib/canvasGraph";

function chineseNodeKeys(): Set<string> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "LanguageProvider.tsx"),
    "utf8",
  );
  const block = raw.match(/const nodeTextZh: Record<string, string> = \{([\s\S]*?)\n\};/)?.[1] ?? "";
  // Keys whose ids start with a digit (e.g. 48v_converter_module) are
  // necessarily quoted in the dictionary literal — accept both forms.
  return new Set([...block.matchAll(/^\s*"?([a-zA-Z0-9_]+)"?:/gm)].map((match) => match[1]));
}

// Domains whose roots live OUTSIDE the active (parcel-sorting) graph and are
// therefore never reached by loadActiveGraphData()/filterCanvasGraph above.
// We read their node files directly so the Chinese-coverage test is a real gate
// for every node id in the domain — including organization/standard nodes that
// are not part of the canvas tree — rather than a false-pass.
const NON_ACTIVE_GRAPH_DOMAINS = [
  { root: "humanoid_robot_key_component_stack", file: "humanoid_robotics.json" },
] as const;

function nodesFromDataFile(file: string): { id: string; name: string }[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "nodes", file), "utf8"),
  ) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : (raw as { nodes?: unknown[] }).nodes ?? [];
  return (list as Array<{ id: string; label?: string; name?: string }>).map((node) => ({
    id: node.id,
    name: node.label ?? node.name ?? node.id,
  }));
}

test("Chinese node-name dictionary covers all visible active graph roots checked in UX", () => {
  const graph = loadActiveGraphData();
  const zhKeys = chineseNodeKeys();
  const roots = [
    undefined,
    "industrial_robot_arm_body",
    "precision_reducer_gearbox",
    "robot_controller_io",
    "vision_barcode_label_recognition",
    "parcel_manipulation_or_diverter",
  ] as const;
  const missing: string[] = [];

  for (const root of roots) {
    const canvas = filterCanvasGraph(graph, root);
    for (const node of canvas.nodes) {
      if (!zhKeys.has(node.id)) {
        missing.push(`${root ?? "default"}: ${node.id} | ${node.name}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `every visible canvas node in the default and recursive research-root views should have a Simplified Chinese label; missing:\n${missing.join("\n")}`,
  );
});

test("Chinese node-name dictionary covers every node in non-active-graph domains (e.g. humanoid_robotics)", () => {
  const zhKeys = chineseNodeKeys();
  const missing: string[] = [];

  for (const domain of NON_ACTIVE_GRAPH_DOMAINS) {
    const nodes = nodesFromDataFile(domain.file);
    assert.ok(
      nodes.some((node) => node.id === domain.root),
      `expected domain root ${domain.root} to exist in data/nodes/${domain.file}`,
    );
    for (const node of nodes) {
      if (!zhKeys.has(node.id)) {
        missing.push(`${domain.root}: ${node.id} | ${node.name}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `every node in a non-active-graph domain should have a Simplified Chinese label; missing:\n${missing.join("\n")}`,
  );
});
