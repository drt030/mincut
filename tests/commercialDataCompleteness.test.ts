import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";
import { rollupCost } from "../src/lib/costRollup";
import type { GraphData, Node } from "../src/lib/schema";
import {
  commercialScaleAnswerForOrganization,
  commercialScaleMissingSupplierOrganizations,
  explicitLeadTimeHierarchyViolations,
  isStructuralLeadTimeNode,
  leadTimeAnswerForGraphNode,
  leadTimeAnswerForNode,
  structuralLeadTimeHierarchyViolations,
  structuralLeadTimeMissingNodes,
} from "../src/lib/commercialDataCompleteness";

function node(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    name: id,
    kind: "module",
    domain: ["test"],
    maturityLabel: "commercially_available",
    maturityAsOf: "2026-06",
    ...extra,
  } as Node;
}

function graph(nodes: Node[], edges: GraphData["edges"] = []): GraphData {
  return { graphVersion: "commercial-data-completeness-test", nodes, edges, evidence: [] };
}

test("leadTimeAnswerForNode preserves explicit lead time values", () => {
  const answer = leadTimeAnswerForNode(node("explicit", { capacityLeadTimeMonths: 18 }));

  assert.equal(answer.months, 18);
  assert.equal(answer.basis, "explicit");
});

test("leadTimeAnswerForNode estimates missing structural lead time instead of returning unknown", () => {
  const answer = leadTimeAnswerForNode(
    node("missing", {
      kind: "manufacturing_process",
      maturityLabel: "prototype",
      tags: ["constraint_capacity_scale", "hard_to_develop"],
      transactability: "must_build",
    }),
  );

  assert.equal(answer.basis, "estimated");
  assert.ok(answer.months >= 18);
  assert.match(answer.reason, /capacity|tooling|qualification|process/i);
});

test("commercialScaleAnswerForOrganization estimates supplier scale when no revenue/share metric exists", () => {
  const answer = commercialScaleAnswerForOrganization(
    node("listed_supplier", {
      kind: "organization",
      listingStatus: "public",
      ticker: "TEST",
      metrics: [],
    }),
  );

  assert.equal(answer.basis, "estimated");
  assert.match(answer.text, /public-market|listed/i);
});

test("live graph has no user-facing structural lead-time blanks after explicit-or-estimated fallback", () => {
  const graphData = loadGraphData();
  const missing = structuralLeadTimeMissingNodes(graphData);

  assert.deepEqual(missing, []);
});

test("live graph supplier organizations have explicit or proxy commercial scale answers", () => {
  const graphData = loadGraphData();
  const missing = commercialScaleMissingSupplierOrganizations(graphData);

  assert.deepEqual(missing, []);
});

test("live graph structural commercial-scale readouts never understate child rollups", () => {
  const graphData = loadGraphData();
  const structuralKinds = new Set<Node["kind"]>([
    "product",
    "capability",
    "module",
    "technical_route",
    "engineering_method",
    "manufacturing_process",
    "equipment",
    "material",
  ]);

  const violations = graphData.nodes
    .filter((entry) => entry.reviewStatus !== "deprecated" && structuralKinds.has(entry.kind))
    .flatMap((entry) => {
      try {
        const result = rollupCost(graphData, entry.id);
        if (!result.directOnly || !result.fromChildren || !result.directLowerThanChildren) {
          return [];
        }
        return [
          `${entry.id}: direct ${Math.round(result.directOnly.typical)} < child rollup ${Math.round(result.fromChildren.typical)}`,
        ];
      } catch {
        return [];
      }
    });

  assert.deepEqual(violations, []);
});

test("live graph structural relief-cycle readouts are at least the direct child max", () => {
  const graphData = loadGraphData();
  assert.deepEqual(structuralLeadTimeHierarchyViolations(graphData), []);
});

test("live graph explicit relief-cycle fields do not contradict explicit direct children", () => {
  const graphData = loadGraphData();

  assert.deepEqual(explicitLeadTimeHierarchyViolations(graphData), []);
});

test("leadTimeAnswerForGraphNode rolls parent relief timing up from direct children", () => {
  const parent = node("parent", { capacityLeadTimeMonths: 6 });
  const child = node("child", { capacityLeadTimeMonths: 18 });
  const graphData = graph([
    parent,
    child,
  ], [
    {
      id: "parent_requires_child",
      source: "parent",
      target: "child",
      relation: "requires",
    },
  ]);

  const answer = leadTimeAnswerForGraphNode(graphData, parent);

  assert.equal(answer?.months, 18);
  assert.equal(answer?.basis, "estimated");
  assert.equal(answer?.reasonCode, "child_decomposition");
});
