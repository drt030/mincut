import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";
import {
  implementedNodesForOrganization,
  implementersForNode,
  manufacturersForNode,
  scopeGraphToReachableNodes,
  suppliedNodesForOrganization,
} from "../src/lib/graphTraversal";

const graph = loadGraphData();

test("active product manufactured_by edges target organization nodes in source data", () => {
  const scoped = scopeGraphToReachableNodes(graph);
  const nodesById = new Map(scoped.nodes.map((node) => [node.id, node]));
  const invalidEdges = scoped.edges
    .filter((edge) => edge.relation === "manufactured_by")
    .filter((edge) => nodesById.get(edge.target)?.kind !== "organization")
    .map((edge) => `${edge.id}:${edge.source}->${edge.target}:${nodesById.get(edge.target)?.kind ?? "missing"}`);

  assert.deepEqual(invalidEdges, []);
});

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

test("target product exposes parcel-cell integrator and system manufacturer candidates", () => {
  const manufacturers = manufacturersForNode(graph, "low_cost_parcel_sorting_robot_300k_rmb").map((node) => node.id);

  for (const id of [
    "org_abb_robotics",
    "org_wayzim",
    "org_dematic_kion",
    "org_honeywell_intelligrated",
  ]) {
    assert.ok(
      manufacturers.includes(id),
      `target product must expose ${id} as a parcel-cell integrator or system manufacturer candidate`,
    );
  }
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

test("robot controller child layer exposes direct controller and I-O supplier candidates", () => {
  const expectedManufacturersByNode: Record<string, string[]> = {
    robot_controller_cpu_module: [
      "org_siemens",
      "org_inovance",
      "org_mitsubishi_electric",
      "org_rockwell_automation",
      "org_schneider_electric",
    ],
    robot_fieldbus_gateway: [
      "org_siemens",
      "org_inovance",
      "org_omron",
      "org_rockwell_automation",
      "org_schneider_electric",
    ],
    robot_safety_io_interface: [
      "org_siemens",
      "org_omron",
      "org_rockwell_automation",
      "org_schneider_electric",
    ],
    robot_external_io_sensor_interface: [
      "org_siemens",
      "org_inovance",
      "org_omron",
      "org_rockwell_automation",
      "org_schneider_electric",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedManufacturersByNode)) {
    const manufacturerIds = new Set(manufacturersForNode(graph, nodeId).map((node) => node.id));

    for (const expectedId of expectedIds) {
      assert.ok(
        manufacturerIds.has(expectedId),
        `${nodeId} must expose ${expectedId} directly as a controller/I-O supplier candidate`,
      );
    }
  }

  const diagnosticsImplementers = new Set(
    implementersForNode(graph, "robot_controller_diagnostics_interface").map((node) => node.id),
  );
  for (const id of ["org_siemens", "org_inovance", "org_rockwell_automation"]) {
    assert.ok(diagnosticsImplementers.has(id), `robot_controller_diagnostics_interface must expose ${id} as an implementer`);
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

  const aluminumManufacturers = manufacturersForNode(graph, "aluminum_structural_material").map((node) => node.id);
  for (const id of ["org_chalco", "org_alcoa", "org_norsk_hydro"]) {
    assert.ok(
      aluminumManufacturers.includes(id),
      `aluminum_structural_material must expose ${id} as an aluminum supplier candidate`,
    );
  }

  const aluminumChainManufacturers = manufacturersForNode(graph, "bauxite_alumina_aluminum_chain").map((node) => node.id);
  for (const id of ["org_chalco", "org_alcoa", "org_norsk_hydro"]) {
    assert.ok(
      aluminumChainManufacturers.includes(id),
      `bauxite_alumina_aluminum_chain must expose ${id} as an upstream aluminum-chain supplier candidate`,
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

  const heavyRareEarthManufacturers = manufacturersForNode(graph, "dysprosium_terbium_heavy_ree_additives");
  const heavyRareEarthIds = heavyRareEarthManufacturers.map((node) => node.id);
  for (const id of ["org_lynas_rare_earths", "org_china_rare_earth_resources", "org_xiamen_tungsten"]) {
    assert.ok(
      heavyRareEarthIds.includes(id),
      `dysprosium_terbium_heavy_ree_additives must expose ${id} as a heavy-rare-earth supplier candidate`,
    );
  }
  for (const id of ["org_china_rare_earth_resources", "org_xiamen_tungsten"]) {
    const supplier = heavyRareEarthManufacturers.find((node) => node.id === id);
    assert.ok(supplier?.metrics?.some((metric) => metric.name === "Public listing"));
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

test("vacuum end-effector child layer exposes supplier and process candidates", () => {
  const cupManufacturers = manufacturersForNode(graph, "vacuum_suction_cup_array").map((node) => node.id);
  for (const id of ["org_smc", "org_schmalz", "org_piab", "org_festo"]) {
    assert.ok(cupManufacturers.includes(id), `vacuum_suction_cup_array must expose ${id} as a suction-cup supplier candidate`);
  }

  const generatorManufacturers = manufacturersForNode(graph, "vacuum_generator_or_ejector").map((node) => node.id);
  for (const id of ["org_smc", "org_piab", "org_festo", "org_schmalz"]) {
    assert.ok(generatorManufacturers.includes(id), `vacuum_generator_or_ejector must expose ${id} as a vacuum-generator supplier candidate`);
  }

  const valveManufacturers = manufacturersForNode(graph, "vacuum_valves_and_blowoff").map((node) => node.id);
  for (const id of ["org_smc", "org_festo", "org_ckd", "org_airtac"]) {
    assert.ok(valveManufacturers.includes(id), `vacuum_valves_and_blowoff must expose ${id} as a valve/blow-off supplier candidate`);
  }

  const pressureSensorManufacturers = manufacturersForNode(graph, "vacuum_pressure_sensing").map((node) => node.id);
  for (const id of ["org_smc", "org_festo", "org_ifm", "org_sick"]) {
    assert.ok(pressureSensorManufacturers.includes(id), `vacuum_pressure_sensing must expose ${id} as a pressure-sensing supplier candidate`);
  }

  const elastomerManufacturers = manufacturersForNode(graph, "petrochemical_elastomer_feedstock").map((node) => node.id);
  for (const id of ["org_wacker_chemie", "org_dow", "org_shin_etsu", "org_dupont"]) {
    assert.ok(elastomerManufacturers.includes(id), `petrochemical_elastomer_feedstock must expose ${id} as an elastomer supplier candidate`);
  }

  const contactQualificationImplementers = implementersForNode(graph, "parcel_suction_cup_contact_qualification").map((node) => node.id);
  const blowoffTimingImplementers = implementersForNode(graph, "vacuum_blowoff_timing_and_contamination_control").map((node) => node.id);
  for (const id of ["org_smc", "org_schmalz", "org_piab"]) {
    assert.ok(
      contactQualificationImplementers.includes(id),
      `parcel_suction_cup_contact_qualification must expose ${id} as a qualification/process candidate`,
    );
    assert.ok(
      blowoffTimingImplementers.includes(id),
      `vacuum_blowoff_timing_and_contamination_control must expose ${id} as a timing/control process candidate`,
    );
  }
});

test("investment-facing bottleneck nodes expose supplier candidates at the bottleneck level", () => {
  const expectedCandidatesByBottleneck: Record<string, string[]> = {
    low_cost_realtime_vision_compute_integration: [
      "org_nvidia",
      "org_intel",
      "org_advantech",
      "org_adlink_technology",
      "org_basler",
    ],
    vision_latency_budget_and_timestamping: ["org_basler", "org_siemens", "org_inovance"],
    barcode_ocr_no_read_recovery: [
      "org_cognex",
      "org_zebra_technologies",
      "org_sick",
      "org_datalogic",
      "org_hikrobot",
    ],
    conveyor_speed_encoder_tracking: [
      "org_banner_engineering",
      "org_sick",
      "org_omron",
      "org_leuze",
      "org_siemens",
    ],
    parcel_singulation_and_metering: [
      "org_wayzim",
      "org_interroll",
      "org_dematic_kion",
      "org_honeywell_intelligrated",
    ],
    jam_detection_and_recovery: [
      "org_banner_engineering",
      "org_sick",
      "org_dematic_kion",
      "org_honeywell_intelligrated",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedCandidatesByBottleneck)) {
    const candidateIds = new Set([
      ...manufacturersForNode(graph, nodeId).map((node) => node.id),
      ...implementersForNode(graph, nodeId).map((node) => node.id),
    ]);

    for (const expectedId of expectedIds) {
      assert.ok(
        candidateIds.has(expectedId),
        `${nodeId} must expose ${expectedId} as a supplier or implementation candidate for investor workflows`,
      );
    }
  }
});

test("high-priority subsystem and method nodes expose direct supplier or implementer candidates", () => {
  const expectedManufacturersByNode: Record<string, string[]> = {
    vision_processing_compute: [
      "org_nvidia",
      "org_intel",
      "org_advantech",
      "org_adlink_technology",
    ],
    parcel_manipulation_or_diverter: [
      "org_abb_robotics",
      "org_wayzim",
      "org_dematic_kion",
      "org_honeywell_intelligrated",
    ],
    sortation_chutes_and_bins: [
      "org_wayzim",
      "org_interroll",
      "org_dematic_kion",
      "org_daifuku",
      "org_honeywell_intelligrated",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedManufacturersByNode)) {
    const candidateIds = new Set(manufacturersForNode(graph, nodeId).map((node) => node.id));
    for (const expectedId of expectedIds) {
      assert.ok(candidateIds.has(expectedId), `${nodeId} must expose ${expectedId} as a direct supplier candidate`);
    }
  }

  const expectedImplementersByNode: Record<string, string[]> = {
    plc_wcs_sorting_handshake_and_fault_recovery: [
      "org_siemens",
      "org_rockwell_automation",
      "org_schneider_electric",
      "org_dematic_kion",
      "org_honeywell_intelligrated",
    ],
    reducer_lubrication_and_life_test: [
      "org_nabtesco",
      "org_harmonic_drive_systems",
      "org_leaderdrive",
      "org_shuanghuan_transmission",
    ],
    motion_planning: [
      "org_abb_robotics",
      "org_fanuc",
      "org_yaskawa",
      "org_inovance",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedImplementersByNode)) {
    const candidateIds = new Set(implementersForNode(graph, nodeId).map((node) => node.id));
    for (const expectedId of expectedIds) {
      assert.ok(candidateIds.has(expectedId), `${nodeId} must expose ${expectedId} as a direct implementation candidate`);
    }
  }
});

test("visible hardware frontier nodes expose direct supplier candidates for investor workflows", () => {
  const expectedManufacturersByNode: Record<string, string[]> = {
    machine_vision_lens_and_optics: [
      "org_cognex",
      "org_keyence",
      "org_basler",
      "org_opt_machine_vision",
    ],
    conveyor_photoelectric_sensors: [
      "org_banner_engineering",
      "org_sick",
      "org_omron",
      "org_leuze",
    ],
    mechanical_structure: [
      "org_wayzim",
      "org_dematic_kion",
      "org_daifuku",
      "org_honeywell_intelligrated",
    ],
    arm_links_and_joints: [
      "org_fanuc",
      "org_estun",
      "org_inovance",
      "org_abb_robotics",
      "org_yaskawa",
    ],
    robot_base_mounting_structure: [
      "org_abb_robotics",
      "org_fanuc",
      "org_yaskawa",
      "org_inovance",
    ],
    robot_cabling_and_power: [
      "org_amphenol",
      "org_te_connectivity",
      "org_molex",
      "org_siemens",
    ],
    servo_motor_stator_core: [
      "org_baosteel",
      "org_nippon_steel",
      "org_posco",
    ],
    servo_motor_windings: [
      "org_inovance",
      "org_yaskawa",
      "org_mitsubishi_electric",
    ],
    servo_motor_housing_and_thermal_design: [
      "org_inovance",
      "org_yaskawa",
      "org_mitsubishi_electric",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedManufacturersByNode)) {
    const candidateIds = new Set(manufacturersForNode(graph, nodeId).map((node) => node.id));

    for (const expectedId of expectedIds) {
      assert.ok(
        candidateIds.has(expectedId),
        `${nodeId} must expose ${expectedId} as a direct hardware or material supplier candidate`,
      );
    }
  }
});

test("upstream material and electronics chain nodes expose investable supplier candidates", () => {
  const expectedManufacturersByNode: Record<string, string[]> = {
    semiconductor_grade_silicon_and_electronics: [
      "org_tsmc",
      "org_smic",
      "org_infineon_technologies",
    ],
    quartz_silica_silicon_chain: [
      "org_wacker_chemie",
      "org_gcl_technology",
    ],
    refined_copper_conductor_material: [
      "org_jiangxi_copper",
      "org_zijin_mining",
      "org_freeport_mcmoran",
    ],
    copper_ore_mining_and_refining_chain: [
      "org_jiangxi_copper",
      "org_zijin_mining",
      "org_freeport_mcmoran",
    ],
    iron_ore_steelmaking_chain: [
      "org_baosteel",
      "org_nippon_steel",
      "org_arcelormittal",
    ],
    photolithography_photoresist_chemical_chain: [
      "org_tokyo_ohka_kogyo",
      "org_shin_etsu",
      "org_jsr",
    ],
    semiconductor_packaging_solder_substrate_chain: [
      "org_ase_technology",
      "org_amkor_technology",
      "org_ibiden",
    ],
    silicon_wafer_fabrication_process: [
      "org_tsmc",
      "org_smic",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedManufacturersByNode)) {
    const candidateIds = new Set(manufacturersForNode(graph, nodeId).map((node) => node.id));

    for (const expectedId of expectedIds) {
      assert.ok(
        candidateIds.has(expectedId),
        `${nodeId} must expose ${expectedId} as an upstream supplier candidate for investor workflows`,
      );
    }
  }
});

test("software and runtime frontier nodes expose direct implementation or supplier candidates", () => {
  const expectedCandidatesByNode: Record<string, string[]> = {
    vision_model_deployment_optimization: ["org_nvidia", "org_intel"],
    camera_sdk_frame_acquisition_pipeline: ["org_basler"],
    fanless_compute_thermal_management: [
      "org_advantech",
      "org_adlink_technology",
      "org_nvidia",
    ],
    parcel_label_localization: [
      "org_cognex",
      "org_zebra_technologies",
      "org_hikrobot",
    ],
    industrial_barcode_decoding_runtime: [
      "org_cognex",
      "org_zebra_technologies",
      "org_datalogic",
      "org_sick",
    ],
    parcel_ocr_model_runtime: ["org_cognex", "org_zebra_technologies"],
    parcel_label_training_dataset: ["org_cognex", "org_zebra_technologies"],
    barcode_ocr_benchmark_metrics: [
      "org_cognex",
      "org_sick",
      "org_zebra_technologies",
    ],
    robot_realtime_control_runtime: [
      "org_inovance",
      "org_siemens",
      "org_mitsubishi_electric",
    ],
    robot_base_installation_alignment_process: ["org_abb_robotics", "org_fanuc"],
    cost_optimized_hardware_stack: [
      "org_nvidia",
      "org_intel",
      "org_advantech",
      "org_adlink_technology",
      "org_inovance",
    ],
  };

  for (const [nodeId, expectedIds] of Object.entries(expectedCandidatesByNode)) {
    const candidateIds = new Set([
      ...manufacturersForNode(graph, nodeId).map((node) => node.id),
      ...implementersForNode(graph, nodeId).map((node) => node.id),
    ]);

    for (const expectedId of expectedIds) {
      assert.ok(
        candidateIds.has(expectedId),
        `${nodeId} must expose ${expectedId} directly as a software/runtime supplier or implementation candidate`,
      );
    }
  }
});

test("investment-facing supplier candidates expose public or private market status", () => {
  const expectedCandidatesByNode: Record<string, string[]> = {
    parcel_detection_and_tracking: ["org_hikrobot", "org_keyence", "org_cognex"],
    barcode_ocr_no_read_recovery: [
      "org_cognex",
      "org_zebra_technologies",
      "org_sick",
      "org_datalogic",
      "org_hikrobot",
    ],
    robot_controller_cpu_module: [
      "org_siemens",
      "org_inovance",
      "org_mitsubishi_electric",
      "org_rockwell_automation",
      "org_schneider_electric",
    ],
  };

  const candidates = new Map(graph.nodes.filter((node) => node.kind === "organization").map((node) => [node.id, node]));

  for (const [nodeId, expectedIds] of Object.entries(expectedCandidatesByNode)) {
    for (const expectedId of expectedIds) {
      const organization = candidates.get(expectedId);
      assert.ok(organization, `${nodeId} candidate ${expectedId} must exist as an organization node`);

      const tags = new Set(organization.tags ?? []);
      assert.ok(
        tags.has("public_company") || tags.has("private_company") || tags.has("public_company_exposure"),
        `${nodeId} candidate ${expectedId} must expose public/private market status tags`,
      );
    }
  }
});

test("controller supplier candidates expose annual-report automation business exposure", () => {
  const expectedExposureByOrganization: Record<string, { metric: string; evidenceId: string }> = {
    org_inovance: {
      metric: "2024 general industrial automation sales",
      evidenceId: "ev_inovance_annual_report_2024_investor_exposure",
    },
    org_siemens: {
      metric: "FY2025 Digital Industries revenue",
      evidenceId: "ev_siemens_annual_report_2025_digital_industries",
    },
    org_mitsubishi_electric: {
      metric: "FY2025 Factory Automation Systems revenue",
      evidenceId: "ev_mitsubishi_integrated_report_2025_factory_automation",
    },
    org_rockwell_automation: {
      metric: "FY2025 Software & Control sales",
      evidenceId: "ev_rockwell_annual_report_2025_segment_sales",
    },
    org_schneider_electric: {
      metric: "FY2025 Industrial Automation revenues",
      evidenceId: "ev_schneider_fy2025_industrial_automation_results",
    },
  };

  for (const [organizationId, expected] of Object.entries(expectedExposureByOrganization)) {
    const organization = graph.nodes.find((node) => node.id === organizationId);
    assert.ok(organization, `${organizationId} must exist`);
    assert.ok(
      organization?.metrics?.some((metric) => metric.name === expected.metric),
      `${organizationId} must expose ${expected.metric} for investor-facing automation exposure`,
    );
    assert.ok(
      organization?.evidenceIds?.includes(expected.evidenceId),
      `${organizationId} must cite ${expected.evidenceId}`,
    );
  }
});

test("high-exposure parcel supplier candidates expose investor scale metrics", () => {
  const expectedExposureByOrganization: Record<string, { metric: string; evidenceId: string }> = {
    org_abb_robotics: {
      metric: "Robotics divestiture enterprise value",
      evidenceId: "ev_abb_robotics_softbank_divestiture_2025",
    },
    org_keyence: {
      metric: "FY2025 net sales",
      evidenceId: "ev_keyence_fy2025_financial_results",
    },
    org_cognex: {
      metric: "FY2025 revenue",
      evidenceId: "ev_cognex_2025_10k_revenue",
    },
    org_smc: {
      metric: "FY2025 net sales",
      evidenceId: "ev_smc_integrated_report_2025_net_sales",
    },
    org_dematic_kion: {
      metric: "FY2025 Supply Chain Solutions revenue",
      evidenceId: "ev_kion_annual_report_2025_scs_revenue",
    },
    org_honeywell_intelligrated: {
      metric: "2024 Warehouse and Workflow Solutions revenue",
      evidenceId: "ev_honeywell_wws_strategic_alternatives_2025",
    },
  };

  for (const [organizationId, expected] of Object.entries(expectedExposureByOrganization)) {
    const organization = graph.nodes.find((node) => node.id === organizationId);
    assert.ok(organization, `${organizationId} must exist`);
    assert.ok(
      organization?.metrics?.some((metric) => metric.name === expected.metric),
      `${organizationId} must expose ${expected.metric} for investor-facing parcel supplier exposure`,
    );
    assert.ok(
      organization?.evidenceIds?.includes(expected.evidenceId),
      `${organizationId} must cite ${expected.evidenceId}`,
    );
  }
});

test("upstream investable supplier candidates expose scale or share metrics", () => {
  const expectedExposureByOrganization: Record<string, { metric: string; evidenceId: string }> = {
    org_tsmc: {
      metric: "FY2025 revenue",
      evidenceId: "ev_tsmc_annual_report_2025_foundry_scale",
    },
    org_smic: {
      metric: "FY2025 revenue",
      evidenceId: "ev_smic_2025_financial_summary",
    },
    org_gcl_technology: {
      metric: "Granular silicon market share",
      evidenceId: "ev_gcl_technology_granular_silicon_share_2025",
    },
    org_jiangxi_copper: {
      metric: "Public listing",
      evidenceId: "ev_jiangxi_copper_company_profile_2026",
    },
    org_zijin_mining: {
      metric: "2025 mine-produced copper",
      evidenceId: "ev_zijin_mining_2025_results",
    },
    org_freeport_mcmoran: {
      metric: "2025 consolidated copper production",
      evidenceId: "ev_freeport_mcmoran_2025_annual_report",
    },
    org_arcelormittal: {
      metric: "2024 crude steel production rank",
      evidenceId: "ev_worldsteel_steel_in_figures_2025",
    },
    org_tokyo_ohka_kogyo: {
      metric: "FY2025 net sales",
      evidenceId: "ev_tok_corporate_profile_2025_photoresist",
    },
    org_shin_etsu: {
      metric: "Semiconductor materials exposure",
      evidenceId: "ev_shin_etsu_annual_report_2025_semiconductor_materials",
    },
    org_jsr: {
      metric: "Market status",
      evidenceId: "ev_jsr_semiconductor_materials_2025",
    },
    org_ase_technology: {
      metric: "FY2025 consolidated net revenue",
      evidenceId: "ev_ase_full_year_2025_results",
    },
    org_amkor_technology: {
      metric: "FY2025 net sales",
      evidenceId: "ev_amkor_annual_report_2025",
    },
    org_ibiden: {
      metric: "IC package substrate exposure",
      evidenceId: "ev_ibiden_integrated_report_2025_ic_package_substrates",
    },
  };

  for (const [organizationId, expected] of Object.entries(expectedExposureByOrganization)) {
    const organization = graph.nodes.find((node) => node.id === organizationId);
    assert.ok(organization, `${organizationId} must exist`);
    assert.ok(
      organization?.metrics?.some((metric) => metric.name === expected.metric),
      `${organizationId} must expose ${expected.metric} for investor-facing upstream exposure`,
    );
    assert.ok(
      organization?.evidenceIds?.includes(expected.evidenceId),
      `${organizationId} must cite ${expected.evidenceId}`,
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
