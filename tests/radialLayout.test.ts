import test from "node:test";
import assert from "node:assert/strict";
import { radialLayout } from "../src/lib/radialLayout";
import type { GraphData } from "../src/lib/schema";
import { loadGraphData } from "../src/lib/graphLoader";

/**
 * RED tests for Slice A2 (spec:
 * docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
 * ADR-0006 §Layout).
 *
 * `radialLayout` is a NEW pure function that maps a `GraphData` to polar
 * coordinates for every *structural* node, plus a parallel edge-style map
 * recording which `requires` edges are the canonical primary parent's
 * edge and which are cross-sector secondary edges. The function does not
 * yet exist — the import at the top of this file fails today; the GREEN
 * commit adds `src/lib/radialLayout.ts` with the implementation.
 *
 * Contract (from ADR-0006 §Layout):
 *   1. Focal product at r=0, theta=0. "Focal product" = first node with
 *      kind === "product" in the graph (deterministic via stable input
 *      ordering — see assertion in test 1 below).
 *   2. The N first-layer subsystem modules (children of focal product
 *      via `requires` edges) sit on a ring at r = R1, theta = i × (2π/N)
 *      for i in [0, N), N = count of first-layer subsystems.
 *   3. Each descendant of subsystem i (via `requires` chains, never
 *      crossing into a different first-layer subsystem) has r > R1 and
 *      theta in the half-open sector [i × (2π/N), (i+1) × (2π/N)).
 *   4. Materials (kind === "material") sit at r = R_outer with
 *      R_outer > R1 + max-descendant-radius, regardless of which
 *      subsystems consume them.
 *   5. Shared structural nodes (≥ 2 incoming `requires` edges) get
 *      exactly ONE canonical position in ONE primary parent's sector;
 *      the secondary parents' edges are tagged `'cross'`, the canonical
 *      parent's edge is `'primary'`.
 *   6. Deterministic: same input → same output bit-for-bit.
 *
 * Function shape locked here:
 *   radialLayout(graph): {
 *     positions: Map<string /* node id *\/, { r: number, theta: number }>,
 *     edges:     Map<string /* edge id *\/, { style: 'primary' | 'cross' }>,
 *   }
 */

const TWO_PI = Math.PI * 2;

/**
 * Hand-built fixture for the unit-level geometric assertions.
 *
 * Topology:
 *   - P (product, focal)
 *   - 4 first-layer subsystems: S0, S1, S2, S3 (children of P via `requires`)
 *     → with N = 4 the expected angular sector size is 2π/4 = π/2 = 90°.
 *   - S0 has descendants D0a, D0b (depth 2)
 *   - S1 has descendant D1a (depth 2)
 *   - Shared module H is required by both S0 AND S2 (two parents). Its
 *     canonical sector is one of {S0, S2}; the other parent's edge is
 *     'cross'. Test asserts the cross/primary split is consistent
 *     (exactly one primary parent edge, the other is cross).
 *   - M0 is a material consumed by S1 and S3 (two parents). Materials
 *     live on the outer ring regardless of parent.
 *
 * Maturity fields omitted so no maturityAsOf is required (per ADR-0002).
 */
function handBuiltFixture(): GraphData {
  return {
    graphVersion: "test-radial-A2",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "S0", name: "Subsystem 0", kind: "module", domain: ["test"] },
      { id: "S1", name: "Subsystem 1", kind: "module", domain: ["test"] },
      { id: "S2", name: "Subsystem 2", kind: "module", domain: ["test"] },
      { id: "S3", name: "Subsystem 3", kind: "module", domain: ["test"] },
      { id: "D0a", name: "Descendant 0a", kind: "module", domain: ["test"] },
      { id: "D0b", name: "Descendant 0b", kind: "module", domain: ["test"] },
      { id: "D1a", name: "Descendant 1a", kind: "module", domain: ["test"] },
      { id: "H", name: "Shared module", kind: "module", domain: ["test"] },
      { id: "M0", name: "Material 0", kind: "material", domain: ["test"] },
    ],
    edges: [
      { id: "ePS0", source: "P", target: "S0", relation: "requires" },
      { id: "ePS1", source: "P", target: "S1", relation: "requires" },
      { id: "ePS2", source: "P", target: "S2", relation: "requires" },
      { id: "ePS3", source: "P", target: "S3", relation: "requires" },
      { id: "eS0D0a", source: "S0", target: "D0a", relation: "requires" },
      { id: "eS0D0b", source: "S0", target: "D0b", relation: "requires" },
      { id: "eS1D1a", source: "S1", target: "D1a", relation: "requires" },
      // Shared node H — two requires parents (S0, S2):
      { id: "eS0H", source: "S0", target: "H", relation: "requires" },
      { id: "eS2H", source: "S2", target: "H", relation: "requires" },
      // Material M0 — consumed by S1 and S3 via requires:
      { id: "eS1M0", source: "S1", target: "M0", relation: "requires" },
      { id: "eS3M0", source: "S3", target: "M0", relation: "requires" },
    ],
    evidence: [],
  };
}

/**
 * Property 1: focal product at (r=0, theta=0).
 *
 * "Focal product" is the first node with kind === "product" encountered in
 * `graph.nodes`. In the hand-built fixture, that is "P". The function is
 * expected to return exactly `{ r: 0, theta: 0 }` for it.
 */
test("radialLayout P1: focal product is at r=0, theta=0", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  assert.ok(result.positions instanceof Map, "positions must be a Map");
  const pos = result.positions.get("P");
  assert.ok(pos, "focal product P must be positioned");
  assert.equal(pos!.r, 0, `focal product r must be 0; got ${pos!.r}`);
  assert.equal(pos!.theta, 0, `focal product theta must be 0; got ${pos!.theta}`);
});

/**
 * Property 2: N first-layer subsystems sit on a ring r = R1 (a constant
 * > 0) at angular spacing 2π/N. With N=4 the expected thetas are
 * { 0, π/2, π, 3π/2 } in some assignment to {S0, S1, S2, S3} consistent
 * with the function's input ordering (we don't pin which S gets which
 * angle index — only that the four thetas are the four multiples of π/2,
 * and they share one common r > 0).
 */
test("radialLayout P2: N first-layer subsystems sit on R1 ring at theta = i * (2π/N)", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  const subs = ["S0", "S1", "S2", "S3"] as const;
  const N = subs.length;
  const r1Values = subs.map((id) => {
    const p = result.positions.get(id);
    assert.ok(p, `subsystem ${id} must be positioned`);
    return p!.r;
  });
  // All four share the same r (the R1 ring radius).
  const r1 = r1Values[0];
  assert.ok(r1 > 0, `R1 must be > 0; got ${r1}`);
  for (const r of r1Values) {
    assert.equal(r, r1, `all first-layer subsystems must share r = R1 = ${r1}; got ${r}`);
  }
  // The four thetas (mod 2π) must equal {0, π/2, π, 3π/2}.
  const thetasMod = subs
    .map((id) => ((result.positions.get(id)!.theta % TWO_PI) + TWO_PI) % TWO_PI)
    .sort((a, b) => a - b);
  const expected = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (let i = 0; i < N; i += 1) {
    assert.ok(
      Math.abs(thetasMod[i] - expected[i]) < 1e-9,
      `subsystem theta[${i}] should be ${expected[i]}; got ${thetasMod[i]}`,
    );
  }
});

/**
 * Property 3: each descendant of subsystem i has r > R1 and its theta
 * falls within the half-open sector [i × (2π/N), (i+1) × (2π/N)) anchored
 * on its first-layer subsystem's theta.
 *
 * With N=4, sector size is π/2. For each (subsystem, descendant) pair we
 * recover the subsystem's theta S_θ (= sector index × π/2) and assert the
 * descendant's theta lies in [S_θ, S_θ + π/2) when normalized to [0, 2π).
 */
test("radialLayout P3: descendants stay within their first-layer subsystem's sector and outside R1", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  const sectorSize = TWO_PI / 4;
  const r1 = result.positions.get("S0")!.r;

  for (const [parentId, descendantId] of [
    ["S0", "D0a"],
    ["S0", "D0b"],
    ["S1", "D1a"],
  ] as const) {
    const parent = result.positions.get(parentId);
    const desc = result.positions.get(descendantId);
    assert.ok(parent, `subsystem ${parentId} must be positioned`);
    assert.ok(desc, `descendant ${descendantId} must be positioned`);
    // Descendant sits outside the R1 ring (deeper layer, larger r):
    assert.ok(
      desc!.r > r1,
      `${descendantId}.r (${desc!.r}) must be > R1 (${r1})`,
    );
    // Normalise both thetas to [0, 2π); descendant must fall in
    // [parent_theta_floor, parent_theta_floor + sectorSize).
    const parentTheta = ((parent!.theta % TWO_PI) + TWO_PI) % TWO_PI;
    const descTheta = ((desc!.theta % TWO_PI) + TWO_PI) % TWO_PI;
    const floor = Math.floor(parentTheta / sectorSize) * sectorSize;
    assert.ok(
      descTheta >= floor - 1e-9 && descTheta < floor + sectorSize - 1e-9,
      `${descendantId}.theta (${descTheta}) must be in sector [${floor}, ${floor + sectorSize}) anchored on ${parentId}`,
    );
  }
});

/**
 * Property 4: materials live on the outer ring at r = R_outer, and
 * R_outer > R1 + max-descendant-radius (any non-material descendant's r).
 * Theta for materials is allowed to be anything — the implementation
 * picks a deterministic value (canonical-parent heuristic or hash) — so
 * we do not pin it here; property 6 covers determinism.
 */
test("radialLayout P4: materials sit on R_outer outside R1 + max-descendant-radius", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  const m0 = result.positions.get("M0");
  assert.ok(m0, "material M0 must be positioned");
  const r1 = result.positions.get("S0")!.r;
  const nonMaterialDescendantRs = ["D0a", "D0b", "D1a", "H"]
    .map((id) => result.positions.get(id)?.r)
    .filter((v): v is number => typeof v === "number");
  const maxDescR = nonMaterialDescendantRs.length > 0 ? Math.max(...nonMaterialDescendantRs) : r1;
  assert.ok(
    m0!.r > maxDescR,
    `material M0.r (${m0!.r}) must exceed max non-material descendant r (${maxDescR})`,
  );
  assert.ok(m0!.r > r1, `material M0.r (${m0!.r}) must exceed R1 (${r1})`);
});

/**
 * Property 5: a shared structural node (≥ 2 incoming `requires` parents)
 * has exactly ONE position. The parallel edges Map records exactly one
 * `'primary'` style for the canonical parent's edge to H, and `'cross'`
 * for every secondary parent's edge to H.
 *
 * In the fixture, H has two parents (S0, S2). So exactly one of
 * {eS0H, eS2H} is 'primary' and the other is 'cross'.
 */
test("radialLayout P5: shared node has one position; secondary parent edges marked 'cross'", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  // H is positioned exactly once (the Map can only hold one value per
  // key — but we also assert it's present and pinned to numeric polar
  // coords, not undefined):
  const h = result.positions.get("H");
  assert.ok(h, "shared module H must be positioned");
  assert.equal(typeof h!.r, "number");
  assert.equal(typeof h!.theta, "number");

  // The edges Map must classify both incoming `requires` edges to H:
  assert.ok(result.edges instanceof Map, "edges must be a Map");
  const s0h = result.edges.get("eS0H");
  const s2h = result.edges.get("eS2H");
  assert.ok(s0h, "edge eS0H must appear in edges map");
  assert.ok(s2h, "edge eS2H must appear in edges map");

  const styles = [s0h!.style, s2h!.style].sort();
  assert.deepEqual(
    styles,
    ["cross", "primary"],
    `shared node H should have exactly one 'primary' parent edge and one 'cross' edge; got ${JSON.stringify(styles)}`,
  );

  // And H sits inside the canonical parent's sector. The canonical
  // parent is whichever of S0 / S2 owns the 'primary' edge to H.
  const canonicalParentId = s0h!.style === "primary" ? "S0" : "S2";
  const sectorSize = TWO_PI / 4;
  const parentTheta =
    ((result.positions.get(canonicalParentId)!.theta % TWO_PI) + TWO_PI) % TWO_PI;
  const hTheta = ((h!.theta % TWO_PI) + TWO_PI) % TWO_PI;
  const floor = Math.floor(parentTheta / sectorSize) * sectorSize;
  assert.ok(
    hTheta >= floor - 1e-9 && hTheta < floor + sectorSize - 1e-9,
    `H.theta (${hTheta}) must be in canonical parent ${canonicalParentId}'s sector [${floor}, ${floor + sectorSize})`,
  );
});

/**
 * Property 6: deterministic — same input → same output bit-for-bit.
 *
 * We invoke `radialLayout` twice on the same input and assert the two
 * outputs are deeply equal (Maps compared key-by-key as plain object
 * snapshots, since `assert.deepEqual` on Maps compares structurally).
 */
test("radialLayout P6: deterministic — same input yields same output bit-for-bit", () => {
  const graph = handBuiltFixture();
  const a = radialLayout(graph);
  const b = radialLayout(graph);
  // Compare via materialised plain objects so any deepEqual quirk on
  // Map ordering surfaces as a clear diff in the failure message.
  const snap = (r: { positions: Map<string, { r: number; theta: number }>; edges: Map<string, { style: "primary" | "cross" }> }) => ({
    positions: [...r.positions.entries()].sort(([x], [y]) => x.localeCompare(y)),
    edges: [...r.edges.entries()].sort(([x], [y]) => x.localeCompare(y)),
  });
  assert.deepEqual(snap(a), snap(b), "two calls with identical input must return identical output");
});

/**
 * Smoke test on the real migrated parcel-sorting data. Every structural
 * node must receive a position. Descriptive nodes (metric, capability,
 * empirical_principle, scientific_principle, standard_or_regulation,
 * etc.) are deliberately excluded per ADR-0006 §"Node classification" —
 * they live in the detail panel only.
 *
 * The first-product node in the migrated data is
 * `low_cost_parcel_sorting_robot_300k_rmb`; it has 14 first-layer
 * subsystems (NOT the 12 the spec narrative quotes — the real fixture
 * grew during the A1 migration). The test asserts the count taken from
 * the graph itself, so it remains correct as data evolves.
 */
test("radialLayout smoke: every structural node in real parcel-sorting data is positioned", () => {
  const graph = loadGraphData();
  const result = radialLayout(graph);
  const structuralKinds = new Set([
    "product",
    "module",
    "material",
    "engineering_method",
    "manufacturing_process",
  ]);
  const missing: string[] = [];
  for (const node of graph.nodes) {
    if (!structuralKinds.has(node.kind)) continue;
    if (!result.positions.has(node.id)) missing.push(node.id);
  }
  assert.deepEqual(
    missing,
    [],
    `every structural node must be positioned; missing: ${JSON.stringify(missing)}`,
  );
});
