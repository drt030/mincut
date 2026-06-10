import test from "node:test";
import assert from "node:assert/strict";
import { subsystemHue } from "../src/lib/subsystemHue";
import type { GraphData } from "../src/lib/schema";
import { loadGraphData } from "../src/lib/graphLoader";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { defaultFocalProduct } from "../src/lib/graphTraversal";

/**
 * RED tests for Slice A3 (spec:
 * docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
 * ADR-0006 §Color).
 *
 * `subsystemHue` is a NEW pure deterministic function mapping a node id to
 * an HSL colour result that encodes which first-layer subsystem family the
 * node belongs to. The function does not yet exist — the import at the top
 * of this file fails today; the GREEN commit adds
 * `src/lib/subsystemHue.ts` with the implementation alongside the chrome
 * cleanup in `GraphExplorer.tsx`.
 *
 * Contract (ADR-0006 §Color):
 *   1. Each first-layer subsystem (a `requires`-child of the focal product)
 *      owns one distinct hue family. The number of families N is the count
 *      of first-layer subsystems in the current data (14 in the migrated
 *      parcel-sorting graph — the function must compute N from the data,
 *      not hard-code 12).
 *   2. A `requires`-descendant of a first-layer subsystem inherits that
 *      subsystem's hue family.
 *   3. Materials (`kind === "material"`) are neutral grey (saturation 0).
 *   4. Shared structural nodes — those with ≥ 2 incoming `requires` parents
 *      inside the focal subtree, excluding the first-layer subsystems
 *      themselves — are neutral grey (their primary-parent assignment is
 *      arbitrary per the spec; we do not pretend they have a real family).
 *   5. The focal product itself is a dedicated neutral root colour,
 *      near-white rather than mid-grey.
 *   6. A structural node not reachable from the focal product (sibling
 *      product subtrees, orphans) is also neutral grey.
 *   7. Deterministic and pure: same input → same output bit-for-bit.
 *
 * Function shape locked here:
 *   subsystemHue(nodeId: string, graph: GraphData): {
 *     hue: number,        // degrees in [0, 360); 0 for grey
 *     saturation: number, // 0..1; 0 means neutral grey
 *     lightness: number,  // 0..1; mid value (e.g. 0.5) by default
 *   }
 *
 * The "is neutral grey" predicate used by every test below is
 * `result.saturation === 0`. The hue value of a grey result is not
 * pinned — implementations may return hue: 0 or any other value — only
 * the saturation matters for the grey case.
 *
 * The "different family" predicate uses `result.hue` directly. Two
 * first-layer subsystems must return strictly different hues, separated
 * by at least the minimum step `360 / N - 1` degrees (so we cannot pass
 * test 2 by accident if two families collapse to the same hue).
 */

const TWO_PI = Math.PI * 2;

/**
 * Reach the focal subtree by BFS from the first product node via
 * `requires` edges, exactly mirroring the algorithm that `subsystemHue`
 * implements internally (per ADR-0006 §Layout). Used by tests 4 and 5 to
 * pick a "shared module" inside the focal subtree from real data.
 */
function buildFocalSubtree(graph: GraphData): {
  focalId: string;
  firstLayer: string[];
  subtree: Set<string>;
  inCountFromSubtree: Map<string, number>;
} {
  const focal = defaultFocalProduct(graph);
  assert.ok(focal, "fixture must contain at least one product node");
  const childrenByParent = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.relation !== "requires") continue;
    if (!childrenByParent.has(e.source)) childrenByParent.set(e.source, []);
    childrenByParent.get(e.source)!.push(e.target);
  }
  const firstLayer = [...(childrenByParent.get(focal!.id) ?? [])];
  const subtree = new Set<string>();
  const queue: string[] = [focal!.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (subtree.has(cur)) continue;
    subtree.add(cur);
    for (const c of childrenByParent.get(cur) ?? []) queue.push(c);
  }
  const inCountFromSubtree = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.relation !== "requires") continue;
    if (!subtree.has(e.source) || !subtree.has(e.target)) continue;
    inCountFromSubtree.set(e.target, (inCountFromSubtree.get(e.target) ?? 0) + 1);
  }
  return { focalId: focal!.id, firstLayer, subtree, inCountFromSubtree };
}

/**
 * Property 1: a first-layer subsystem and any of its `requires`-
 * descendants (that are NOT themselves shared modules — those are grey,
 * see property 5) must return identical `{ hue, saturation, lightness }`.
 *
 * The migrated parcel-sorting data places `machine_vision_lens_and_optics`,
 * `controlled_machine_vision_lighting`, and `vision_processing_compute`
 * as single-parent module descendants of `vision_barcode_label_recognition`
 * (a first-layer subsystem). Two of these three are picked here. They
 * must share the parent subsystem's hue family triple bit-for-bit.
 */
test("subsystemHue P1: descendants of the same first-layer subsystem share the parent's hue family", () => {
  const graph = loadGraphData();
  const parent = "vision_barcode_label_recognition";
  const descA = "machine_vision_lens_and_optics";
  const descB = "controlled_machine_vision_lighting";

  const parentHue = subsystemHue(parent, graph);
  const a = subsystemHue(descA, graph);
  const b = subsystemHue(descB, graph);

  assert.deepEqual(
    a,
    parentHue,
    `${descA} must inherit ${parent}'s hue family; got ${JSON.stringify(a)} vs ${JSON.stringify(parentHue)}`,
  );
  assert.deepEqual(
    b,
    parentHue,
    `${descB} must inherit ${parent}'s hue family; got ${JSON.stringify(b)} vs ${JSON.stringify(parentHue)}`,
  );
  // A descendant of a coloured subsystem is NOT grey.
  assert.ok(
    a.saturation > 0,
    `${descA} must be coloured (saturation > 0); got saturation=${a.saturation}`,
  );
});

/**
 * Property 2: two first-layer subsystems return different hue values,
 * separated by at least one canonical step (`360 / N - 1` degrees) so
 * the difference is the result of distinct family assignment, not of
 * rounding noise.
 */
test("subsystemHue P2: two distinct first-layer subsystems have hue separation >= 360/N - 1 degrees", () => {
  const graph = loadGraphData();
  const { firstLayer } = buildFocalSubtree(graph);
  const N = firstLayer.length;
  assert.ok(N >= 2, `need ≥ 2 first-layer subsystems to compare; got ${N}`);

  // Pick the first two first-layer subsystems in graph-edge order (this
  // is deterministic across runs because graph edges are loaded in
  // sorted-file-name order).
  const aHue = subsystemHue(firstLayer[0], graph);
  const bHue = subsystemHue(firstLayer[1], graph);

  // Both must be coloured (saturation > 0), not grey.
  assert.ok(aHue.saturation > 0, `first subsystem ${firstLayer[0]} must be coloured`);
  assert.ok(bHue.saturation > 0, `second subsystem ${firstLayer[1]} must be coloured`);

  // Compute the smallest absolute hue difference on the colour wheel
  // (hue is circular: 359° and 1° are 2° apart, not 358°).
  const rawDiff = Math.abs(aHue.hue - bHue.hue);
  const circDiff = Math.min(rawDiff, 360 - rawDiff);
  const minStep = 360 / N - 1;
  assert.ok(
    circDiff >= minStep,
    `first-layer subsystems ${firstLayer[0]} (hue=${aHue.hue}) and ${firstLayer[1]} (hue=${bHue.hue}) must be at least ${minStep}° apart on the colour wheel; got ${circDiff}°`,
  );
});

/**
 * Property 3: all N first-layer subsystems get N pairwise-distinct hues
 * — `new Set(hues).size === N`. We rebucket to integer degrees first so
 * a sub-degree implementation noise never collapses the set.
 */
test("subsystemHue P3: all N first-layer subsystems have N pairwise-distinct hues", () => {
  const graph = loadGraphData();
  const { firstLayer } = buildFocalSubtree(graph);
  const N = firstLayer.length;
  const hues = firstLayer.map((id) => {
    const result = subsystemHue(id, graph);
    assert.ok(
      result.saturation > 0,
      `first-layer subsystem ${id} must be coloured (saturation > 0); got ${result.saturation}`,
    );
    // Bucket to integer degrees so tiny floating-point noise doesn't
    // produce N+1 distinct entries when the implementation really
    // produced N evenly-spaced families.
    return Math.round(result.hue);
  });
  assert.equal(
    new Set(hues).size,
    N,
    `expected ${N} pairwise-distinct first-layer hues; got hues=${JSON.stringify(hues)}`,
  );
});

/**
 * Property 4: a material node (`kind === "material"`) is neutral grey
 * regardless of which subsystems consume it.
 */
test("subsystemHue P4: materials are neutral grey", () => {
  const graph = loadGraphData();
  const material = graph.nodes.find((n) => n.kind === "material");
  assert.ok(material, "fixture must contain at least one material node");
  const result = subsystemHue(material!.id, graph);
  assert.equal(
    result.saturation,
    0,
    `material ${material!.id} must be neutral grey (saturation=0); got ${JSON.stringify(result)}`,
  );
});

/**
 * Property 5: a shared structural node — one with ≥ 2 incoming `requires`
 * parents inside the focal subtree, excluding the first-layer subsystems
 * themselves — is neutral grey. Its primary-parent assignment is
 * arbitrary per ADR-0006 §Layout, so we do not paint it with a hue
 * family.
 *
 * In the real parcel-sorting data, `industrial_area_scan_camera` is a
 * non-first-layer module with two `requires` parents inside the focal
 * subtree (confirmed during spec drafting). Pinning the assertion to
 * that id keeps the test deterministic against the migrated fixture.
 */
test("subsystemHue P5: shared structural nodes with >= 2 requires parents are neutral grey", () => {
  const graph = loadGraphData();
  const { firstLayer, inCountFromSubtree, focalId } = buildFocalSubtree(graph);
  const sharedId = "industrial_area_scan_camera";

  // Self-check the assumption against the live data so the test fails
  // loudly if the fixture ever changes shape (rather than passing
  // vacuously against a wrong premise).
  assert.ok(
    !firstLayer.includes(sharedId),
    `${sharedId} must NOT be a first-layer subsystem for this test to be meaningful`,
  );
  assert.notEqual(sharedId, focalId, `${sharedId} must not be the focal product`);
  assert.ok(
    (inCountFromSubtree.get(sharedId) ?? 0) >= 2,
    `${sharedId} must have ≥ 2 incoming requires parents inside the focal subtree; got ${inCountFromSubtree.get(sharedId) ?? 0}`,
  );

  const result = subsystemHue(sharedId, graph);
  assert.equal(
    result.saturation,
    0,
    `shared structural node ${sharedId} must be neutral grey (saturation=0); got ${JSON.stringify(result)}`,
  );
});

/**
 * Property 6: the focal product itself is a dedicated neutral root
 * colour. It remains saturation=0 so it does not collide with subsystem
 * hues, but it must be near-white rather than mid-grey; grey reads like
 * "not selected" in the graph UI.
 */
test("subsystemHue P6: focal product is a near-white neutral root colour", () => {
  const graph = loadGraphData();
  const { focalId } = buildFocalSubtree(graph);
  const result = subsystemHue(focalId, graph);
  assert.equal(
    result.saturation,
    0,
    `focal product ${focalId} must stay neutral (saturation=0); got ${JSON.stringify(result)}`,
  );
  assert.ok(
    result.lightness >= 0.94,
    `focal product ${focalId} must be near-white, not mid-grey; got ${JSON.stringify(result)}`,
  );
});

/**
 * Property 7: pure and deterministic — calling `subsystemHue` twice with
 * the same input returns identical output.
 */
test("subsystemHue P7: deterministic — same input yields same output", () => {
  const graph = loadGraphData();
  const id = "vision_barcode_label_recognition";
  const a = subsystemHue(id, graph);
  const b = subsystemHue(id, graph);
  assert.deepEqual(a, b, `subsystemHue must be pure / deterministic on repeat calls`);
  // Spot-check on a material too, since the grey-path code is a separate
  // branch in any reasonable implementation.
  const materialId = graph.nodes.find((n) => n.kind === "material")!.id;
  const ma = subsystemHue(materialId, graph);
  const mb = subsystemHue(materialId, graph);
  assert.deepEqual(ma, mb, `subsystemHue must be pure / deterministic on a material id too`);
  // Sanity: stop a hue value of NaN from sneaking through and silently
  // satisfying deep-equal (NaN !== NaN in floats, but assert.deepEqual
  // treats two NaNs as equal — so we check finiteness explicitly).
  assert.ok(Number.isFinite(a.hue), `hue must be a finite number; got ${a.hue}`);
  assert.ok(Number.isFinite(a.saturation), `saturation must be a finite number; got ${a.saturation}`);
  assert.ok(Number.isFinite(a.lightness), `lightness must be a finite number; got ${a.lightness}`);
});

/**
 * Property 8: a structural node not reachable from the focal product
 * (sibling product subtrees and other orphans) is neutral grey. We pin
 * this so the GREEN sub-agent implements one explicit rule for orphans
 * rather than accidentally inheriting some other family's hue via a
 * stray BFS path.
 *
 * The migrated graph data includes sibling product nodes (e.g.
 * test-fixture iPhone subtrees in `data/nodes/test_products.json`) whose
 * roots are NOT reachable from the focal parcel-sorting product. We pick
 * one such node dynamically (the first `kind: "product"` whose id is not
 * `focalId` — guaranteed by the loader because multiple products exist
 * in the fixture). If for any reason the fixture only contains the
 * focal product, the test is skipped via a fast assertion (which would
 * itself be a fixture regression worth surfacing).
 */
test("subsystemHue P8: structural node outside the focal subtree is neutral grey", () => {
  const graph = loadGraphData();
  const { focalId, subtree } = buildFocalSubtree(graph);
  const orphan = graph.nodes.find(
    (n) =>
      n.kind === "product" &&
      n.id !== focalId &&
      !subtree.has(n.id),
  );
  assert.ok(
    orphan,
    `fixture must contain at least one sibling product outside the focal subtree (focal=${focalId}); none found — orphan path cannot be tested. Update the fixture or the test.`,
  );
  const result = subsystemHue(orphan!.id, graph);
  assert.equal(
    result.saturation,
    0,
    `orphan structural node ${orphan!.id} must be neutral grey (saturation=0); got ${JSON.stringify(result)}`,
  );
});

test("subsystemHue reroots colour families around a module research root", () => {
  const graph = loadGraphData();
  const rootId = "industrial_robot_arm_body";
  const canvas = filterCanvasGraph(graph, rootId);

  const rootHue = subsystemHue(rootId, canvas, rootId);
  const controllerHue = subsystemHue("robot_controller_io", canvas, rootId);
  const controllerCpuHue = subsystemHue("robot_controller_cpu_module", canvas, rootId);
  const servoHue = subsystemHue("industrial_servo_motor", canvas, rootId);

  assert.equal(rootHue.saturation, 0, "the active module research root should stay neutral");
  assert.ok(rootHue.lightness >= 0.94, "the active module research root should use the near-white root colour");
  assert.ok(
    controllerHue.saturation > 0,
    "direct children of a module research root should receive coloured subsystem families",
  );
  assert.deepEqual(
    controllerCpuHue,
    controllerHue,
    "controller descendants should inherit the controller branch hue after rerooting",
  );
  assert.notEqual(
    Math.round(controllerHue.hue),
    Math.round(servoHue.hue),
    "different direct children under the rerooted module should not collapse to the same hue",
  );
});

// Reference to TWO_PI so eslint doesn't flag the import-style geometric
// constant as unused. Kept available because future expansions of this
// suite (e.g. asserting hue-wheel uniformity in radians) will likely
// reuse it; the constant is otherwise free.
void TWO_PI;
