import test from "node:test";
import assert from "node:assert/strict";
// RED Slice B1 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
// ADR-0006 §"Color mode (cost / maturity / risk) — K4 layering").
//
// `edgeStyleFor` SUPERSEDES the slice-2 `edgeTintFor` helper. The
// 2026-05-10 spec encoded only the stroke colour for each mode; the
// radial redesign requires a redundantly-encoded edge style where the
// stroke colour and the stroke width are both selected from the SAME
// 5-band bucket — so a thick edge is ALWAYS also the corresponding
// colour. The new function returns `{ stroke, width }` to make the
// bin-alignment invariant testable from a single call site.
//
// The module does not exist yet; this import fails at load time, which
// is the cleanest RED signal we can give the GREEN sub-agent. The
// `ColorMode` type lives alongside `edgeStyleFor.ts` per the slice's
// "ColorMode type can live alongside `edgeStyleFor.ts`" constraint.
import {
  edgeStyleFor,
  nodeCostSignalRmb,
  WIDTHS,
  type ColorMode,
} from "../src/lib/edgeStyleFor";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { loadGraphData } from "../src/lib/graphLoader";
import type { Edge, GraphData, Node } from "../src/lib/schema";

/**
 * 5-band binning (ADR-0006 §Color mode K4):
 *
 *   Band 1 (coolest, lowest mode-value) → width 0.8 px
 *   Band 2                               → width 1.6 px
 *   Band 3                               → width 2.8 px
 *   Band 4                               → width 4.6 px
 *   Band 5 (warmest, highest mode-value) → width 7.2 px
 *
 * The stroke colour is one of 5 stops on a cool→warm ramp aligned to
 * the SAME band indices, so band index N is both:
 *   - the index in the width array (above), and
 *   - the index in the 5-stop colour ramp.
 *
 * This invariant — width-band-index === colour-band-index — is the
 * core contract the GREEN commit MUST satisfy. Tests below enforce it
 * by iterating over every edge in `loadGraphData()` and checking each
 * (edge, mode) pair separately.
 */
const EXPECTED_WIDTHS = WIDTHS;

/** All color modes that share the 5-band semantics. `relation` is
 *  excluded — it uses the default class-based stroke. */
const BAND_MODES: readonly ColorMode[] = [
  "bottleneck-risk",
  "cost",
  "maturity",
  "overall",
];

/** Permissive hex regex — any 6-char hex string. We test colour-band
 *  membership separately via the 5-stop palette extraction. */
const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Helper: walk the graph and find the first edge whose target id
 * matches `targetId`. Most assertions here pivot on an edge's TARGET
 * node — per the ADR, edge styling encodes a property of the node the
 * edge points at, not the source.
 */
function edgeTargeting(graph: GraphData, targetId: string): Edge {
  const found = graph.edges.find((e) => e.target === targetId);
  assert.ok(
    found,
    `fixture pre-check: no edge targets ${targetId} — pick a different fixture node`,
  );
  return found!;
}

/**
 * Helper: pull the unique set of stroke colours produced by a given
 * mode across the entire graph. The 5-band ramp guarantees this set
 * has at most 5 distinct values once we filter to the band cases (a
 * mode may legitimately return fewer if no edges fall in some band on
 * the current data — that's why we don't assert exactly === 5 here).
 */
function paletteFor(mode: ColorMode, graph: GraphData): Set<string> {
  const colours = new Set<string>();
  for (const edge of graph.edges) {
    const { stroke } = edgeStyleFor(edge, mode, graph);
    colours.add(stroke);
  }
  return colours;
}

function edgeWithExtremeCostSignal(
  graph: GraphData,
  direction: "lowest" | "highest",
): { edge: Edge; cost: number } {
  const candidates = graph.edges.flatMap((edge) => {
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!target) return [];
    const cost = nodeCostSignalRmb(target, graph);
    if (cost === null || cost <= 0) return [];
    return [{ edge, cost }];
  });
  assert.ok(candidates.length > 0, "fixture pre-check: graph should expose cost-bearing edge targets");
  candidates.sort((a, b) => a.cost - b.cost);
  return direction === "lowest" ? candidates[0] : candidates[candidates.length - 1];
}

// -------------------- Test 1: Cost-mode band → width pairs --------------------

/**
 * Assertion 1 (cost mode): an edge whose target sits in the LOWEST
 * cost-bin returns a cool stroke + thin width (0.8 px). An edge whose
 * target sits in the HIGHEST cost-bin returns a warm stroke + thick
 * width (7.2 px). Mid bins span the remaining widths (1.6 / 2.8 /
 * 4.6).
 *
 * Fixture choices are selected dynamically from the real graph. Cost
 * coverage now includes low-confidence estimates for paid-domain maps,
 * so historical fixed fixtures can move from the top band into a middle
 * band as the graph gets better populated.
 */
test("cost mode: lowest cost-bin → cool + width 0.8; highest cost-bin → warm + width 7.2", () => {
  const graph = loadGraphData();
  const lowFixture = edgeWithExtremeCostSignal(graph, "lowest");
  const highFixture = edgeWithExtremeCostSignal(graph, "highest");

  const low = edgeStyleFor(lowFixture.edge, "cost", graph);
  const high = edgeStyleFor(highFixture.edge, "cost", graph);

  assert.match(low.stroke, HEX_RE, `low.stroke must be a hex; got ${low.stroke}`);
  assert.match(high.stroke, HEX_RE, `high.stroke must be a hex; got ${high.stroke}`);
  assert.equal(
    low.width,
    0.8,
    `lowest cost-bin must yield width 0.8; edge=${lowFixture.edge.id}, target=${lowFixture.edge.target}, cost=${lowFixture.cost}, got ${low.width} (stroke ${low.stroke})`,
  );
  assert.equal(
    high.width,
    7.2,
    `highest cost-bin must yield width 7.2; edge=${highFixture.edge.id}, target=${highFixture.edge.target}, cost=${highFixture.cost}, got ${high.width} (stroke ${high.stroke})`,
  );
  assert.notEqual(
    low.stroke,
    high.stroke,
    `lowest and highest cost-bin strokes must differ; both got ${low.stroke}`,
  );
});

test("cost mode: aggregator edge uses rolled-up cost, not stale direct cost", () => {
  const graph = loadGraphData();
  const parcelCanvas = filterCanvasGraph(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  const parentEdge = edgeTargeting(graph, "parcel_manipulation_or_diverter");
  const childEdge = edgeTargeting(graph, "industrial_robot_arm_body");
  const parent = graph.nodes.find((node) => node.id === "parcel_manipulation_or_diverter");
  const child = graph.nodes.find((node) => node.id === "industrial_robot_arm_body");
  assert.ok(parent, "fixture: parcel_manipulation_or_diverter exists");
  assert.ok(child, "fixture: industrial_robot_arm_body exists");

  const parentCost = nodeCostSignalRmb(parent!, graph);
  const childCost = nodeCostSignalRmb(child!, graph);
  assert.ok(parentCost !== null && parentCost > 100_000, `expected rolled-up parent cost >100k, got ${parentCost}`);
  assert.ok(childCost !== null && childCost > 60_000, `expected rolled-up child cost >60k, got ${childCost}`);
  const parentStyle = edgeStyleFor(parentEdge, "cost", graph, { costScopeGraph: parcelCanvas });
  const childStyle = edgeStyleFor(childEdge, "cost", graph, { costScopeGraph: parcelCanvas });
  const globalChildStyle = edgeStyleFor(childEdge, "cost", graph);
  assert.ok(
    parentStyle.width >= childStyle.width,
    `rolled-up parent edge should be at least as prominent as the child cost edge; parent=${parentStyle.width}, child=${childStyle.width}`,
  );
  assert.ok(
    childStyle.width > globalChildStyle.width,
    `product-scoped cost lens should keep route cost drivers prominent instead of compressing them against the whole portfolio; scoped=${childStyle.width}, global=${globalChildStyle.width}`,
  );
  assert.ok(
    childStyle.width >= 4.6,
    `child cost edge should remain in a high-cost warm band within its product route; got ${childStyle.width}`,
  );
});

// -------------------- Test 2: Bin alignment across full graph --------------------

/**
 * Assertion 2 (bin alignment): for every (edge, mode) pair in the
 * full graph, the returned `width` MUST be one of the exported
 * `WIDTHS`, AND the stroke colour band's index in the
 * mode's 5-stop ramp MUST equal the band-index implied by the width.
 *
 * We implement the "band index from colour" check as: extract the
 * unique colours the mode actually produces (`paletteFor`), require
 * |palette| <= 5, then map each colour to its rank in some canonical
 * order. The "band index from width" check is: width-array index
 * lookup against `EXPECTED_WIDTHS`. The invariant is that BOTH
 * indexes are equal — same band-index drives both channels.
 *
 * We do NOT pin a specific canonical colour order here (different
 * implementations may use different hex values for their 5 stops);
 * we pin only that the colour-rank and width-rank agree, edge by
 * edge. The canonical rank is computed by grouping edges by
 * (stroke, width) pair across the whole graph and asserting that
 * each unique stroke maps to exactly one unique width — i.e. the
 * (stroke ↔ width) map is a bijection on whatever bands the data
 * exercises. A bijection IS the alignment invariant in disguise.
 */
test("bin alignment: exported width bands and stroke↔width bijection hold per mode", () => {
  const graph = loadGraphData();
  for (const mode of BAND_MODES) {
    // Map each stroke colour to the set of widths it co-occurs with.
    // If alignment holds, each set has size 1.
    const strokeToWidths = new Map<string, Set<number>>();
    for (const edge of graph.edges) {
      const { stroke, width } = edgeStyleFor(edge, mode, graph);
      assert.ok(
        (EXPECTED_WIDTHS as readonly number[]).includes(width),
        `mode=${mode}, edge=${edge.id}: width ${width} must be one of ${EXPECTED_WIDTHS.join(", ")}; got stroke=${stroke}`,
      );
      assert.match(
        stroke,
        HEX_RE,
        `mode=${mode}, edge=${edge.id}: stroke must be a hex colour; got ${stroke}`,
      );
      if (!strokeToWidths.has(stroke)) strokeToWidths.set(stroke, new Set());
      strokeToWidths.get(stroke)!.add(width);
    }
    // Alignment: each unique stroke colour must map to exactly one
    // width value across the whole graph for the mode under test.
    for (const [stroke, widths] of strokeToWidths) {
      assert.equal(
        widths.size,
        1,
        `mode=${mode}: stroke ${stroke} appears with multiple widths ${[...widths].join(",")} — colour bin and width bin disagree`,
      );
    }
    // The total palette must fit in <= 5 bands (could be fewer if the
    // data doesn't exercise every band, but never more).
    assert.ok(
      strokeToWidths.size <= 5,
      `mode=${mode}: palette has ${strokeToWidths.size} colours; must be <= 5 (one per band)`,
    );
  }
});

test("graded edge widths are visually separated enough to read without relying only on colour", () => {
  assert.deepEqual(
    [...WIDTHS],
    [0.8, 1.6, 2.8, 4.6, 7.2],
    "width bands should keep a visibly wider staircase than the legacy 0.5/1/1.5/2.5/4 ramp",
  );
  for (let i = 1; i < WIDTHS.length; i += 1) {
    assert.ok(
      WIDTHS[i] > WIDTHS[i - 1],
      `width bands must be strictly increasing; got ${WIDTHS.join(", ")}`,
    );
  }
  assert.ok(
    WIDTHS[3] - WIDTHS[2] >= 1.6,
    `band 4 must stand apart from band 3; got widths ${WIDTHS.join(", ")}`,
  );
  assert.ok(
    WIDTHS[4] - WIDTHS[3] >= 2.4,
    `band 5 must stand apart from band 4 so red/orange cost edges remain distinguishable; got widths ${WIDTHS.join(", ")}`,
  );
});

// -------------------- Test 3: Maturity mode ramp direction --------------------

/**
 * Assertion 3 (maturity mode): the ADR pins a red→green ramp where
 * low maturity is warmer and high maturity is cooler/greener (per
 * the ADR's "low-maturity target → warm stroke + thick width;
 * high-maturity target → cool stroke + thin width"). Thinner = less
 * risky, thicker = more attention-grabbing.
 *
 * Fixture: from the live data probe, maturity scores in the graph
 * span 24..92. We pick a low-maturity edge target (
 * `maintenance_workflow` at 46) and a high-maturity edge target (
 * `iphone_4` at 92, which has `bottleneckOf` set but maturity is
 * still high). The widths and warmth direction must reverse between
 * the two.
 */
test("maturity mode: low-maturity target → thicker width than high-maturity target", () => {
  const graph = loadGraphData();
  const lowMatEdge = edgeTargeting(graph, "maintenance_workflow"); // mat 46
  const highMatEdge = edgeTargeting(graph, "iphone_4"); // mat 92

  const lowMat = edgeStyleFor(lowMatEdge, "maturity", graph);
  const highMat = edgeStyleFor(highMatEdge, "maturity", graph);

  assert.ok(
    (EXPECTED_WIDTHS as readonly number[]).includes(lowMat.width),
    `lowMat.width must be in EXPECTED_WIDTHS; got ${lowMat.width}`,
  );
  assert.ok(
    (EXPECTED_WIDTHS as readonly number[]).includes(highMat.width),
    `highMat.width must be in EXPECTED_WIDTHS; got ${highMat.width}`,
  );
  // Direction: lower maturity must produce a strictly thicker edge
  // because the ADR aligns "thicker = more risky" with "red end of
  // maturity ramp = low maturity = more risky to depend on".
  assert.ok(
    lowMat.width > highMat.width,
    `maturity mode: low-maturity target ${lowMatEdge.target} (mat 46, width ${lowMat.width}) must be thicker than high-maturity target ${highMatEdge.target} (mat 92, width ${highMat.width})`,
  );
  // Strokes must also differ.
  assert.notEqual(
    lowMat.stroke,
    highMat.stroke,
    `maturity mode: low-mat and high-mat strokes must differ; both got ${lowMat.stroke}`,
  );
});

// -------------------- Test 4: Bottleneck-risk mode --------------------

/**
 * Assertion 4 (bottleneck-risk mode): an edge whose target has
 * `bottleneckOf` non-empty OR a high COMPOSITE chokepoint score ranks
 * warmest.
 *
 * ADR-0010 rewrote this lens: `bottleneck-risk` now bands by the
 * four-axis chokepoint composite (Criticality × Concentration × Barrier,
 * own-quantile banded) instead of the old `(1 - maturity) × cost`
 * `nodeRisk`. The previous high-risk fixture `parcel_manipulation_or_
 * diverter` was top by cost-share but is an aggregator with fan-in 1
 * (only the root product requires it — it otherwise depends on its
 * children), so the composite correctly bands it LOW (band 2). That
 * property of the old formula no longer holds by design, so this test
 * now exercises the new lens:
 *
 *   - `industrial_robot_arm_body` — a shared, high-Criticality robot
 *     component the composite bands 5 (no `bottleneckOf`; exercises the
 *     computed-composite-high branch, the ADR-0010 analogue of the old
 *     "high-via-nodeRisk" branch).
 *   - `conveyor_integration` — `bottleneckOf` set, so the authored
 *     override still forces band 5 (exercises the override branch, the
 *     one behavior ADR-0010 deliberately preserves).
 *   - `machine_vision_lens_and_optics` — a low-Criticality leaf the
 *     composite bands 2 (the low fixture, unchanged in spirit).
 *
 * Both high edges MUST be strictly thicker than the low edge. We also
 * assert the underlying bands directly so the recomputed ADR-0010
 * expectation is explicit and a future data/score drift fails loudly.
 */
test("bottleneck-risk mode: edges to high-chokepoint targets are thicker / warmer than to low-chokepoint targets", () => {
  const graph = loadGraphData();
  const highCompositeEdge = edgeTargeting(graph, "industrial_robot_arm_body");
  const bottleneckOfEdge = edgeTargeting(graph, "conveyor_integration");
  const lowEdge = edgeTargeting(graph, "machine_vision_lens_and_optics");

  const high = edgeStyleFor(highCompositeEdge, "bottleneck-risk", graph);
  const bottleneckOf = edgeStyleFor(bottleneckOfEdge, "bottleneck-risk", graph);
  const low = edgeStyleFor(lowEdge, "bottleneck-risk", graph);

  // Recomputed ADR-0010 oracle: the composite bands the shared arm body 5
  // and the lens/optics leaf 2; the authored bottleneckOf override forces
  // conveyor_integration to band 5 regardless of its computed score.
  assert.equal(high.width, WIDTHS[4], `composite-high target should sit in band 5 (width ${WIDTHS[4]}); got ${high.width}`);
  assert.equal(bottleneckOf.width, WIDTHS[4], `bottleneckOf override should force band 5 (width ${WIDTHS[4]}); got ${bottleneckOf.width}`);

  assert.ok(
    high.width > low.width,
    `bottleneck-risk: high-composite target ${highCompositeEdge.target} (width ${high.width}) must be thicker than low target ${lowEdge.target} (width ${low.width})`,
  );
  assert.ok(
    bottleneckOf.width > low.width,
    `bottleneck-risk: target with bottleneckOf set (${bottleneckOfEdge.target}, width ${bottleneckOf.width}) must be thicker than low target ${lowEdge.target} (width ${low.width})`,
  );
});

// -------------------- Test 5: Relation mode (default behaviour) --------------------

/**
 * Assertion 5 (relation mode): per the ADR, `relation` mode is the
 * "legacy" path — it returns a default class-based stroke (the
 * old `NEUTRAL_TINT` value `#94a3b8` carried over from the slice-2
 * `edgeTintFor`). The spec deliberately tells us not to strongly
 * pin a specific width here ("Width is constant 1.5px (or whatever
 * default the implementer picks)"), so we only check:
 *   - The stroke is the neutral grey value `#94a3b8`.
 *   - The width is some constant — i.e. all edges in relation mode
 *     return the SAME width, whatever value the implementer chose.
 */
test("relation mode: returns the neutral grey stroke + a constant width for every edge", () => {
  const graph = loadGraphData();
  const widths = new Set<number>();
  const strokes = new Set<string>();
  for (const edge of graph.edges) {
    const { stroke, width } = edgeStyleFor(edge, "relation", graph);
    widths.add(width);
    strokes.add(stroke);
  }
  assert.equal(
    widths.size,
    1,
    `relation mode: width must be constant across all edges; got ${[...widths].join(",")}`,
  );
  assert.equal(
    strokes.size,
    1,
    `relation mode: stroke must be constant across all edges; got ${[...strokes].join(",")}`,
  );
  // Stroke must be a hex colour (we don't pin the exact value to keep
  // future palette tweaks easy, but it must be the same neutral grey
  // used elsewhere — `#94a3b8` per the original `NEUTRAL_TINT`).
  const [stroke] = [...strokes];
  assert.match(stroke, HEX_RE, `relation mode: stroke must be a hex colour; got ${stroke}`);
  assert.equal(
    stroke.toLowerCase(),
    "#94a3b8",
    `relation mode: stroke must be the NEUTRAL_TINT (#94a3b8) carried over from slice 2; got ${stroke}`,
  );
});

// -------------------- Test 6: Determinism --------------------

/**
 * Assertion 6 (determinism): same (edge, mode, graph) input → same
 * `{ stroke, width }` output, bit-for-bit, on repeat calls. Pure
 * function — no internal mutation, no module-level cache that
 * forgets across calls.
 */
test("determinism: same input yields same output across modes", () => {
  const graph = loadGraphData();
  const edge: Edge = graph.edges[0];
  for (const mode of BAND_MODES) {
    const a = edgeStyleFor(edge, mode, graph);
    const b = edgeStyleFor(edge, mode, graph);
    assert.deepEqual(
      a,
      b,
      `edgeStyleFor(${edge.id}, "${mode}") must be deterministic across calls; got ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
    );
    // Sanity on the values.
    assert.ok(Number.isFinite(a.width), `width must be a finite number; got ${a.width}`);
    assert.match(a.stroke, HEX_RE, `stroke must be a hex colour; got ${a.stroke}`);
  }
  // relation mode too.
  const r1 = edgeStyleFor(edge, "relation", graph);
  const r2 = edgeStyleFor(edge, "relation", graph);
  assert.deepEqual(
    r1,
    r2,
    `edgeStyleFor(${edge.id}, "relation") must be deterministic across calls`,
  );
});

// -------------------- Test 7: Palette extraction across the whole graph (caveat doc) --------------------

/**
 * Sanity check that the test fixture is well-formed for the band-
 * alignment test above. The live data has very few high-cost edges
 * (with `industrial_robot_arm_body` now calibrated at a six-figure
 * p50), so the cost mode palette may be sparser than the maturity
 * palette. This test merely SURFACES the sparsity if it's there, so a
 * future change to the cost thresholds or to the data is caught loudly
 * rather than silently shifting the alignment test's coverage.
 *
 * No band invariant is being checked here — this is purely a
 * fixture-introspection test that runs after the alignment test
 * above. It will pass on the GREEN commit as long as `edgeStyleFor`
 * is implemented at all; its value is in the diagnostic output the
 * commit message references.
 */
test("palette diagnostic: cost mode may have a sparser palette than maturity in current data", () => {
  const graph = loadGraphData();
  const costPalette = paletteFor("cost", graph);
  const maturityPalette = paletteFor("maturity", graph);
  // Both palettes must produce SOME signal.
  assert.ok(
    costPalette.size >= 2,
    `cost palette must have ≥ 2 distinct strokes (was the cap tuned away from real data?); got ${costPalette.size}`,
  );
  assert.ok(
    maturityPalette.size >= 2,
    `maturity palette must have ≥ 2 distinct strokes; got ${maturityPalette.size}`,
  );
});

// -------------------- Reference type for static check --------------------

/**
 * Type-level sanity: the exported `ColorMode` must include all 5
 * mode strings. We hold a tiny constant typed against `ColorMode` so
 * TypeScript catches drift if the union changes shape during the
 * GREEN commit (the bring-back's pinned set is exactly these 5).
 */
const _MODES_TYPE_CHECK: readonly ColorMode[] = [
  "bottleneck-risk",
  "cost",
  "maturity",
  "overall",
  "relation",
];
void _MODES_TYPE_CHECK;

// Reference unused-import-defense: `Node` is imported above because
// some implementations of edgeStyleFor will need it for cross-walks,
// and the test author wants the type re-export verified. We touch
// it to silence the no-unused-vars rule.
const _NODE_TYPE_CHECK: Node | null = null;
void _NODE_TYPE_CHECK;
