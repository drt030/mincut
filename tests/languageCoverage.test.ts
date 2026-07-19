import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { filterCanvasGraph } from "../src/lib/canvasGraph";

function languageProviderSource(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src", "components", "LanguageProvider.tsx"),
    "utf8",
  );
}

function dictionaryKeys(dictName: string): Set<string> {
  const raw = languageProviderSource();
  const block = raw.match(
    new RegExp(`const ${dictName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`),
  )?.[1] ?? "";
  // Keys whose ids start with a digit (e.g. 48v_converter_module) are
  // necessarily quoted in the dictionary literal — accept both forms.
  return new Set([...block.matchAll(/^\s*"?([a-zA-Z0-9_]+)"?:/gm)].map((match) => match[1]));
}

function chineseNodeKeys(): Set<string> {
  return dictionaryKeys("nodeTextZh");
}

function chineseDescriptionKeys(): Set<string> {
  return dictionaryKeys("nodeDescriptionZh");
}

// Per FF-3 (Gate F): zh mode previously showed zh node NAMES but English
// `description`/核心判断 bodies. These domains are the expansion targets whose
// rail core-judgment must read Chinese; every node that carries an English
// `description` must have a parallel `nodeDescriptionZh` entry. We load the
// rendered domain graph the same way `/d/<slug>` does so cross-domain nodes
// pulled into the tree are covered too. Organization nodes are excluded —
// their identities stay behind the exposure paywall and are never rendered.
const ZH_DESCRIPTION_DOMAINS = [
  { label: "spacex_reusable_launch", root: "spacex_reusable_launch_stack" },
  { label: "humanoid_robotics", root: "humanoid_robot_key_component_stack" },
] as const;

// Domains whose roots live OUTSIDE the active (parcel-sorting) graph and are
// therefore never reached by loadActiveGraphData()/filterCanvasGraph above.
// We read their node files directly so the Chinese-coverage test is a real gate
// for every node id in the domain — including organization/standard nodes that
// are not part of the canvas tree — rather than a false-pass.
const NON_ACTIVE_GRAPH_DOMAINS = [
  { root: "humanoid_robot_key_component_stack", file: "humanoid_robotics.json" },
] as const;

function nodesFromDataFile(file: string): { id: string; kind?: string; name: string }[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "nodes", file), "utf8"),
  ) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : (raw as { nodes?: unknown[] }).nodes ?? [];
  return (list as Array<{ id: string; kind?: string; label?: string; name?: string }>).map((node) => ({
    id: node.id,
    kind: node.kind,
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

test("Chinese node-name dictionary covers every non-organization node in non-active-graph domains", () => {
  const zhKeys = chineseNodeKeys();
  const missing: string[] = [];

  for (const domain of NON_ACTIVE_GRAPH_DOMAINS) {
    const nodes = nodesFromDataFile(domain.file);
    assert.ok(
      nodes.some((node) => node.id === domain.root),
      `expected domain root ${domain.root} to exist in data/nodes/${domain.file}`,
    );
    for (const node of nodes) {
      // Organization identities are entitlement-gated and must not ship in
      // this public client dictionary. Unlocked records fall back to the
      // server-provided proper name.
      if (node.kind === "organization") continue;
      if (!zhKeys.has(node.id)) {
        missing.push(`${domain.root}: ${node.id} | ${node.name}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `every non-organization node in a non-active-graph domain should have a Simplified Chinese label; missing:\n${missing.join("\n")}`,
  );
});

test("Chinese node-DESCRIPTION dictionary covers every described node in spacex_reusable_launch + humanoid_robotics", () => {
  const zhDescriptionKeys = chineseDescriptionKeys();
  const missing: string[] = [];

  for (const domain of ZH_DESCRIPTION_DOMAINS) {
    const graph = loadActiveGraphData(domain.root);
    assert.ok(
      graph.nodes.some((node) => node.id === domain.root),
      `expected domain root ${domain.root} to be present in the rendered graph`,
    );
    const described = graph.nodes.filter(
      (node) =>
        node.kind !== "organization" &&
        node.reviewStatus !== "deprecated" &&
        typeof node.description === "string" &&
        node.description.trim().length > 0,
    );
    assert.ok(
      described.length > 0,
      `expected ${domain.label} to have at least one described non-org node`,
    );
    for (const node of described) {
      if (!zhDescriptionKeys.has(node.id)) {
        missing.push(`${domain.label}: ${node.id} | ${node.name}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `every node with an English description in these domains should have a Simplified Chinese description (nodeDescriptionZh); missing:\n${missing.join("\n")}`,
  );
});
