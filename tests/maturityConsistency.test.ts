import test from "node:test";
import assert from "node:assert/strict";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const matureLabels = new Set(["commercially_available", "widely_adopted", "mature"]);

test("active graph: every expanded immature node has at least one immature direct dependency", () => {
  const graph = loadActiveGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const violations: string[] = [];
  for (const node of graph.nodes) {
    if (matureLabels.has(node.maturityLabel ?? "unknown")) continue;
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0) continue;
    const immatureChildren = children.filter((id) => !matureLabels.has(nodeById.get(id)?.maturityLabel ?? "unknown"));
    if (immatureChildren.length > 0) continue;

    violations.push(
      `${node.id} (${node.maturityLabel ?? "unknown"}) has only mature direct requires children: ` +
        children.map((id) => `${id} (${nodeById.get(id)?.maturityLabel ?? "unknown"})`).join(", "),
    );
  }

  assert.deepEqual(violations, []);
});
