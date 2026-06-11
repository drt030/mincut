import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../data/nodes/parcel_sorting_robot.json", import.meta.url);

// Judgments per ADR-0008. procurable = a real market sells this as a
// service/dataset/license; must_build = embodied know-how, not separately
// transactable. Each value lands with a review note — these are agent
// judgments pending human review.
const TRANSACTABILITY = {
  low_cost_realtime_vision_compute_integration: ["procurable", "system integrators sell vision-compute integration"],
  vision_model_deployment_optimization: ["procurable", "deployment/optimization consulting and tooling market exists"],
  vision_inference_runtime_stack: ["procurable", "commercial/licensable runtimes (TensorRT, ONNX Runtime)"],
  camera_sdk_frame_acquisition_pipeline: ["procurable", "vendor SDKs plus integration services"],
  vision_latency_budget_and_timestamping: ["must_build", "integrator-internal engineering discipline, not sold separately"],
  barcode_ocr_reading_software: ["procurable", "commercial packages (Cognex, Zebra, Datalogic)"],
  parcel_label_localization: ["procurable", "shipped inside commercial barcode/OCR offerings"],
  industrial_barcode_decoding_runtime: ["procurable", "commercial decoder runtimes"],
  parcel_ocr_model_runtime: ["procurable", "commercial OCR runtimes/licensable models"],
  barcode_ocr_no_read_recovery: ["must_build", "line-specific exception workflow, integrator-built"],
  parcel_label_training_dataset: ["procurable", "data products and annotation services market"],
  barcode_ocr_benchmark_metrics: ["must_build", "internal benchmarking method"],
  parcel_suction_cup_contact_qualification: ["procurable", "vacuum vendors offer application qualification engineering"],
  vacuum_blowoff_timing_and_contamination_control: ["must_build", "cell-specific tuning know-how"],
  gripper_tcp_pattern_calibration: ["must_build", "in-house calibration procedure"],
  servo_drive_motion_control_loop: ["must_build", "drive vendor embedded firmware know-how, not sold separately"],
  servo_drive_thermal_emc_design: ["must_build", "vendor-internal design capability"],
  servo_motor_feedback_alignment: ["must_build", "motor-manufacturing internal process know-how"],
  robot_realtime_control_runtime: ["procurable", "licensable RT runtimes and control platforms"],
  robot_controller_diagnostics_interface: ["procurable", "ships as controller product feature"],
  parcel_induction_spacing_control: ["must_build", "sortation integrator core control logic"],
  parcel_singulation_and_metering: ["procurable", "purchasable singulator subsystems from sortation vendors"],
  dynamic_gap_control_logic: ["must_build", "integrator-specific control logic"],
  induction_exception_recovery: ["must_build", "integrator-built exception workflow"],
  plc_wcs_sorting_handshake_and_fault_recovery: ["procurable", "system-integrator service offering"],
  jam_detection_and_recovery: ["must_build", "integrator-built detection/recovery logic"],
  delta_robot_parcel_variability_jam_control: ["must_build", "no separate market; sibling-product embedded know-how"],
  reducer_lubrication_and_life_test: ["must_build", "reducer-vendor internal process; life-test know-how is the moat"],
  servo_motor_assembly_and_test_process: ["procurable", "contract manufacturing services exist"],
  robot_base_installation_alignment_process: ["procurable", "installation/commissioning service market"],
  robot_arm_assembly_process: ["procurable", "contract manufacturing/EMS services"],
  modular_cell_manufacturing: ["must_build", "the maker's own production system design"],
  copper_ore_mining_and_refining_chain: ["procurable", "commodity industry chain; output traded openly"],
  iron_ore_steelmaking_chain: ["procurable", "commodity industry chain"],
  bauxite_alumina_aluminum_chain: ["procurable", "commodity industry chain"],
  quartz_silica_silicon_chain: ["procurable", "commodity chain at the parcel-robot consumption tier"],
};

const raw = readFileSync(FILE, "utf8");
const nodes = JSON.parse(raw);
let applied = 0;
for (const node of nodes) {
  const entry = TRANSACTABILITY[node.id];
  if (!entry) continue;
  const [value, rationale] = entry;
  if (node.transactability !== undefined) continue;
  node.transactability = value;
  const note = `transactability=${value} (agent backfill 2026-06-10, needs review): ${rationale}`;
  node.notes = node.notes ? `${node.notes} ${note}` : note;
  applied += 1;
}
writeFileSync(FILE, `${JSON.stringify(nodes, null, 2)}\n`);
console.log(`applied transactability to ${applied} nodes`);
