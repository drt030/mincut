import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";
import {
  implementedNodesForOrganization,
  implementersForNode,
  manufacturersForNode,
  suppliedNodesForOrganization,
} from "../src/lib/graphTraversal";

const graph = loadGraphData();

test("manufacturersForNode returns organization targets for manufactured_by edges only", () => {
  const manufacturers = manufacturersForNode(graph, "precision_reducer_gearbox");
  const ids = manufacturers.map((node) => node.id);

  assert.ok(ids.includes("org_nabtesco"), "precision reducer must expose Nabtesco as a manufacturer candidate");
  assert.ok(ids.includes("org_harmonic_drive_systems"), "precision reducer must expose Harmonic Drive Systems");
  assert.ok(
    manufacturers.every((node) => node.kind === "organization"),
    `manufacturer list must contain only organization nodes; saw ${manufacturers.map((node) => `${node.id}:${node.kind}`).join(", ")}`,
  );
});

test("bottleneck entry nodes expose manufacturer candidates without requiring deep drilldown", () => {
  const detectionManufacturers = manufacturersForNode(graph, "parcel_detection_and_tracking").map((node) => node.id);
  const recognitionManufacturers = manufacturersForNode(graph, "vision_barcode_label_recognition").map((node) => node.id);

  assert.ok(
    detectionManufacturers.includes("org_hikrobot"),
    "parcel detection bottleneck must expose Hikrobot as a machine-vision supplier candidate",
  );
  assert.ok(
    detectionManufacturers.includes("org_keyence"),
    "parcel detection bottleneck must expose KEYENCE as a machine-vision supplier candidate",
  );
  assert.ok(
    recognitionManufacturers.includes("org_cognex"),
    "vision/barcode recognition entry node must expose Cognex as a barcode/vision supplier candidate",
  );
});

test("servo motor component exposes servo-system manufacturer candidates", () => {
  const manufacturers = manufacturersForNode(graph, "industrial_servo_motor").map((node) => node.id);

  assert.ok(
    manufacturers.includes("org_inovance"),
    "industrial servo motor must expose Inovance as a servo-system supplier candidate",
  );
  assert.ok(
    manufacturers.includes("org_yaskawa"),
    "industrial servo motor must expose Yaskawa as a servo-system supplier candidate",
  );
  assert.ok(
    manufacturers.includes("org_mitsubishi_electric"),
    "industrial servo motor must expose Mitsubishi Electric as a servo-system supplier candidate",
  );
});

test("robot controller and I/O exposes PLC and motion-control supplier candidates", () => {
  const manufacturers = manufacturersForNode(graph, "robot_controller_io").map((node) => node.id);

  for (const id of [
    "org_siemens",
    "org_inovance",
    "org_mitsubishi_electric",
    "org_rockwell_automation",
    "org_schneider_electric",
  ]) {
    assert.ok(
      manufacturers.includes(id),
      `robot_controller_io must expose ${id} as a controller/I-O supplier candidate`,
    );
  }
});

test("maintenance workflow exposes service and implementation candidates", () => {
  const implementers = implementersForNode(graph, "maintenance_workflow").map((node) => node.id);

  assert.ok(
    implementers.includes("org_abb_robotics"),
    "maintenance workflow must expose ABB Robotics as a robot-service implementation candidate",
  );
  assert.ok(
    implementers.includes("org_fanuc"),
    "maintenance workflow must expose FANUC as a robot-maintenance implementation candidate",
  );
});

test("suppliedNodesForOrganization returns component sources for organization nodes", () => {
  const supplied = suppliedNodesForOrganization(graph, "org_nabtesco");
  const ids = supplied.map((node) => node.id);

  assert.ok(ids.includes("precision_reducer_gearbox"), "Nabtesco must link back to the reducer component it supplies");
  assert.ok(
    supplied.every((node) => node.kind !== "organization"),
    `supplier exposure should list supplied graph nodes, not peer organizations; saw ${supplied.map((node) => `${node.id}:${node.kind}`).join(", ")}`,
  );
});

test("implementedNodesForOrganization returns service or workflow sources for organization nodes", () => {
  const implemented = implementedNodesForOrganization(graph, "org_abb_robotics");
  const ids = implemented.map((node) => node.id);

  assert.ok(
    ids.includes("maintenance_workflow"),
    "ABB Robotics organization detail must link back to the maintenance workflow it can implement",
  );
  assert.ok(
    implemented.every((node) => node.kind !== "organization"),
    `implementation exposure should list graph nodes, not peer organizations; saw ${implemented.map((node) => `${node.id}:${node.kind}`).join(", ")}`,
  );
});
