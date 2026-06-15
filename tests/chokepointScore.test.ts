import test from "node:test";
import assert from "node:assert/strict";

import type { Edge, GraphData, Node } from "../src/lib/schema";
import {
  barrierValue,
  chokepointBandFor,
  chokepointRankSignal,
  chokepointScores,
  concentrationValue,
  criticalityRaw,
  criticalityValue,
  dependentAncestors,
  directDependents,
  quantileAt,
  quantileNormalizer,
} from "../src/lib/chokepointScore";

function node(id: string, extra: Partial<Node> = {}): Node {
  return { id, name: id, kind: "module", domain: ["test"], ...extra } as Node;
}
function edge(source: string, target: string, relation: Edge["relation"]): Edge {
  return { id: `${source}_${relation}_${target}`, source, target, relation } as Edge;
}
export function graph(nodes: Node[], edges: Edge[]): GraphData {
  return { nodes, edges, evidence: [] } as unknown as GraphData;
}

test("directDependents counts distinct decomposition parents pointing at a node", () => {
  // a and b both require shared; c requires a. shared has two direct parents.
  const g = graph(
    [node("a"), node("b"), node("c"), node("shared")],
    [
      edge("a", "shared", "requires"),
      edge("b", "shared", "requires"),
      edge("c", "a", "requires"),
      edge("a", "shared", "measured_by"), // non-decomposition edge: ignored
    ],
  );
  assert.deepEqual(directDependents(g, "shared").sort(), ["a", "b"]);
  assert.equal(criticalityRaw(g, "shared"), 2);
  assert.equal(criticalityRaw(g, "a"), 1);
});

test("dependentAncestors walks transitively up the decomposition DAG", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("mid"), node("leaf")],
    [edge("root", "mid", "requires"), edge("mid", "leaf", "requires")],
  );
  assert.deepEqual([...dependentAncestors(g, "leaf")].sort(), ["mid", "root"]);
});

test("criticalityValue defaults demand weight to 1 when no demandScale, known when shared", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("a"), node("shared")],
    [edge("root", "a", "requires"), edge("a", "shared", "requires"), edge("root", "shared", "requires")],
  );
  // shared has 2 parents (root, a), no demandScale -> value 2, weight unknown
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 2);
  assert.equal(r.known, true);
  assert.equal(r.demandKnown, false);
});

test("criticalityValue multiplies fan-in by ancestor product demandScale", () => {
  const g = graph(
    [node("root", { kind: "product", demandScale: 10 }), node("shared")],
    [edge("root", "shared", "requires")],
  );
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 10); // fan-in 1 × demandScale 10
  assert.equal(r.demandKnown, true);
});

test("quantileNormalizer maps min->0, max->1 by empirical rank", () => {
  const norm = quantileNormalizer([1, 2, 3, 4, 5]);
  assert.equal(norm(1), 0);
  assert.equal(norm(5), 1);
  assert.equal(norm(3), 0.5);
});

test("quantileNormalizer is robust to one or zero values", () => {
  assert.equal(quantileNormalizer([])(7), 0);
  assert.equal(quantileNormalizer([42])(42), 0.5);
});

test("concentrationValue is 1.0 at zero holders and decreases as holders grow", () => {
  const g = graph(
    [
      node("part", { kind: "material" }),
      node("o1", { kind: "organization" }),
      node("o2", { kind: "organization" }),
    ],
    [edge("part", "o1", "manufactured_by"), edge("part", "o2", "manufactured_by")],
  );
  const lonely = graph([node("scarce", { kind: "material" })], []);
  assert.equal(concentrationValue(lonely, "scarce").value, 1); // 0 holders
  assert.equal(concentrationValue(g, "part").value, 1 / 3); // 2 holders -> 1/(1+2)
});

test("concentrationValue is unknown for non-supply-chain kinds", () => {
  const g = graph([node("cap", { kind: "capability" })], []);
  assert.equal(concentrationValue(g, "cap").known, false);
});

test("barrierValue is high for a must_build, hard, unproven node", () => {
  const g = graph(
    [
      node("hard", {
        kind: "engineering_method",
        transactability: "must_build",
        tags: ["hard_to_develop"],
        maturityScore: 20,
      }),
    ],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.equal(r.known, true);
  assert.ok(r.value > 0.8, `expected high barrier, got ${r.value}`);
});

test("barrierValue is low for a procurable, mature node", () => {
  const g = graph(
    [node("easy", { kind: "engineering_method", transactability: "procurable", maturityScore: 90 })],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.ok(r.value < 0.2, `expected low barrier, got ${r.value}`);
});

test("barrierValue is unknown when no barrier signal is present", () => {
  const g = graph([node("bare", { kind: "module" })], []);
  assert.equal(barrierValue(g.nodes[0]).known, false);
});

test("a high-criticality, concentrated, high-barrier node outranks a false bottleneck", () => {
  // `real`: shared (2 parents), 0 holders (concentrated), must_build+hard (high barrier).
  // `fake`: shared (2 parents), 0 holders, but procurable+mature (low barrier) -> 伪瓶颈.
  const g = graph(
    [
      node("p1", { kind: "product" }),
      node("p2", { kind: "product" }),
      node("real", { kind: "engineering_method", transactability: "must_build", tags: ["hard_to_develop"], maturityScore: 20 }),
      node("fake", { kind: "engineering_method", transactability: "procurable", maturityScore: 95 }),
    ],
    [
      edge("p1", "real", "requires"), edge("p2", "real", "requires"),
      edge("p1", "fake", "requires"), edge("p2", "fake", "requires"),
    ],
  );
  const scores = chokepointScores(g);
  assert.ok(scores.get("real")!.score > scores.get("fake")!.score, "real chokepoint must outrank false one");
  assert.equal(scores.get("real")!.incomplete, false);
});

test("a node missing an axis is scored over known axes and flagged incomplete", () => {
  const g = graph(
    [node("p", { kind: "product" }), node("cap", { kind: "capability" })],
    [edge("p", "cap", "requires")],
  );
  // capability: criticality known (1 parent), concentration unknown (not supply kind),
  // barrier unknown (no signal) -> incomplete, but still scored, never zeroed silently.
  const r = chokepointScores(g).get("cap")!;
  assert.equal(r.incomplete, true);
  assert.ok(Number.isFinite(r.score));
});

test("chokepointScores is memoized per graph identity (same Map instance)", () => {
  // Perf contract (C1): the O(N×(N+E)) pass must run at most once per graph,
  // so repeated calls with the SAME graph object return the SAME cached Map,
  // while a DIFFERENT graph object gets its own freshly-computed Map.
  const g1 = graph([node("p", { kind: "product" }), node("m", { kind: "material" })], [
    edge("p", "m", "requires"),
  ]);
  const g2 = graph([node("p", { kind: "product" }), node("m", { kind: "material" })], [
    edge("p", "m", "requires"),
  ]);
  assert.strictEqual(chokepointScores(g1), chokepointScores(g1));
  assert.notStrictEqual(chokepointScores(g1), chokepointScores(g2));
});

test("quantileAt linear-interpolates the requested quantile of a sorted ascending array", () => {
  // [10,20,30,40,50]: Q0 -> 10, Q100 -> 50, Q50 -> 30 (exact index 2),
  // Q25 -> idx 1.0 -> 20, Q60 -> idx 2.4 -> 30 + 0.4*(40-30) = 34.
  const xs = [10, 20, 30, 40, 50];
  assert.equal(quantileAt(xs, 0), 10);
  assert.equal(quantileAt(xs, 1), 50);
  assert.equal(quantileAt(xs, 0.5), 30);
  assert.equal(quantileAt(xs, 0.25), 20);
  assert.equal(quantileAt(xs, 0.6), 34);
  // Robust to the empty distribution (no quantile to read).
  assert.equal(quantileAt([], 0.4), 0);
  // Single value: every quantile is that value.
  assert.equal(quantileAt([7], 0.8), 7);
});

test("chokepointBandFor bands the composite by its own quantiles into a full 1..5 spread", () => {
  // ADR-0010: chokepointBandFor bins the composite by its OWN empirical
  // quantiles (Q20/Q40/Q60/Q80), so every band fills as long as the score
  // distribution is spread WIDELY ENOUGH that its distinct values straddle
  // all four quantile cutoffs. Full tie-freeness is NOT required (and this
  // fixture is not tie-free — see below); only that the distinct values land
  // on both sides of each cutoff.
  //
  // NOTE on fixture shape: a root `product` always scores ~0 (Criticality is
  // structurally unknown — nothing depends on it — and its lone known axis
  // ties with every other root product), so a `product`+`part` fixture parks
  // a tie-cluster of products at the bottom; with the `>=`-quantile
  // convention that collapses Q20 onto the minimum and starves band 1. (The
  // real 929-node graph shows this too: its floor is band 2, never band 1.)
  // To exercise the full 1..5 range we therefore use a spread distribution
  // of supply-kind nodes whose Criticality fan-in (i parents) and Barrier
  // (decreasing maturity) vary in opposite directions, so the geometric-mean
  // composite rises then falls across i — no bottom tie-cluster. NOTE the
  // resulting scores are NOT tie-free: because fan-in rises while maturity
  // falls symmetrically, the score sequence is palindromic (m_i and
  // m_{N-1-i} score equally), so the 11 nodes collapse to only ~6-7 distinct
  // values in tied pairs. Band coverage [1..5] still holds because those
  // distinct values straddle every quantile cutoff — the point this test
  // pins is the FULL-SPREAD coverage, not tie-freeness.
  const N = 11;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < N; i++) {
    nodes.push(node(`m${i}`, { kind: "material", maturityScore: i * 9 }));
  }
  for (let i = 0; i < N; i++) {
    // m_i is required by m_0..m_{i-1} -> distinct Criticality fan-in = i.
    for (let p = 0; p < i; p += 1) edges.push(edge(`m${p}`, `m${i}`, "requires"));
  }
  const g = graph(nodes, edges);
  const band = chokepointBandFor(g);
  const bands = nodes.map((n) => band(n.id));
  const distinct = [...new Set(bands)].sort((a, b) => a - b);
  assert.deepEqual(distinct, [1, 2, 3, 4, 5], `expected every band 1..5 to be populated, got ${bands}`);

  // Boundary contract: the single highest-scoring node bands 5, the single
  // lowest bands 1 — i.e. the warmest band always holds the top chokepoint.
  const scores = chokepointScores(g);
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  assert.equal(band(ranked[0][0]), 5, "top composite score must land in band 5");
  assert.equal(band(ranked[ranked.length - 1][0]), 1, "bottom composite score must land in band 1");
});

test("chokepointBandFor is cached per graph identity (same function instance)", () => {
  const g = graph([node("p", { kind: "product" }), node("m", { kind: "material" })], [
    edge("p", "m", "requires"),
  ]);
  assert.equal(chokepointBandFor(g), chokepointBandFor(g));
});

test("chokepointRankSignal returns the composite score for nodes without an authored bottleneck", () => {
  // ADR-0010: the ranking signal for selectTopN. With no `bottleneckOf`,
  // it is exactly the node's composite chokepoint score (in [0,1]), so the
  // top-N ordering matches the edge/band ordering for computed chokepoints.
  const g = graph(
    [
      node("p1", { kind: "product" }),
      node("p2", { kind: "product" }),
      node("real", { kind: "engineering_method", transactability: "must_build", tags: ["hard_to_develop"], maturityScore: 20 }),
      node("fake", { kind: "engineering_method", transactability: "procurable", maturityScore: 95 }),
    ],
    [
      edge("p1", "real", "requires"), edge("p2", "real", "requires"),
      edge("p1", "fake", "requires"), edge("p2", "fake", "requires"),
    ],
  );
  const scores = chokepointScores(g);
  const realNode = g.nodes.find((n) => n.id === "real")!;
  const fakeNode = g.nodes.find((n) => n.id === "fake")!;
  assert.equal(chokepointRankSignal(g, realNode), scores.get("real")!.score);
  assert.equal(chokepointRankSignal(g, fakeNode), scores.get("fake")!.score);
  // A real chokepoint still outranks a 伪瓶颈 under the ranking signal.
  assert.ok(chokepointRankSignal(g, realNode) > chokepointRankSignal(g, fakeNode));
});

test("chokepointRankSignal boosts authored bottlenecks above every computed composite", () => {
  // Mirrors nodeRiskSignal's explicit-bottleneck boost: a non-empty
  // `bottleneckOf` sorts first regardless of computed score, while the
  // boosted value stays within (1, 1.09] so the ordering among multiple
  // authored bottlenecks reflects their maturity pressure (less mature =
  // higher), and every computed score in [0,1] sorts strictly below.
  const g = graph(
    [
      node("p", { kind: "product" }),
      node("authored_low_mat", { kind: "module", bottleneckOf: ["p"], maturityScore: 10 }),
      node("authored_high_mat", { kind: "module", bottleneckOf: ["p"], maturityScore: 90 }),
      node("authored_no_mat", { kind: "module", bottleneckOf: ["p"] }),
      node("computed_max", { kind: "material", maturityScore: 0 }),
    ],
    [
      edge("p", "authored_low_mat", "requires"),
      edge("p", "authored_high_mat", "requires"),
      edge("p", "authored_no_mat", "requires"),
      edge("p", "computed_max", "requires"),
    ],
  );
  const authoredLow = g.nodes.find((n) => n.id === "authored_low_mat")!;
  const authoredHigh = g.nodes.find((n) => n.id === "authored_high_mat")!;
  const authoredNoMat = g.nodes.find((n) => n.id === "authored_no_mat")!;
  const computedMax = g.nodes.find((n) => n.id === "computed_max")!;

  // Every authored bottleneck is boosted strictly above 1 (the [0,1] ceiling
  // of any computed composite), so authored claims always sort first.
  for (const authored of [authoredLow, authoredHigh, authoredNoMat]) {
    assert.ok(
      chokepointRankSignal(g, authored) > 1,
      `${authored.id} should be boosted above 1; got ${chokepointRankSignal(g, authored)}`,
    );
  }
  // The computed node's signal equals its composite score and is <= 1.
  assert.ok(chokepointRankSignal(g, computedMax) <= 1);
  assert.ok(chokepointRankSignal(g, authoredLow) > chokepointRankSignal(g, computedMax));
  // Less-mature authored bottleneck carries more maturity pressure, so it
  // sorts above a more-mature authored bottleneck (within the same target
  // tier — all three above target the product `p`).
  assert.ok(
    chokepointRankSignal(g, authoredLow) > chokepointRankSignal(g, authoredHigh),
    "less mature authored bottleneck should rank above a more mature one",
  );
  // Boost stays bounded (never reaches 2) so it reads as "authored tier",
  // not an unbounded score.
  assert.ok(chokepointRankSignal(g, authoredLow) < 2);
});

test("chokepointRankSignal ranks product-targeting authored bottlenecks above non-product-targeting ones", () => {
  // Load-bearing tier (mirrors nodeRiskSignal): a `bottleneckOf` that targets
  // a PRODUCT outranks one that targets a non-product (route/module/leaf),
  // EVEN when the product-targeting node is MORE mature (lower maturity
  // pressure). commercialPromotionGate's audit-preview gate depends on this —
  // the top-N must surface the curated, decision-grade PRODUCT chokepoints,
  // not under-sourced route/leaf claims that merely happen to be less mature.
  const g = graph(
    [
      node("prod", { kind: "product" }),
      node("route", { kind: "technical_route" }),
      // Targets the product, but MORE mature (less maturity pressure).
      node("targets_product", { kind: "module", bottleneckOf: ["prod"], maturityScore: 30 }),
      // Targets a non-product route, and LESS mature (more maturity pressure).
      node("targets_route", { kind: "module", bottleneckOf: ["route"], maturityScore: 5 }),
    ],
    [
      edge("prod", "route", "requires"),
      edge("prod", "targets_product", "requires"),
      edge("route", "targets_route", "requires"),
    ],
  );
  const targetsProduct = g.nodes.find((n) => n.id === "targets_product")!;
  const targetsRoute = g.nodes.find((n) => n.id === "targets_route")!;
  assert.ok(
    chokepointRankSignal(g, targetsProduct) > chokepointRankSignal(g, targetsRoute),
    "a product-targeting authored bottleneck must outrank a non-product one even when more mature",
  );
});
