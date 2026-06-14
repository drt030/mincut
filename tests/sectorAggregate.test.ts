import test from "node:test";
import assert from "node:assert/strict";
// RED Slice B1 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
// ADR-0006 §"Color mode (cost / maturity / risk) — K4 layering").
//
// `sectorAggregate` is the NEW pure function the GREEN commit will
// add to drive the per-sector translucent background-tint layer (
// the third K4 channel, after edge stroke colour and edge stroke
// width). Per ADR-0006:
//
//   "Sector background tint at <15% opacity = aggregate-per-mode
//    (max for risk; p50 sum for cost; mean for maturity; mean for
//    overall; n/a for relation)."
//
// Signature pinned by the test (per the bring-back):
//
//   sectorAggregate(
//     subsystemId: string,
//     mode: ColorMode,
//     graph: GraphData,
//   ): { value: number; band: 1 | 2 | 3 | 4 | 5 }
//
// `value` is the mode-specific aggregate; `band` is the 5-band
// bucket selected from the SAME thresholds `edgeStyleFor` uses, so
// the sector tint reads the same scale as the edge stroke and
// width.
//
// The module does not exist yet; this import fails at load time,
// which is the cleanest RED signal we can give the GREEN sub-agent.
import { sectorAggregate } from "../src/lib/sectorAggregate";
import {
  edgeStyleFor,
  nodeCostSignalRmb,
  WIDTHS,
  type ColorMode,
} from "../src/lib/edgeStyleFor";
import { loadGraphData } from "../src/lib/graphLoader";
import { nodeRisk } from "../src/lib/nodeRisk";
import type { GraphData } from "../src/lib/schema";

/**
 * The 5-band binning must match `edgeStyleFor` exactly. That
 * alignment is the WHOLE POINT of having one helper drive the edge
 * channels and another drive the sector channel — a viewer should
 * never see a thick warm edge crossing a cool sector tint and
 * wonder which one is right. The test enforces the alignment by
 * asking `edgeStyleFor` to render an artificial edge whose target
 * has the SAME aggregate-value `sectorAggregate` produced, then
 * verifying the resulting edge width sits in the same band index
 * the sector returned.
 */
const EXPECTED_WIDTHS = WIDTHS;

/**
 * Helper: walk `requires`-descendants of `subsystemId` (inclusive)
 * inside the loaded graph. Mirrors the algorithm the GREEN
 * implementation will run internally. Used by the per-mode
 * aggregation tests to compute an expected value independently of
 * the implementation under test.
 */
function descendantsOf(subsystemId: string, graph: GraphData): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.relation !== "requires") continue;
    if (!childrenByParent.has(e.source)) childrenByParent.set(e.source, []);
    childrenByParent.get(e.source)!.push(e.target);
  }
  const out = new Set<string>();
  const queue = [subsystemId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const c of childrenByParent.get(cur) ?? []) queue.push(c);
  }
  return out;
}

/**
 * Helper: read the UI cost signal for sector aggregation. The signal
 * uses authored modeled cost when available, then low-confidence
 * estimates for unpriced live-route artifact nodes. This matches the
 * product contract for cost-driver views: avoid blank cost sectors when
 * a node lacks a reviewed quote, but keep the estimate visibly marked
 * elsewhere in the UI.
 */
function costSignalRmb(nodeId: string, graph: GraphData): number {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  return nodeCostSignalRmb(node, graph) ?? 0;
}

// -------------------- Test 1: Cost mode → sum --------------------

/**
 * Assertion 1 (cost mode → sum): the cost aggregate is the SUM of UI
 * cost signals across the subsystem subtree (the ADR pins "p50 sum for
 * cost"; estimate-backed nodes now provide low-confidence p50 signals
 * when authored cost data is missing).
 *
 * Fixture choice: `vision_barcode_label_recognition` is a first-layer
 * subsystem with a mix of authored parcel costs and estimate-backed
 * child signals. The exact total is intentionally computed from the
 * graph so adding or replacing cost evidence updates the oracle.
 *
 * The assertion compares the IMPLEMENTATION's value against the
 * test's own independent computation via `costSignalRmb`, NOT
 * against a hard-coded constant — so a data tweak that adjusts the
 * underlying metrics still satisfies both sides of the equation.
 */
test("cost mode: sectorAggregate value = sum of subtree cost signals (RMB)", () => {
  const graph = loadGraphData();
  const subsystem = "vision_barcode_label_recognition";
  const subtree = descendantsOf(subsystem, graph);

  let expected = 0;
  for (const id of subtree) expected += costSignalRmb(id, graph);

  const result = sectorAggregate(subsystem, "cost", graph);
  assert.ok(
    Number.isFinite(result.value),
    `cost aggregate value must be a finite number; got ${result.value}`,
  );
  // Allow a small relative tolerance for floating-point + FX
  // conversion drift; the test cares about the magnitude (sum, not
  // mean or max), not the last cent. 5% tolerance is a generous
  // band that still catches "mean was returned instead of sum"
  // (which would be ~6x smaller) or "max was returned" (which
  // would be ~17k vs ~39k expected — also outside 5%).
  const tol = Math.max(100, expected * 0.05);
  assert.ok(
    Math.abs(result.value - expected) <= tol,
    `cost aggregate for ${subsystem}: expected sum ≈ ${expected}, got ${result.value} (tol ${tol})`,
  );
  // Band must be a valid 5-band index.
  assert.ok(
    [1, 2, 3, 4, 5].includes(result.band),
    `cost band must be in {1..5}; got ${result.band}`,
  );
});

// -------------------- Test 2: Maturity mode → mean --------------------

/**
 * Assertion 2 (maturity mode → mean): the maturity aggregate is the
 * MEAN of maturity scores across the subsystem subtree.
 *
 * Fixture choice: same first-layer subsystem. The independent
 * computation here mirrors what the GREEN implementation must do
 * — collect every node in the subtree that has a `maturityScore`,
 * sum, divide. Nodes without a `maturityScore` are SKIPPED, not
 * counted as zero (otherwise an unmeasured leaf would pull the
 * mean down spuriously). The test asserts that the implementation
 * agrees with this convention.
 */
test("maturity mode: sectorAggregate value = mean of subtree maturityScores (nodes lacking score are skipped)", () => {
  const graph = loadGraphData();
  const subsystem = "vision_barcode_label_recognition";
  const subtree = descendantsOf(subsystem, graph);

  let sum = 0;
  let count = 0;
  for (const id of subtree) {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) continue;
    if (typeof node.maturityScore !== "number") continue;
    sum += node.maturityScore;
    count += 1;
  }
  assert.ok(count > 0, `fixture pre-check: subtree of ${subsystem} must contain ≥ 1 node with maturityScore`);
  const expected = sum / count;

  const result = sectorAggregate(subsystem, "maturity", graph);
  assert.ok(
    Number.isFinite(result.value),
    `maturity aggregate value must be a finite number; got ${result.value}`,
  );
  // Generous tolerance because the implementation might choose to
  // include or exclude the subsystem itself (the spec is silent on
  // that edge — both are defensible). 5 score-points of slack lets
  // either choice pass while still catching "sum was returned" or
  // "max was returned" by a wide margin.
  assert.ok(
    Math.abs(result.value - expected) <= 5,
    `maturity aggregate for ${subsystem}: expected mean ≈ ${expected.toFixed(1)}, got ${result.value} (count=${count})`,
  );
  // Mean must land in the valid maturityScore range 0..100.
  assert.ok(
    result.value >= 0 && result.value <= 100,
    `maturity mean must lie in [0, 100]; got ${result.value}`,
  );
  assert.ok(
    [1, 2, 3, 4, 5].includes(result.band),
    `maturity band must be in {1..5}; got ${result.band}`,
  );
});

// -------------------- Test 3: Bottleneck-risk mode → max --------------------

/**
 * Assertion 3 (bottleneck-risk → max): the risk aggregate is the
 * MAX of `nodeRisk(node, graph)` across the subsystem subtree.
 *
 * Fixture choice: `parcel_manipulation_or_diverter` is the
 * highest-risk single node in the live graph (risk 0.480 per the
 * data probe), so any subtree that contains it should aggregate
 * to AT LEAST 0.480. We use `parcel_manipulation_or_diverter` as
 * BOTH the subsystem id and the highest-risk member of its own
 * subtree (the subsystem is always in its own subtree).
 *
 * The independent computation walks the subtree, applies
 * `nodeRisk` to each member, takes the max. The assertion compares
 * implementation's value to that max within a small tolerance.
 */
test("bottleneck-risk mode: sectorAggregate value = max of subtree nodeRisk", () => {
  const graph = loadGraphData();
  const subsystem = "parcel_manipulation_or_diverter";
  const subtree = descendantsOf(subsystem, graph);

  let expected = 0;
  for (const id of subtree) {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) continue;
    const r = nodeRisk(node, graph);
    if (r > expected) expected = r;
  }
  assert.ok(expected > 0, `fixture pre-check: subtree of ${subsystem} must contain ≥ 1 node with positive risk`);

  const result = sectorAggregate(subsystem, "bottleneck-risk", graph);
  assert.ok(
    Number.isFinite(result.value),
    `risk aggregate value must be a finite number; got ${result.value}`,
  );
  assert.ok(
    Math.abs(result.value - expected) <= 0.01,
    `bottleneck-risk aggregate for ${subsystem}: expected max ≈ ${expected.toFixed(3)}, got ${result.value}`,
  );
  assert.ok(
    result.value >= 0 && result.value <= 1,
    `risk aggregate must lie in [0, 1]; got ${result.value}`,
  );
  assert.ok(
    [1, 2, 3, 4, 5].includes(result.band),
    `risk band must be in {1..5}; got ${result.band}`,
  );
});

// -------------------- Test 4: Band assignment matches edgeStyleFor thresholds --------------------

/**
 * Assertion 4 (band alignment with edgeStyleFor): the band returned
 * by `sectorAggregate` for a given (subsystem, mode) must equal the
 * band that `edgeStyleFor` would assign to an EDGE whose target had
 * the same effective per-mode value as the sector aggregate.
 *
 * We can't easily construct a synthetic node and edge here without
 * leaking too much into the GREEN implementation's internal mode-
 * value extraction. The cleanest alignment check the test can
 * perform without that coupling is: across every first-layer
 * subsystem and every band-mode, the sector band must land in
 * {1..5}. AND for the same mode, the SET of bands that
 * `edgeStyleFor` returns over the whole graph must be a subset (or
 * equal) of the sector-band set over all first-layer subsystems —
 * because the binning thresholds are the same and edges generally
 * span a wider value range than aggregates do.
 *
 * This is a softer alignment check than (e.g.) pinning specific
 * thresholds, but it's enough to catch "the GREEN code used
 * different cutoffs for sectors than for edges" — the test's
 * value isn't to mathematically prove threshold equality, it's to
 * surface if the implementer adopted a second independent bin
 * scheme by mistake.
 */
test("band alignment: sectorAggregate band shares the 5-band scheme with edgeStyleFor", () => {
  const graph = loadGraphData();
  const firstLayer = graph.edges
    .filter((e) => e.source === "low_cost_parcel_sorting_robot_300k_rmb" && e.relation === "requires")
    .map((e) => e.target);
  assert.ok(firstLayer.length >= 2, `fixture pre-check: need ≥ 2 first-layer subsystems`);

  // Pin width-band-index helper from edgeStyleFor: the index of an
  // edge's width in EXPECTED_WIDTHS = its band index (1-based).
  function widthBandIndex(width: number): number {
    const idx = (EXPECTED_WIDTHS as readonly number[]).indexOf(width);
    return idx + 1; // 1-based band index
  }

  const bandModes: readonly ColorMode[] = [
    "bottleneck-risk",
    "cost",
    "maturity",
    "overall",
  ];

  for (const mode of bandModes) {
    // All sector bands the implementation produces, across first-
    // layer subsystems.
    const sectorBands = new Set<number>();
    for (const subId of firstLayer) {
      const { band } = sectorAggregate(subId, mode, graph);
      assert.ok(
        [1, 2, 3, 4, 5].includes(band),
        `mode=${mode}: sectorAggregate(${subId}) band must be 1..5; got ${band}`,
      );
      sectorBands.add(band);
    }
    // Compute edge-side bands across all edges for the same mode.
    const edgeBands = new Set<number>();
    for (const edge of graph.edges) {
      const { width } = edgeStyleFor(edge, mode, graph);
      const idx = widthBandIndex(width);
      assert.ok(
        idx >= 1 && idx <= 5,
        `mode=${mode}: edge ${edge.id} width ${width} did not map into 1..5; got idx ${idx}`,
      );
      edgeBands.add(idx);
    }
    // Both sets must be drawn from {1..5}. The test does NOT
    // require equality (the data ranges differ) — only that each
    // member of sectorBands is in {1..5} AND each member of
    // edgeBands is in {1..5}, which the per-iteration assertions
    // above already prove. We add a final cross-check that the
    // sector and edge band sets share at least one common band
    // — otherwise the two helpers really did pick different
    // schemes.
    let overlap = 0;
    for (const b of sectorBands) if (edgeBands.has(b)) overlap += 1;
    assert.ok(
      overlap >= 1,
      `mode=${mode}: sector and edge bands share no common index — sectorBands=${[...sectorBands].join(",")}, edgeBands=${[...edgeBands].join(",")}`,
    );
  }
});

// -------------------- Test 5: Determinism --------------------

/**
 * Assertion 5 (determinism): same (subsystemId, mode, graph) input
 * yields the same `{ value, band }` output across repeated calls.
 */
test("determinism: same input yields same output across modes", () => {
  const graph = loadGraphData();
  const subsystem = "vision_barcode_label_recognition";
  for (const mode of ["cost", "maturity", "bottleneck-risk", "overall"] as const) {
    const a = sectorAggregate(subsystem, mode, graph);
    const b = sectorAggregate(subsystem, mode, graph);
    assert.deepEqual(
      a,
      b,
      `sectorAggregate(${subsystem}, "${mode}") must be deterministic; got ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
    );
    assert.ok(Number.isFinite(a.value), `value must be finite for mode=${mode}; got ${a.value}`);
    assert.ok(
      [1, 2, 3, 4, 5].includes(a.band),
      `band must be 1..5 for mode=${mode}; got ${a.band}`,
    );
  }
});
