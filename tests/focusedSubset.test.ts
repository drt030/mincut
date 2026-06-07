import test from "node:test";
import assert from "node:assert/strict";

// RED Slice B3 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice B3 — Greyscale focus";
// ADR-0006 § "Focus interaction").
//
// `focusedSubset` is the NEW pure function the GREEN commit will add
// at src/lib/focusedSubset.ts. It returns the set of node ids and the
// set of edge ids that should remain at FULL saturation while the
// rest of the canvas desaturates to greyscale.
//
// Signature (pinned by this test):
//
//   export type FocusedSubset = {
//     nodes: Set<string>;   // node ids that stay full-saturation
//     edges: Set<string>;   // edge ids (graph.edges[i].id) that stay full-saturation
//   };
//   export function focusedSubset(
//     focusId: string | null,
//     graph: GraphData,
//   ): FocusedSubset;
//
// Contract (per ADR-0006 § "Focus interaction"):
//   > X and all of X's descendants stay full saturation; ancestors,
//   > siblings, sibling subtrees, and all other sectors desaturate
//   > to greyscale (positions preserved).
//
// Concrete rules pinned by this test:
//   - focusId === null  → ALL node ids AND ALL edge ids are in the
//     sets. The overview reads "everything bright."
//   - focusId === <known id>  → `nodes` contains focusId plus every
//     id reachable by walking ONLY `relation === "requires"` edges
//     in the forward (source → target) direction starting at focusId.
//     NOT ancestors. NOT siblings. NOT unrelated subtrees. Only the
//     downward `requires`-subtree.
//   - focusId === <unknown id>  → returns empty sets. Forces the
//     GREEN UI to default to "everything desaturated", which surfaces
//     the bug rather than silently falling back to "everything bright".
//   - edges: an edge id is in `edges` iff BOTH `source` and `target`
//     are in `nodes`. Read the edge id from `graph.edges[i].id` —
//     same convention as `radialLayout`'s edges Map (A2).
//   - Deterministic: same input → same output, set membership
//     identical, comparing via sorted Array.from(set).
//
// The module does not exist yet; this import fails at load time,
// which is the cleanest RED signal we can give the GREEN sub-agent.
import { focusedSubset } from "../src/lib/focusedSubset";
import { loadGraphData } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";

const FOCAL_PRODUCT_ID = "low_cost_parcel_sorting_robot_300k_rmb";

/**
 * Build a `requires` adjacency map (source → targets) for the loaded
 * graph. This is the same traversal `focusedSubset` itself uses; the
 * test uses it independently as an oracle so we don't import the
 * function-under-test's internals to validate it.
 */
function buildRequiresAdjacency(graph: GraphData): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.relation !== "requires") continue;
    const list = out.get(e.source);
    if (list) list.push(e.target);
    else out.set(e.source, [e.target]);
  }
  return out;
}

/**
 * Independent oracle: walk forward via `requires` edges from `start`.
 * Returns the set including `start` itself. Used to compute the
 * expected subtree size so the test pins a specific number and
 * catches drift if data changes.
 */
function requiresDescendants(start: string, adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>([start]);
  const stack: string[] = [start];
  while (stack.length) {
    const n = stack.pop()!;
    for (const child of adj.get(n) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        stack.push(child);
      }
    }
  }
  return visited;
}

// ------------------------------------------------------------------
// Test 1: focusId === null → everything is bright
// ------------------------------------------------------------------
//
// The "overview" state: no focus, nothing greyed out. Every node id
// must appear in `nodes`, and every edge id (regardless of relation
// — `measured_by`, `manufactured_by`, etc., not only `requires`)
// must appear in `edges`. Pinning "every edge" rather than "every
// `requires` edge" makes the contract unambiguous: greyscale is a
// pure visual concern; without focus, nothing is visually demoted.
test("focusId=null: every node and every edge is in the full-saturation subset", () => {
  const graph = loadGraphData();
  const subset = focusedSubset(null, graph);

  assert.equal(
    subset.nodes.size,
    graph.nodes.length,
    `with no focus, all ${graph.nodes.length} nodes must be saturated; got ${subset.nodes.size}`,
  );
  for (const node of graph.nodes) {
    assert.ok(
      subset.nodes.has(node.id),
      `node ${node.id} must appear in nodes when focusId=null`,
    );
  }

  assert.equal(
    subset.edges.size,
    graph.edges.length,
    `with no focus, all ${graph.edges.length} edges must be saturated; got ${subset.edges.size}`,
  );
  for (const edge of graph.edges) {
    assert.ok(
      subset.edges.has(edge.id),
      `edge ${edge.id} must appear in edges when focusId=null`,
    );
  }
});

// ------------------------------------------------------------------
// Test 2: focusId = the focal product itself
// ------------------------------------------------------------------
//
// The focal product is the root of the whole structural subtree.
// Focusing it = "show me the entire BoM of THIS product, grey out
// everything else (other products, materials only the other products
// use, the iPhone case study, etc.)".
//
// Data probe (2026-06-07 vision compute integration decomposition pass):
//   - The focal product has exactly 90 `requires`-reachable structural
//     nodes including itself. Pinning that exact size guards against
//     accidental data growth into the subtree.
//   - The iPhone test product (`iphone_4`) is a sibling at root level,
//     never reachable via `requires` from the focal product → MUST
//     be excluded.
//   - `cover_glass_aluminosilicate_chain` is a material used only by
//     the iPhone test data, never by the parcel-sorting robot →
//     MUST be excluded.
test("focusId=focal product: includes 90-node subtree; iPhone product + iPhone-only material excluded", () => {
  const graph = loadGraphData();
  const adj = buildRequiresAdjacency(graph);
  const expectedSubtree = requiresDescendants(FOCAL_PRODUCT_ID, adj);

  const subset = focusedSubset(FOCAL_PRODUCT_ID, graph);

  // Size is pinned: oracle === function-under-test === 90.
  assert.equal(
    expectedSubtree.size,
    90,
    `oracle: focal subtree should be 90; got ${expectedSubtree.size}. ` +
      "If this fails, data changed — adjust the assertion and re-pin the spec.",
  );
  assert.equal(
    subset.nodes.size,
    90,
    `focusedSubset must include exactly the 90 requires-descendants of focal; got ${subset.nodes.size}`,
  );

  // The focal product itself must be in (focus + descendants).
  assert.ok(
    subset.nodes.has(FOCAL_PRODUCT_ID),
    "focal product itself must be in nodes when it is the focus",
  );

  // A direct first-layer subsystem must be in.
  assert.ok(
    subset.nodes.has("parcel_manipulation_or_diverter"),
    "parcel_manipulation_or_diverter (direct child) must be in nodes",
  );

  // The iPhone test product is a sibling root — MUST be excluded.
  assert.ok(
    !subset.nodes.has("iphone_4"),
    "iphone_4 (unrelated sibling product) must NOT be in nodes",
  );

  // A material used only by the iPhone case study — MUST be excluded.
  assert.ok(
    !subset.nodes.has("cover_glass_aluminosilicate_chain"),
    "cover_glass_aluminosilicate_chain (iPhone-only material) must NOT be in nodes",
  );
});

// ------------------------------------------------------------------
// Test 3: focusId = a first-layer subsystem
// ------------------------------------------------------------------
//
// Focusing one first-layer subsystem keeps THAT subsystem + its
// downward `requires`-descendants bright. Other first-layer subsystems
// (siblings under the focal product) and their subtrees grey out.
//
// `parcel_manipulation_or_diverter` is chosen because the slice brief
// names it explicitly and because its known descendants
// (`industrial_robot_arm_body`, `motion_planning`,
// `end_effector_gripper_or_suction`) are shared modules that ALSO
// hang directly off the focal product — a tricky case. Per the
// `requires`-descendants rule, they ARE in this focus subset
// (reachable from pmod via `requires`), even though they have an
// additional parent (focal product).
//
// `conveyor_integration` is a *sibling* first-layer subsystem (NOT a
// child of pmod) → MUST be excluded.
test("focusId=parcel_manipulation_or_diverter: descendants in, sibling-subsystem out", () => {
  const graph = loadGraphData();
  const subset = focusedSubset("parcel_manipulation_or_diverter", graph);

  // focus + own subtree
  assert.ok(
    subset.nodes.has("parcel_manipulation_or_diverter"),
    "the focused subsystem itself must be in nodes",
  );
  assert.ok(
    subset.nodes.has("industrial_robot_arm_body"),
    "industrial_robot_arm_body (descendant of pmod via requires) must be in nodes",
  );
  assert.ok(
    subset.nodes.has("motion_planning"),
    "motion_planning (descendant of pmod via requires) must be in nodes",
  );
  assert.ok(
    subset.nodes.has("end_effector_gripper_or_suction"),
    "end_effector_gripper_or_suction (descendant of pmod via requires) must be in nodes",
  );

  // Ancestor: focal product is NOT a descendant of pmod → excluded.
  assert.ok(
    !subset.nodes.has(FOCAL_PRODUCT_ID),
    "focal product (ANCESTOR of pmod, not descendant) must NOT be in nodes",
  );

  // Sibling first-layer subsystem: `conveyor_integration` is a child of
  // focal but NOT a child of pmod → excluded.
  assert.ok(
    !subset.nodes.has("conveyor_integration"),
    "conveyor_integration (sibling first-layer subsystem, not in pmod subtree) must NOT be in nodes",
  );
});

// ------------------------------------------------------------------
// Test 4: focusId = a leaf module
// ------------------------------------------------------------------
//
// A leaf module has zero `requires` outgoing edges. The focus
// subset must be exactly { leafId } — no descendants, no edges.
//
// Data probe pick: `machine_vision_lens_and_optics`. Confirmed at
// HEAD b7de552 to have zero outgoing `requires` edges.
test("focusId=leaf module (no requires children): nodes = {self}, edges = empty", () => {
  const graph = loadGraphData();
  const LEAF_ID = "machine_vision_lens_and_optics";

  // Sanity: assert via the oracle that this really is a leaf in the
  // current dataset. If it stops being a leaf, the test is wrong, not
  // the implementation.
  const adj = buildRequiresAdjacency(graph);
  const children = adj.get(LEAF_ID) ?? [];
  assert.equal(
    children.length,
    0,
    `oracle: ${LEAF_ID} should have zero requires children; got ${children.length}. ` +
      "Pick a different leaf module in this test if data changed.",
  );

  const subset = focusedSubset(LEAF_ID, graph);

  assert.equal(subset.nodes.size, 1, "leaf focus should produce exactly one bright node");
  assert.ok(subset.nodes.has(LEAF_ID), "the leaf itself must be in nodes");

  assert.equal(
    subset.edges.size,
    0,
    `leaf has no descendants, so no edge has BOTH endpoints in nodes; ` +
      `got ${subset.edges.size} edges`,
  );
});

// ------------------------------------------------------------------
// Test 5: focusId = unknown id
// ------------------------------------------------------------------
//
// If the focus id isn't in the graph, the function returns EMPTY
// sets — not the all-saturated fallback. Per the slice brief:
// "forces GREEN UI to default to 'everything desaturated' which
// surfaces the bug" rather than papering over it.
test("focusId=<unknown id>: nodes and edges are both empty", () => {
  const graph = loadGraphData();
  const subset = focusedSubset("definitely_not_a_real_node_id_xyz", graph);

  assert.equal(subset.nodes.size, 0, "unknown id must yield empty nodes set");
  assert.equal(subset.edges.size, 0, "unknown id must yield empty edges set");
});

// ------------------------------------------------------------------
// Test 6: edge membership rule (both endpoints in subset)
// ------------------------------------------------------------------
//
// An edge is in `edges` iff BOTH endpoints are in `nodes`. Two
// concrete edges from the real data, both relative to focus =
// `parcel_manipulation_or_diverter`:
//
//   A. `e_manipulation_requires_robot_arm_body`
//      pmod → industrial_robot_arm_body, both IN → edge IS in subset.
//
//   B. `e_product_requires_manipulation`
//      focal → pmod. Source (focal product) is the ANCESTOR of pmod
//      and is therefore NOT in the focused subtree (the subtree only
//      walks downward via `requires`). Target IS in. One-out, one-in
//      → edge is NOT in subset.
test("edges: both-endpoints-in rule (parent→focus excluded; focus→child included)", () => {
  const graph = loadGraphData();
  const subset = focusedSubset("parcel_manipulation_or_diverter", graph);

  const edgePmodToArmBody = "e_manipulation_requires_robot_arm_body";
  const edgeFocalToPmod = "e_product_requires_manipulation";

  // Sanity-check the edges exist in the dataset.
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  assert.ok(
    edgeIds.has(edgePmodToArmBody),
    `oracle: dataset must contain edge id ${edgePmodToArmBody}`,
  );
  assert.ok(
    edgeIds.has(edgeFocalToPmod),
    `oracle: dataset must contain edge id ${edgeFocalToPmod}`,
  );

  // Both endpoints in focused subtree → edge in subset.
  assert.ok(
    subset.edges.has(edgePmodToArmBody),
    `${edgePmodToArmBody} has both endpoints (pmod, arm_body) in the focused subtree; ` +
      "it must be in edges",
  );

  // Ancestor → focused: source (focal product) is NOT in the subtree,
  // so even though the target (pmod) is, the edge must be excluded.
  assert.ok(
    !subset.edges.has(edgeFocalToPmod),
    `${edgeFocalToPmod} has its SOURCE (focal product) outside the focused subtree; ` +
      "it must NOT be in edges (one-endpoint-out rule)",
  );
});

// ------------------------------------------------------------------
// Test 7: determinism
// ------------------------------------------------------------------
//
// Same input → identical output. Sets don't have a meaningful equals
// out of the box, so we sort `Array.from(set)` and compare strings.
// This guards against accidental non-determinism (e.g., relying on
// Map iteration order coming out of a non-deterministic graph
// traversal). Running twice on the same graph must produce the same
// sorted sets exactly.
test("determinism: same input produces bit-identical sorted sets across runs", () => {
  const graph = loadGraphData();

  const focii: Array<string | null> = [
    null,
    FOCAL_PRODUCT_ID,
    "parcel_manipulation_or_diverter",
    "machine_vision_lens_and_optics",
    "definitely_not_a_real_node_id_xyz",
  ];

  for (const focusId of focii) {
    const a = focusedSubset(focusId, graph);
    const b = focusedSubset(focusId, graph);

    const aNodes = [...a.nodes].sort();
    const bNodes = [...b.nodes].sort();
    assert.deepEqual(
      aNodes,
      bNodes,
      `non-deterministic nodes set for focusId=${String(focusId)}`,
    );

    const aEdges = [...a.edges].sort();
    const bEdges = [...b.edges].sort();
    assert.deepEqual(
      aEdges,
      bEdges,
      `non-deterministic edges set for focusId=${String(focusId)}`,
    );
  }
});

// ------------------------------------------------------------------
// Test 8: shared module — descendant-of-focus rule
// ------------------------------------------------------------------
//
// `industrial_area_scan_camera` is a shared module with TWO parents
// in the real data: `vision_barcode_label_recognition` and
// `parcel_detection_and_tracking`. The greyscale rule from ADR-0006
// is purely downward: "X and all of X's descendants" — so whether
// scan-camera is "in" depends on whether it's reachable from the
// focus via `requires`, NOT on whether any of its parents happens
// to be focused indirectly through a sibling subtree.
//
// Focus = `parcel_detection_and_tracking` (one of scan-camera's
// parents): scan-camera IS a descendant via `requires` → MUST be
// in `nodes`.
//
// Focus = `parcel_manipulation_or_diverter` (NOT a parent of
// scan-camera, and scan-camera is not in pmod's `requires`-subtree):
// scan-camera MUST NOT be in `nodes`. This pins the rule that the
// subset is computed from the focus's OWN forward `requires` reach,
// not from the union of any related subsystem's reach.
test("shared module: included only if reachable via requires from focus, regardless of other parents", () => {
  const graph = loadGraphData();
  const SHARED_ID = "industrial_area_scan_camera";

  // Case A: focus IS a `requires` parent of the shared module.
  const subsetA = focusedSubset("parcel_detection_and_tracking", graph);
  assert.ok(
    subsetA.nodes.has(SHARED_ID),
    `${SHARED_ID} IS a requires-descendant of parcel_detection_and_tracking; ` +
      "it must be in nodes when that parent is focused",
  );

  // Case B: focus is a DIFFERENT first-layer subsystem that does NOT
  // reach the shared module via `requires`.
  const subsetB = focusedSubset("parcel_manipulation_or_diverter", graph);
  assert.ok(
    !subsetB.nodes.has(SHARED_ID),
    `${SHARED_ID} is NOT a requires-descendant of parcel_manipulation_or_diverter; ` +
      "it must NOT be in nodes when that unrelated parent is focused, " +
      "even though it has another parent that happens to be a sibling first-layer subsystem",
  );
});
