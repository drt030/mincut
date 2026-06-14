import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCanvasGraph,
  resolveCanvasRootId,
  isKnowHowNode,
  isArtifactCanvasNode,
  isCanvasTreeEdge,
} from "../src/lib/canvasGraph";
import { loadGraphData } from "../src/lib/graphLoader";
import { V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import type { Edge, GraphData, Node } from "../src/lib/schema";

function chainNode(id: string, kind: Node["kind"] = "module"): Node {
  return {
    id,
    name: id,
    kind,
    domain: ["test"],
  };
}

function chainEdge(source: string, target: string): Edge {
  return {
    id: `e_${source}_${target}`,
    source,
    target,
    relation: "requires",
  };
}

test("canvas graph excludes operational workflow nodes from the structural canvas", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.ok(
    graph.nodes.some((node) => node.id === "maintenance_workflow"),
    "fixture must include the semantic-noise maintenance workflow node",
  );
  assert.equal(ids.has("maintenance_workflow"), false);
  assert.equal(
    canvas.edges.some((edge) => edge.source === "low_cost_parcel_sorting_robot_300k_rmb" && edge.target === "maintenance_workflow"),
    false,
  );
});

test("canvas graph hides generic material and raw supply-chain nodes by default", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.equal(ids.has("semiconductor_grade_silicon_and_electronics"), false);
  assert.equal(ids.has("alloy_steel_precision_material"), false);
  assert.equal(ids.has("iron_ore_steelmaking_chain"), false);
  assert.equal(ids.has("quartz_silica_silicon_chain"), false);
});

test("canvas graph keeps concrete decomposition nodes such as controlled vision lighting", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.equal(ids.has("low_cost_parcel_sorting_robot_300k_rmb"), true);
  assert.equal(ids.has("vision_barcode_label_recognition"), true);
  assert.equal(ids.has("controlled_machine_vision_lighting"), true);
  assert.equal(
    canvas.edges.some((edge) => edge.source === "vision_barcode_label_recognition" && edge.target === "controlled_machine_vision_lighting"),
    true,
  );
});

test("canvas graph reduces multi-parent pseudo-shared requires targets", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const incomingRequires = new Map<string, number>();
  for (const edge of canvas.edges) {
    if (edge.relation !== "requires") continue;
    incomingRequires.set(edge.target, (incomingRequires.get(edge.target) ?? 0) + 1);
  }

  assert.equal(incomingRequires.get("semiconductor_grade_silicon_and_electronics"), undefined);
  assert.ok(
    (incomingRequires.get("plc_and_wcs_integration") ?? 0) >= 2,
    "real shared integration modules may remain shared on canvas",
  );
});

test("canvas graph keeps robot execution children under the manipulation subsystem, not duplicated as product sectors", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const root = "low_cost_parcel_sorting_robot_300k_rmb";
  const execution = "parcel_manipulation_or_diverter";
  const executionChildren = new Set([
    "industrial_robot_arm_body",
    "end_effector_gripper_or_suction",
    "motion_planning",
  ]);

  for (const child of executionChildren) {
    assert.equal(
      canvas.edges.some((edge) => edge.relation === "requires" && edge.source === root && edge.target === child),
      false,
      `${child} should not be a duplicated first-layer product dependency`,
    );
    assert.equal(
      canvas.edges.some((edge) => edge.relation === "requires" && edge.source === execution && edge.target === child),
      true,
      `${child} should remain a child of the parcel execution subsystem`,
    );
  }
});

test("canvas graph can be re-rooted on a subsystem for deeper study", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph, "industrial_robot_arm_body");
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.equal(ids.has("industrial_robot_arm_body"), true);
  assert.equal(ids.has("industrial_servo_motor"), true);
  assert.equal(ids.has("robot_controller_io"), true);
  assert.equal(ids.has("low_cost_parcel_sorting_robot_300k_rmb"), false);
  assert.equal(ids.has("parcel_induction_spacing"), false);
  assert.equal(
    canvas.edges.some((edge) =>
      edge.relation === "requires" &&
      edge.source === "industrial_robot_arm_body" &&
      edge.target === "industrial_servo_motor",
    ),
    true,
  );
});

test("re-rooting on the robot arm exposes controller I/O child decomposition", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph, "industrial_robot_arm_body");
  const ids = new Set(canvas.nodes.map((node) => node.id));

  for (const id of [
    "robot_controller_io",
    "robot_controller_cpu_module",
    "robot_realtime_control_runtime",
    "robot_fieldbus_gateway",
    "robot_safety_io_interface",
    "robot_external_io_sensor_interface",
    "robot_controller_diagnostics_interface",
  ]) {
    assert.equal(ids.has(id), true, `${id} should be visible under the robot-arm research root`);
  }
  assert.equal(
    canvas.edges.some((edge) =>
      edge.relation === "requires" &&
      edge.source === "robot_controller_io" &&
      edge.target === "robot_controller_cpu_module",
    ),
    true,
    "robot_controller_io should keep its lower-layer requires edges after re-rooting",
  );
});

test("canvas graph depth window is relative to the active research root", () => {
  const graph: GraphData = {
    graphVersion: "canvas-depth-window",
    evidence: [],
    nodes: [
      chainNode("P", "product"),
      chainNode("A"),
      chainNode("B"),
      chainNode("C"),
      chainNode("D"),
      chainNode("E"),
    ],
    edges: [
      chainEdge("P", "A"),
      chainEdge("A", "B"),
      chainEdge("B", "C"),
      chainEdge("C", "D"),
      chainEdge("D", "E"),
    ],
  };

  const fromProduct = new Set(filterCanvasGraph(graph, "P").nodes.map((node) => node.id));
  assert.deepEqual(
    [...fromProduct].sort(),
    ["A", "B", "C", "D", "P"],
    "default product view should show root + four dependency edges, hiding the fifth edge until reroot",
  );

  const fromChild = new Set(filterCanvasGraph(graph, "A").nodes.map((node) => node.id));
  assert.deepEqual(
    [...fromChild].sort(),
    ["A", "B", "C", "D", "E"],
    "rerooting on a child should open the same four-edge window relative to that child",
  );
});

test("resolveCanvasRootId prefers the active v0 target over file-order-earlier products", () => {
  const graph: GraphData = {
    graphVersion: "test",
    nodes: [
      chainNode("aaa_alphabetically_first_product", "product"),
      chainNode(V0_TARGET_NODE_ID, "product"),
    ],
    edges: [],
    evidence: [],
  };
  assert.equal(
    resolveCanvasRootId(graph),
    V0_TARGET_NODE_ID,
    "default canvas root must not depend on data-file sort order while the v0 target is present",
  );
});

test("resolveCanvasRootId falls back to the first product when the v0 target is absent", () => {
  const graph: GraphData = {
    graphVersion: "test",
    nodes: [chainNode("some_product", "product")],
    edges: [],
    evidence: [],
  };
  assert.equal(resolveCanvasRootId(graph), "some_product");
});

test("isKnowHowNode / isArtifactCanvasNode partition the canvas kinds", () => {
  const kh = { id: "k", name: "k", kind: "engineering_method", domain: ["t"], maturityLabel: "mature" } as never;
  const mod = { id: "m", name: "m", kind: "module", domain: ["t"], maturityLabel: "mature" } as never;
  assert.equal(isKnowHowNode(kh), true);
  assert.equal(isKnowHowNode(mod), false);
  assert.equal(isArtifactCanvasNode(mod), true);
  assert.equal(isArtifactCanvasNode(kh), false);
});

test("artifact canvas nodes are not structurally parented only by know-how nodes", () => {
  const graph = loadGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingTreeParents = new Map<string, Node[]>();

  for (const edge of graph.edges) {
    if (edge.reviewStatus === "deprecated") continue;
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    if (!isArtifactCanvasNode(target)) continue;
    const list = incomingTreeParents.get(target.id) ?? [];
    list.push(source);
    incomingTreeParents.set(target.id, list);
  }

  const offenders = [...incomingTreeParents.entries()]
    .filter(([, parents]) => parents.length > 0 && parents.every(isKnowHowNode))
    .map(([targetId, parents]) => `${targetId} <- ${parents.map((parent) => parent.id).join(", ")}`)
    .sort();

  assert.deepEqual(
    offenders,
    [],
    "product-layer artifact nodes must have at least one product/artifact structural parent; know-how nodes are overlays, not product-tree parents",
  );
});

test("filterCanvasGraph attaches implemented_by-only know-how nodes to the union graph", () => {
  const graph = {
    nodes: [
      { id: "root", name: "root", kind: "product", domain: ["t"], maturityLabel: "lab_prototype" },
      { id: "mod", name: "mod", kind: "module", domain: ["t"], maturityLabel: "mature" },
      { id: "kh_impl", name: "kh", kind: "engineering_method", domain: ["t"], maturityLabel: "lab_prototype" },
    ],
    edges: [
      { id: "e1", source: "root", target: "mod", relation: "requires" },
      { id: "e2", source: "mod", target: "kh_impl", relation: "implemented_by" },
    ],
    evidence: [],
  } as never;
  const filtered = filterCanvasGraph(graph, "root");
  assert.ok(filtered.nodes.some((n) => n.id === "kh_impl"), "implemented_by know-how node attached");
  assert.ok(filtered.edges.some((e) => e.id === "e2"), "attachment edge included");
});

test("filterCanvasGraph does NOT attach implemented_by organizations", () => {
  const graph = {
    nodes: [
      { id: "root", name: "root", kind: "product", domain: ["t"], maturityLabel: "lab_prototype" },
      { id: "mod", name: "mod", kind: "module", domain: ["t"], maturityLabel: "mature" },
      { id: "org", name: "org", kind: "organization", domain: ["t"], maturityLabel: "mature" },
    ],
    edges: [
      { id: "e1", source: "root", target: "mod", relation: "requires" },
      { id: "e2", source: "mod", target: "org", relation: "implemented_by" },
    ],
    evidence: [],
  } as never;
  const filtered = filterCanvasGraph(graph, "root");
  assert.equal(filtered.nodes.some((n) => n.id === "org"), false);
});
