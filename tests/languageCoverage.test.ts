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
