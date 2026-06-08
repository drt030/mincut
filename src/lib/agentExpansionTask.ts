import type { Edge, GraphData, Node, NodeKind, ResearchTask } from "./schema";

const AGENT_EXPANSION_TASK_PREFIX = "task_agent_expand_";
const AGENT_EXPANSION_TAGS = ["agent_candidate", "decomposition_frontier"] as const;

export type AgentExpansionGraphPatch = {
  nodes: Node[];
  edges: Edge[];
};

type AgentCandidateSpec = {
  id: string;
  name: string;
  kind: NodeKind;
  description: string;
  tags?: string[];
  notes: string;
};

function safeTaskIdSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function timestampSegment(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 14);
}

function nodeDisplayName(graph: GraphData, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

function assertKnownTarget(graph: GraphData, targetNodeId: string): void {
  if (!graph.nodes.some((node) => node.id === targetNodeId)) {
    throw new Error(`Cannot create agent expansion task for unknown node: ${targetNodeId}`);
  }
}

const TEMPLATE_CANDIDATES: Record<string, AgentCandidateSpec[]> = {
  precision_reducer_gearbox: [
    {
      id: "precision_reducer_tooth_profile_grinding_process",
      name: "Precision reducer tooth-profile grinding process",
      kind: "manufacturing_process",
      description:
        "Candidate process node for the fine tooth-profile machining step that can drive reducer backlash, noise, yield, and cost.",
      tags: ["reducer", "manufacturing_process"],
      notes:
        "Agent candidate listed before evidence collection. Needs source-backed confirmation of process route, tolerances, equipment class, and cost impact for the parcel-sorting robot arm reducer.",
    },
    {
      id: "precision_reducer_heat_treatment_distortion_control",
      name: "Precision reducer heat-treatment distortion control",
      kind: "manufacturing_process",
      description:
        "Candidate process-control node for hardening and distortion management in precision reducer gears and splines.",
      tags: ["reducer", "heat_treatment"],
      notes:
        "Agent candidate listed before evidence collection. Needs evidence for which heat-treatment and distortion-control steps materially affect reducer maturity, yield, life, or cost.",
    },
    {
      id: "precision_reducer_backlash_and_transmission_error_test",
      name: "Precision reducer backlash and transmission-error test",
      kind: "engineering_method",
      description:
        "Candidate validation method for measuring reducer backlash, transmission error, stiffness, repeatability contribution, and life-test drift.",
      tags: ["reducer", "test_protocol"],
      notes:
        "Agent candidate listed before evidence collection. Needs a reviewed test protocol and benchmark ranges before being treated as established graph knowledge.",
    },
    {
      id: "precision_reducer_cleanliness_and_lubrication_fill_process",
      name: "Precision reducer cleanliness and lubrication-fill process",
      kind: "manufacturing_process",
      description:
        "Candidate process node for contamination control and lubricant fill that can affect reducer life and service reliability.",
      tags: ["reducer", "reliability"],
      notes:
        "Agent candidate listed before evidence collection. Needs sources for lubricant selection, cleanliness class, fill process, and maintenance sensitivity.",
    },
  ],
  robot_controller_io: [
    {
      id: "robot_controller_io_backplane_and_power_distribution",
      name: "Robot controller I/O backplane and power distribution",
      kind: "module",
      description:
        "Candidate controller-layer dependency covering controller backplane, local power distribution, and I/O module power integrity.",
      tags: ["controller", "io", "power_distribution"],
      notes:
        "Agent candidate listed before evidence collection. Needs source-backed decomposition into backplane, power budget, redundancy, and environmental constraints.",
    },
    {
      id: "robot_controller_io_signal_isolation_and_filtering",
      name: "Robot controller I/O signal isolation and filtering",
      kind: "module",
      description:
        "Candidate dependency for opto-isolation, surge protection, filtering, and noise immunity across robot external I/O.",
      tags: ["controller", "io", "emc"],
      notes:
        "Agent candidate listed before evidence collection. Needs evidence for which isolation/filtering choices materially affect reliability, safety, and commissioning cost.",
    },
    {
      id: "robot_controller_io_safety_interlock_validation_protocol",
      name: "Robot controller safety-interlock validation protocol",
      kind: "engineering_method",
      description:
        "Candidate validation method for proving safety I/O, emergency stops, interlocks, and fault recovery behave correctly in the robot sorting cell.",
      tags: ["controller", "safety", "test_protocol"],
      notes:
        "Agent candidate listed before evidence collection. Needs standards and vendor integration evidence before being treated as reviewed.",
    },
    {
      id: "robot_controller_io_motion_bus_cycle_time_budget",
      name: "Robot controller motion-bus cycle-time budget",
      kind: "engineering_method",
      description:
        "Candidate timing-budget node for fieldbus cycle time, I/O scan time, and deterministic motion-control latency.",
      tags: ["controller", "fieldbus", "latency"],
      notes:
        "Agent candidate listed before evidence collection. Needs quantitative timing targets and integration evidence for the selected controller stack.",
    },
  ],
  industrial_robot_arm_body: [
    {
      id: "robot_joint_module_integration_stack",
      name: "Robot joint module integration stack",
      kind: "module",
      description:
        "Candidate dependency grouping joint-level motor, reducer, brake, encoder, bearing, sealing, cabling, and housing integration.",
      tags: ["robot_arm", "joint_module"],
      notes:
        "Agent candidate listed before evidence collection. Needs a sourced bill-of-architecture and cost allocation before review.",
    },
    {
      id: "robot_arm_payload_reach_repeatability_budget",
      name: "Robot arm payload / reach / repeatability budget",
      kind: "engineering_method",
      description:
        "Candidate engineering budget tying payload, reach, stiffness, repeatability, cycle time, and parcel handling envelope to arm selection.",
      tags: ["robot_arm", "performance_budget"],
      notes:
        "Agent candidate listed before evidence collection. Needs evidence for target payload/reach and sensitivity to parcel-sorting throughput.",
    },
    {
      id: "robot_arm_factory_acceptance_test_protocol",
      name: "Robot arm factory acceptance test protocol",
      kind: "engineering_method",
      description:
        "Candidate validation method for arm repeatability, backlash, payload, safety, and controller acceptance before cell integration.",
      tags: ["robot_arm", "test_protocol"],
      notes:
        "Agent candidate listed before evidence collection. Needs vendor or standard test evidence before being marked reviewed.",
    },
  ],
  vision_barcode_label_recognition: [
    {
      id: "barcode_ocr_dataset_capture_and_labeling_pipeline",
      name: "Barcode / OCR dataset capture and labeling pipeline",
      kind: "engineering_method",
      description:
        "Candidate data pipeline for collecting, labeling, and curating parcel-label images under conveyor motion and real warehouse variation.",
      tags: ["vision", "dataset", "ocr"],
      notes:
        "Agent candidate listed before evidence collection. Needs evidence for data volume, label taxonomy, failure modes, and validation split design.",
    },
    {
      id: "vision_illumination_glare_suppression_method",
      name: "Vision illumination glare-suppression method",
      kind: "engineering_method",
      description:
        "Candidate method for reducing glare, reflection, wrinkles, occlusion, and ambient-light variation in parcel-label imaging.",
      tags: ["vision", "lighting", "glare"],
      notes:
        "Agent candidate listed before evidence collection. Needs source-backed optical and lighting design references.",
    },
    {
      id: "label_read_rate_validation_protocol",
      name: "Label read-rate validation protocol",
      kind: "engineering_method",
      description:
        "Candidate benchmark protocol for measuring barcode/OCR read rate, no-read recovery, latency, and exception-routing impact.",
      tags: ["vision", "benchmark", "test_protocol"],
      notes:
        "Agent candidate listed before evidence collection. Needs reviewed field or benchmark evidence before this becomes a scored claim.",
    },
  ],
  parcel_manipulation_or_diverter: [
    {
      id: "parcel_pick_failure_recovery_policy",
      name: "Parcel pick-failure recovery policy",
      kind: "engineering_method",
      description:
        "Candidate control policy for failed suction attempts, retries, bypass routing, and manual exception handling.",
      tags: ["manipulation", "fault_recovery"],
      notes:
        "Agent candidate listed before evidence collection. Needs field evidence for failure categories and throughput impact.",
    },
    {
      id: "suction_end_effector_wear_and_replacement_plan",
      name: "Suction end-effector wear and replacement plan",
      kind: "engineering_method",
      description:
        "Candidate maintenance method for suction-cup wear, contamination, inspection cadence, and replacement economics.",
      tags: ["suction", "maintenance"],
      notes:
        "Agent candidate listed before evidence collection. Needs vendor and field evidence for wear rates and cost sensitivity.",
    },
    {
      id: "robot_cell_collision_clearance_model",
      name: "Robot cell collision and clearance model",
      kind: "engineering_method",
      description:
        "Candidate method for modeling robot arm, parcel, chute, bin, conveyor, and guard clearances under sorting motion.",
      tags: ["robot_cell", "safety", "simulation"],
      notes:
        "Agent candidate listed before evidence collection. Needs validation against the target cell geometry and safety constraints.",
    },
  ],
};

export function buildAgentExpansionTask(
  graph: GraphData,
  targetNodeId: string,
  createdAt = new Date().toISOString(),
): ResearchTask {
  assertKnownTarget(graph, targetNodeId);
  const displayName = nodeDisplayName(graph, targetNodeId);
  return {
    id: `${AGENT_EXPANSION_TASK_PREFIX}${safeTaskIdSegment(targetNodeId)}_${timestampSegment(createdAt)}`,
    title: `Expand ${displayName} one dependency layer`,
    reason:
      `Queued from the graph research-root view for ${targetNodeId}. ` +
      "Follow docs/NODE_EXPANSION.md, research sources as needed, prepare a small candidate import batch, " +
      "and add one deeper requires layer where it affects maturity, cost, manufacturability, reliability, or bottlenecks. " +
      "Keep generated claims unreviewed until human review.",
    targetNodeId,
    suggestedNodeKind: "module",
    priority: "medium",
    status: "pending",
    createdAt,
  };
}

function fallbackCandidatesForTarget(graph: GraphData, targetNodeId: string): AgentCandidateSpec[] {
  const displayName = nodeDisplayName(graph, targetNodeId);
  const safe = safeTaskIdSegment(targetNodeId);
  return [
    {
      id: `${safe}_candidate_component_dependency`,
      name: `${displayName} component dependency candidate`,
      kind: "module",
      description:
        `Candidate component dependency for ${displayName}. It is listed immediately so the graph can show that a deeper research layer is being prepared.`,
      tags: ["component_dependency"],
      notes:
        "Generic agent candidate listed before evidence collection. Replace with a concrete sourced component once the background research task resolves.",
    },
    {
      id: `${safe}_candidate_process_constraint`,
      name: `${displayName} process constraint candidate`,
      kind: "manufacturing_process",
      description:
        `Candidate manufacturing or integration process constraint for ${displayName}.`,
      tags: ["process_constraint"],
      notes:
        "Generic agent candidate listed before evidence collection. Needs a concrete process name, evidence, and review before being treated as established.",
    },
    {
      id: `${safe}_candidate_validation_protocol`,
      name: `${displayName} validation protocol candidate`,
      kind: "engineering_method",
      description:
        `Candidate validation method for ${displayName}, intended to capture test evidence and acceptance criteria after research.`,
      tags: ["validation_protocol"],
      notes:
        "Generic agent candidate listed before evidence collection. Needs a sourced test method or benchmark protocol.",
    },
  ];
}

function mergeTags(specTags: string[] | undefined): string[] {
  return [...new Set([...AGENT_EXPANSION_TAGS, ...(specTags ?? [])])];
}

function candidateDomain(target: Node): string[] {
  return [...new Set([...target.domain, "agent_expansion"])];
}

function candidateEdgeId(sourceId: string, targetId: string): string {
  return `e_agent_${safeTaskIdSegment(sourceId)}_requires_${safeTaskIdSegment(targetId)}`;
}

export function buildAgentExpansionGraphPatch(
  graph: GraphData,
  targetNodeId: string,
  createdAt = new Date().toISOString(),
): AgentExpansionGraphPatch {
  assertKnownTarget(graph, targetNodeId);
  const target = graph.nodes.find((node) => node.id === targetNodeId)!;
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const specs = TEMPLATE_CANDIDATES[targetNodeId] ?? fallbackCandidatesForTarget(graph, targetNodeId);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const spec of specs) {
    const edgeId = candidateEdgeId(targetNodeId, spec.id);
    const nodeAlreadyExists = existingNodeIds.has(spec.id) || nodes.some((node) => node.id === spec.id);
    const edgeAlreadyExists = existingEdgeIds.has(edgeId) || edges.some((edge) => edge.id === edgeId);
    if (!nodeAlreadyExists) {
      nodes.push({
        id: spec.id,
        name: spec.name,
        kind: spec.kind,
        domain: candidateDomain(target),
        description: spec.description,
        maturityLabel: "unknown",
        confidence: "low",
        tags: mergeTags(spec.tags),
        notes: spec.notes,
        reviewStatus: "unreviewed",
        createdAt,
        updatedAt: createdAt,
        frontierFor: [targetNodeId],
      });
    }
    if (!edgeAlreadyExists) {
      edges.push({
        id: edgeId,
        source: targetNodeId,
        target: spec.id,
        relation: "requires",
        claim:
          `${nodeDisplayName(graph, targetNodeId)} may require ${spec.name} as the next decomposition layer. Candidate is listed before evidence collection.`,
        context:
          "Created by the in-app agent expansion preview. Treat as an unreviewed candidate until cited research or human review confirms it.",
        confidence: "low",
        reviewStatus: "unreviewed",
      });
    }
  }

  return { nodes, edges };
}

function isOpenAgentExpansionTask(task: ResearchTask, targetNodeId: string): boolean {
  const generatedIdMatches = task.id.startsWith(`${AGENT_EXPANSION_TASK_PREFIX}${safeTaskIdSegment(targetNodeId)}_`);
  const titleMatches = task.title.startsWith("Expand ") && task.title.includes(" one dependency layer");
  return (
    task.targetNodeId === targetNodeId &&
    (task.status === "pending" || task.status === "in_progress") &&
    (generatedIdMatches || titleMatches)
  );
}

export function upsertAgentExpansionTask(
  graph: GraphData,
  tasks: ResearchTask[],
  targetNodeId: string,
  createdAt = new Date().toISOString(),
): { task: ResearchTask; tasks: ResearchTask[]; created: boolean } {
  assertKnownTarget(graph, targetNodeId);
  const existing = tasks.find((task) => isOpenAgentExpansionTask(task, targetNodeId));
  if (existing) {
    return { task: existing, tasks, created: false };
  }
  const task = buildAgentExpansionTask(graph, targetNodeId, createdAt);
  return { task, tasks: [...tasks, task], created: true };
}
