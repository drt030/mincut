import test from "node:test";
import assert from "node:assert/strict";
import {
  KNOW_HOW_FILLS,
  ARTIFACT_DIM_FILL,
  knowHowFill,
  layerHidesNode,
  layerHidesEdge,
  knowHowBottleneckCounts,
  listingInfoForOrg,
} from "../src/lib/knowHowLayer";

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["t"], maturityLabel: "mature", ...overrides }) as never;

const edge = (id: string, source: string, target: string, relation: string) =>
  ({ id, source, target, relation }) as never;

const graph = {
  nodes: [
    node("root", "product"),
    node("mod", "module"),
    node("kh_b", "engineering_method", { transactability: "must_build", bottleneckOf: ["root"] }),
    node("kh_p", "manufacturing_process", { transactability: "procurable" }),
    node("kh_u", "engineering_method"),
  ],
  edges: [
    edge("e1", "root", "mod", "requires"),
    edge("e2", "mod", "kh_b", "requires"),
    edge("e3", "mod", "kh_p", "implemented_by"),
    edge("e4", "mod", "kh_u", "requires"),
  ],
  evidence: [],
} as never;

test("product layer hides know-how nodes and their edges; know-how layer hides nothing", () => {
  const kh = (graph as { nodes: never[] }).nodes[2];
  const mod = (graph as { nodes: never[] }).nodes[1];
  assert.equal(layerHidesNode(kh, "product"), true);
  assert.equal(layerHidesNode(mod, "product"), false);
  assert.equal(layerHidesNode(kh, "knowhow"), false);

  const nodeById = new Map((graph as { nodes: { id: string }[] }).nodes.map((n) => [n.id, n]));
  const khEdge = (graph as { edges: never[] }).edges[1];
  const artifactEdge = (graph as { edges: never[] }).edges[0];
  assert.equal(layerHidesEdge(khEdge, "product", nodeById as never), true);
  assert.equal(layerHidesEdge(artifactEdge, "product", nodeById as never), false);
  assert.equal(layerHidesEdge(khEdge, "knowhow", nodeById as never), false);
});

test("knowHowFill maps transactability to the three fills", () => {
  const [, , khB, khP, khU] = (graph as { nodes: never[] }).nodes;
  assert.equal(knowHowFill(khB), KNOW_HOW_FILLS.must_build);
  assert.equal(knowHowFill(khP), KNOW_HOW_FILLS.procurable);
  assert.equal(knowHowFill(khU), KNOW_HOW_FILLS.unset);
  assert.notEqual(KNOW_HOW_FILLS.must_build, KNOW_HOW_FILLS.procurable);
  assert.equal(typeof ARTIFACT_DIM_FILL, "string");
});

test("knowHowBottleneckCounts counts hidden bottleneck know-how per host", () => {
  const counts = knowHowBottleneckCounts(graph);
  assert.equal(counts.get("mod"), 1); // kh_b carries bottleneckOf, kh_p / kh_u do not
  assert.equal(counts.has("root"), false);
});

test("listingInfoForOrg prefers schema fields, falls back to Public listing metric + tag", () => {
  const fieldOrg = node("o1", "organization", { listingStatus: "public", ticker: "NVDA" });
  assert.deepEqual(listingInfoForOrg(fieldOrg), { status: "public", ticker: "NVDA" });

  const metricOrg = node("o2", "organization", {
    tags: ["public_company"],
    metrics: [{ name: "Public listing", currentValue: "6361.T" }],
  });
  assert.deepEqual(listingInfoForOrg(metricOrg), { status: "public", ticker: "6361.T" });

  const bareOrg = node("o3", "organization");
  assert.deepEqual(listingInfoForOrg(bareOrg), { status: "unknown", ticker: undefined });
});
