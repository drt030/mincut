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

function unevenTreeFixture(): GraphData {
  const bigDescendants = Array.from({ length: 14 }, (_, i) => ({
    id: `B${i}`,
    name: `Big descendant ${i}`,
    kind: "module" as const,
    domain: ["test"],
  }));
  return {
    graphVersion: "test-radial-uneven-tree",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "BIG", name: "Large subsystem", kind: "module", domain: ["test"] },
      { id: "SMALL", name: "Small subsystem", kind: "module", domain: ["test"] },
      { id: "TINY", name: "Tiny subsystem", kind: "module", domain: ["test"] },
      ...bigDescendants,
      { id: "S0", name: "Small child", kind: "module", domain: ["test"] },
    ],
    edges: [
      { id: "ePBIG", source: "P", target: "BIG", relation: "requires" },
      { id: "ePSMALL", source: "P", target: "SMALL", relation: "requires" },
      { id: "ePTINY", source: "P", target: "TINY", relation: "requires" },
      ...bigDescendants.map((node) => ({
        id: `eBIG${node.id}`,
        source: "BIG",
        target: node.id,
        relation: "requires" as const,
      })),
      { id: "eSMALLS0", source: "SMALL", target: "S0", relation: "requires" },
    ],
    evidence: [],
  };
}

function nestedTreeFixture(): GraphData {
  return {
    graphVersion: "test-radial-nested-tree",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "TREE", name: "Nested subsystem", kind: "module", domain: ["test"] },
      { id: "OTHER", name: "Other subsystem", kind: "module", domain: ["test"] },
      { id: "A", name: "Wide branch", kind: "module", domain: ["test"] },
      { id: "B", name: "Narrow branch", kind: "module", domain: ["test"] },
      { id: "A1", name: "A child 1", kind: "module", domain: ["test"] },
      { id: "A2", name: "A child 2", kind: "module", domain: ["test"] },
      { id: "A3", name: "A child 3", kind: "module", domain: ["test"] },
      { id: "B1", name: "B only child", kind: "module", domain: ["test"] },
    ],
    edges: [
      { id: "ePTREE", source: "P", target: "TREE", relation: "requires" },
      { id: "ePOTHER", source: "P", target: "OTHER", relation: "requires" },
      { id: "eTREEA", source: "TREE", target: "A", relation: "requires" },
      { id: "eTREEB", source: "TREE", target: "B", relation: "requires" },
      { id: "eAA1", source: "A", target: "A1", relation: "requires" },
      { id: "eAA2", source: "A", target: "A2", relation: "requires" },
      { id: "eAA3", source: "A", target: "A3", relation: "requires" },
      { id: "eBB1", source: "B", target: "B1", relation: "requires" },
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

test("radialLayout can place a selected subsystem root at the center", () => {
  const graph = nestedTreeFixture();
  const result = radialLayout(graph, "TREE");

  assert.deepEqual(result.positions.get("TREE"), { r: 0, theta: 0 });
  assert.equal(result.sectors.has("A"), true);
  assert.equal(result.sectors.has("B"), true);
  assert.equal(result.sectors.has("OTHER"), false);
  assert.ok(
    (result.positions.get("P")?.r ?? 0) > (result.positions.get("A")?.r ?? Number.POSITIVE_INFINITY),
    "the previous product parent should move to the fallback ring instead of remaining central",
  );
});

/**
 * Property 2: first-layer subsystems sit on the R1 ring, but the
 * angular slots are NOT fixed equal sectors. ADR-0007's Stable Balanced
 * Radial Tree gives denser canonical subtrees more room while keeping
 * deterministic branch order.
 */
test("radialLayout P2: first-layer subsystems use weighted angular slots instead of equal sectors", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
  const subs = ["S0", "S1", "S2", "S3"] as const;
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

  assert.ok(result.sectors instanceof Map, "balanced layout must expose first-layer sector metadata");
  const s0 = result.sectors.get("S0");
  const s1 = result.sectors.get("S1");
  const s2 = result.sectors.get("S2");
  const s3 = result.sectors.get("S3");
  assert.ok(s0 && s1 && s2 && s3, "every first-layer subsystem must have a sector");

  const total = s0!.width + s1!.width + s2!.width + s3!.width;
  assert.ok(Math.abs(total - TWO_PI) < 1e-9, `sector widths must sum to 2π; got ${total}`);
  assert.ok(
    s0!.width > s1!.width && s1!.width > s2!.width && Math.abs(s2!.width - s3!.width) < 1e-9,
    `expected canonical subtree weights S0 > S1 > S2 = S3; got ${JSON.stringify({
      S0: s0!.width,
      S1: s1!.width,
      S2: s2!.width,
      S3: s3!.width,
    })}`,
  );
  assert.notDeepEqual(
    [s0!.width, s1!.width, s2!.width, s3!.width].map((w) => Number(w.toFixed(9))),
    Array(4).fill(Number((TWO_PI / 4).toFixed(9))),
    "balanced radial tree must not collapse back to equal first-layer sectors",
  );
  for (const sub of subs) {
    const sector = result.sectors.get(sub)!;
    assert.equal(
      result.positions.get(sub)!.theta,
      sector.center,
      `${sub} should sit at its balanced sector center`,
    );
  }
});

test("radialLayout gives visibly more angle to large visible subtrees instead of overprotecting tiny sectors", () => {
  const result = radialLayout(unevenTreeFixture());
  const big = result.sectors.get("BIG");
  const small = result.sectors.get("SMALL");
  const tiny = result.sectors.get("TINY");
  assert.ok(big && small && tiny, "all first-layer sectors must exist");

  assert.ok(
    big!.width > small!.width * 4,
    `large subtree should receive at least 4x the angle of a two-node subtree; got BIG=${big!.width}, SMALL=${small!.width}`,
  );
  assert.ok(
    small!.width > tiny!.width,
    `two-node subtree should receive more room than a leaf sector; got SMALL=${small!.width}, TINY=${tiny!.width}`,
  );
});

test("radialLayout clusters nested descendants under their parent instead of distributing each depth across the whole sector", () => {
  const result = radialLayout(nestedTreeFixture());
  const tree = result.sectors.get("TREE");
  assert.ok(tree, "TREE sector must exist");

  const b = result.positions.get("B");
  const b1 = result.positions.get("B1");
  assert.ok(b && b1, "B and B1 must both be positioned");
  assert.equal(
    b1!.theta,
    b!.theta,
    "a single-child branch should continue along the parent's angle instead of being spread by global depth index",
  );

  const a = result.positions.get("A");
  const aChildren = ["A1", "A2", "A3"].map((id) => result.positions.get(id));
  assert.ok(a && aChildren.every(Boolean), "A and its children must be positioned");
  const maxChildSpreadFromA = Math.max(
    ...aChildren.map((pos) => Math.abs(pos!.theta - a!.theta)),
  );
  assert.ok(
    maxChildSpreadFromA < tree!.width / 2,
    `A's children should occupy A's local branch envelope, not the entire TREE sector; max spread=${maxChildSpreadFromA}, sectorHalf=${tree!.width / 2}`,
  );
});

/**
 * Property 3: descendants stay inside their canonical first-layer
 * subsystem's balanced angular slot and outside R1.
 */
test("radialLayout P3: descendants stay within their balanced first-layer sector and outside R1", () => {
  const graph = handBuiltFixture();
  const result = radialLayout(graph);
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
    const sector = result.sectors.get(parentId);
    assert.ok(sector, `balanced sector for ${parentId} must exist`);
    const descTheta = ((desc!.theta % TWO_PI) + TWO_PI) % TWO_PI;
    const start = sector!.center - sector!.width / 2;
    const end = sector!.center + sector!.width / 2;
    assert.ok(
      descTheta >= start - 1e-9 && descTheta <= end + 1e-9,
      `${descendantId}.theta (${descTheta}) must be in balanced sector [${start}, ${end}] anchored on ${parentId}`,
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

  // And H sits inside the canonical parent's balanced sector. The canonical
  // parent is whichever of S0 / S2 owns the 'primary' edge to H.
  const canonicalParentId = s0h!.style === "primary" ? "S0" : "S2";
  const sector = result.sectors.get(canonicalParentId);
  assert.ok(sector, `balanced sector for ${canonicalParentId} must exist`);
  const hTheta = ((h!.theta % TWO_PI) + TWO_PI) % TWO_PI;
  const start = sector!.center - sector!.width / 2;
  const end = sector!.center + sector!.width / 2;
  assert.ok(
    hTheta >= start - 1e-9 && hTheta <= end + 1e-9,
    `H.theta (${hTheta}) must be in canonical parent ${canonicalParentId}'s balanced sector [${start}, ${end}]`,
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
