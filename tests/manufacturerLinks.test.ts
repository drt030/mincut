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

test("barcode OCR reading software exposes logistics code-reader supplier candidates", () => {
  const manufacturers = manufacturersForNode(graph, "barcode_ocr_reading_software").map((node) => node.id);

  for (const id of [
    "org_cognex",
    "org_hikrobot",
    "org_datalogic",
    "org_zebra_technologies",
    "org_sick",
  ]) {
    assert.ok(
      manufacturers.includes(id),
      `barcode_ocr_reading_software must expose ${id} as a code-reader supplier candidate`,
    );
  }
});

test("industrial edge AI computer exposes compute supplier candidates", () => {
  const manufacturers = manufacturersForNode(graph, "industrial_edge_ai_computer").map((node) => node.id);

  for (const id of ["org_nvidia", "org_intel", "org_advantech", "org_adlink_technology"]) {
    assert.ok(
      manufacturers.includes(id),
      `industrial_edge_ai_computer must expose ${id} as an edge-AI compute supplier candidate`,
    );
  }
});

test("parcel induction and spacing control exposes sortation supplier candidates", () => {
  const manufacturers = manufacturersForNode(graph, "parcel_induction_spacing_control").map((node) => node.id);

  for (const id of [
    "org_wayzim",
    "org_interroll",
    "org_dematic_kion",
    "org_daifuku",
    "org_honeywell_intelligrated",
  ]) {
    assert.ok(
      manufacturers.includes(id),
      `parcel_induction_spacing_control must expose ${id} as an induction/sortation supplier candidate`,
    );
  }
});

test("servo drive child layer exposes investable supplier candidates", () => {
  const powerStageManufacturers = manufacturersForNode(graph, "servo_drive_power_stage").map((node) => node.id);
  for (const id of [
    "org_inovance",
    "org_siemens",
    "org_mitsubishi_electric",
    "org_infineon_technologies",
    "org_stmicroelectronics",
    "org_onsemi",
  ]) {
    assert.ok(
      powerStageManufacturers.includes(id),
      `servo_drive_power_stage must expose ${id} as a drive/power-semiconductor supplier candidate`,
    );
  }

  const currentSensorManufacturers = manufacturersForNode(graph, "servo_drive_current_sensing").map((node) => node.id);
  for (const id of ["org_lem", "org_texas_instruments", "org_allegro_microsystems"]) {
    assert.ok(
      currentSensorManufacturers.includes(id),
      `servo_drive_current_sensing must expose ${id} as a current-sensing supplier candidate`,
    );
  }

  const stoManufacturers = manufacturersForNode(graph, "servo_drive_safety_sto").map((node) => node.id);
  for (const id of ["org_mitsubishi_electric", "org_siemens", "org_yaskawa"]) {
    assert.ok(stoManufacturers.includes(id), `servo_drive_safety_sto must expose ${id} as a safety-drive supplier candidate`);
  }

  const motionLoopImplementers = implementersForNode(graph, "servo_drive_motion_control_loop").map((node) => node.id);
  const thermalEmcImplementers = implementersForNode(graph, "servo_drive_thermal_emc_design").map((node) => node.id);
  for (const id of ["org_inovance", "org_siemens", "org_mitsubishi_electric", "org_yaskawa"]) {
    assert.ok(motionLoopImplementers.includes(id), `servo_drive_motion_control_loop must expose ${id} as an implementer`);
    assert.ok(thermalEmcImplementers.includes(id), `servo_drive_thermal_emc_design must expose ${id} as an implementer`);
  }
});

test("strain-wave reducer component layer exposes investable supplier candidates", () => {
  for (const componentId of [
    "strain_wave_wave_generator",
    "strain_wave_flexspline",
    "strain_wave_circular_spline",
  ]) {
    const manufacturers = manufacturersForNode(graph, componentId).map((node) => node.id);
    for (const id of ["org_harmonic_drive_systems", "org_leaderdrive"]) {
      assert.ok(manufacturers.includes(id), `${componentId} must expose ${id} as a strain-wave reducer supplier candidate`);
    }
  }

  const bearingManufacturers = manufacturersForNode(graph, "reducer_output_cross_roller_bearing").map((node) => node.id);
  for (const id of ["org_thk", "org_nsk", "org_schaeffler"]) {
    assert.ok(
      bearingManufacturers.includes(id),
      `reducer_output_cross_roller_bearing must expose ${id} as a precision-bearing supplier candidate`,
    );
  }

  const alloySteelManufacturers = manufacturersForNode(graph, "alloy_steel_precision_material").map((node) => node.id);
  for (const id of ["org_citic_special_steel", "org_baosteel", "org_nippon_steel"]) {
    assert.ok(
      alloySteelManufacturers.includes(id),
      `alloy_steel_precision_material must expose ${id} as a special-steel supplier candidate`,
    );
  }
});

test("servo motor material and component layer exposes investable supplier candidates", () => {
  const electricalSteelManufacturers = manufacturersForNode(graph, "electrical_steel_lamination_material").map((node) => node.id);
  for (const id of ["org_baosteel", "org_nippon_steel", "org_posco"]) {
    assert.ok(
      electricalSteelManufacturers.includes(id),
      `electrical_steel_lamination_material must expose ${id} as an electrical-steel supplier candidate`,
    );
  }

  const magnetRotorManufacturers = manufacturersForNode(graph, "servo_motor_permanent_magnet_rotor").map((node) => node.id);
  const rareEarthMagnetManufacturers = manufacturersForNode(graph, "rare_earth_permanent_magnet_material").map((node) => node.id);
  for (const id of ["org_jlmag", "org_zhongke_sanhuan", "org_ningbo_yunsheng"]) {
    assert.ok(magnetRotorManufacturers.includes(id), `servo_motor_permanent_magnet_rotor must expose ${id} as a magnet supplier`);
    assert.ok(rareEarthMagnetManufacturers.includes(id), `rare_earth_permanent_magnet_material must expose ${id} as a magnet supplier`);
  }

  const ndprManufacturers = manufacturersForNode(graph, "ndpr_rare_earth_feedstock").map((node) => node.id);
  for (const id of ["org_china_northern_rare_earth", "org_mp_materials", "org_lynas_rare_earths"]) {
    assert.ok(ndprManufacturers.includes(id), `ndpr_rare_earth_feedstock must expose ${id} as an upstream feedstock supplier`);
  }

  const encoderManufacturers = manufacturersForNode(graph, "servo_motor_encoder_feedback").map((node) => node.id);
  for (const id of ["org_heidenhain", "org_renishaw", "org_tamagawa_seiki"]) {
    assert.ok(encoderManufacturers.includes(id), `servo_motor_encoder_feedback must expose ${id} as an encoder supplier candidate`);
  }

  const bearingManufacturers = manufacturersForNode(graph, "servo_motor_bearings_and_shaft").map((node) => node.id);
  for (const id of ["org_nsk", "org_schaeffler", "org_skf", "org_ntn"]) {
    assert.ok(bearingManufacturers.includes(id), `servo_motor_bearings_and_shaft must expose ${id} as a bearing supplier candidate`);
  }

  const cableManufacturers = manufacturersForNode(graph, "servo_motor_cables_and_connectors").map((node) => node.id);
  for (const id of ["org_amphenol", "org_te_connectivity", "org_molex"]) {
    assert.ok(
      cableManufacturers.includes(id),
      `servo_motor_cables_and_connectors must expose ${id} as a cable/connector supplier candidate`,
    );
  }

  const brakeManufacturers = manufacturersForNode(graph, "servo_motor_integrated_brake_option").map((node) => node.id);
  for (const id of ["org_kendrion", "org_mayr_power_transmission"]) {
    assert.ok(brakeManufacturers.includes(id), `servo_motor_integrated_brake_option must expose ${id} as a holding-brake supplier`);
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
