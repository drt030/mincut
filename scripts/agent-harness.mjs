#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const defaultTarget = "low_cost_parcel_sorting_robot_300k_rmb";

const surfaces = {
  policy: "AGENTS.md",
  readme: "README.md",
  architecture: "docs/ARCHITECTURE.md",
  roadmap: "docs/roadmap.md",
  currentPlan: "docs/plans/parcel-sorting-robot-v0.md",
  operatorSurface: "docs/OPERATOR_SURFACE.md",
  memory: "docs/agent-memory.md",
  learn: "docs/agent-learn.md",
  feedbackLog: "docs/feedback-log.md",
  promotionBacklog: "docs/promotion-backlog.md",
  harnessConfig: ".harness/config.toml",
  hooks: ".harness/hooks.toml",
  packageJson: "package.json",
};

const verifyCommands = {
  data: [
    "npm run validate:data",
    "npm run check:active-graph-scope",
    `npm run gate -- --target ${defaultTarget} --dry-run`,
  ],
  code: [
    "npm run lint",
    "npm run build",
  ],
};

const stageContexts = {
  plan: {
    required: [surfaces.policy, surfaces.readme, surfaces.architecture, surfaces.currentPlan],
    optional: [surfaces.roadmap, surfaces.memory, surfaces.learn, surfaces.feedbackLog],
    checks: ["preserve_v0_boundary", "clarify_new_product_boundary", "keep_graph_claims_explicit"],
  },
  verify: {
    required: [surfaces.policy, surfaces.readme, surfaces.architecture, surfaces.harnessConfig],
    optional: [surfaces.memory],
    checks: ["run_relevant_npm_commands", "report_generated_gate_artifacts", "do_not_use_external_knowledge_in_gate"],
  },
  handoff: {
    required: [surfaces.policy, surfaces.memory, surfaces.learn],
    optional: [surfaces.feedbackLog, surfaces.promotionBacklog],
    checks: ["summarize_changed_files", "summarize_verification", "record_remaining_risks"],
  },
  learn: {
    required: [surfaces.learn, surfaces.feedbackLog, surfaces.promotionBacklog],
    optional: [surfaces.policy, surfaces.harnessConfig],
    checks: ["classify_feedback_scope", "route_reusable_feedback", "define_validation_needed"],
  },
};

function exists(filePath) {
  return fs.existsSync(path.join(repoRoot, filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), "utf8"));
}

function scriptNames() {
  if (!exists(surfaces.packageJson)) return [];
  return Object.keys(readJson(surfaces.packageJson).scripts ?? {});
}

function detectedProfile() {
  const scripts = scriptNames();
  const dataFiles = [
    "data/nodes/parcel_sorting_robot.json",
    "data/edges/parcel_sorting_robot_edges.json",
    "data/evidence/parcel_sorting_robot_evidence.json",
    "data/tasks/pending_tasks.json",
  ];

  return {
    bootstrap_mode: "surface-existing-workflow",
    capability_state: "plan_light",
    policy_surface: exists(surfaces.policy) ? surfaces.policy : null,
    contract_surfaces: [surfaces.readme, surfaces.architecture, surfaces.operatorSurface].filter(exists),
    plan_surfaces: [surfaces.roadmap, surfaces.currentPlan].filter(exists),
    task_surfaces: dataFiles.filter(exists),
    memory_surface: exists(surfaces.memory) ? surfaces.memory : null,
    learn_surface: exists(surfaces.learn) ? surfaces.learn : null,
    hook_surfaces: [surfaces.hooks].filter(exists),
    context_surfaces: [surfaces.harnessConfig, surfaces.hooks].filter(exists),
    feedback_surfaces: [surfaces.feedbackLog, surfaces.promotionBacklog].filter(exists),
    verify_commands: {
      data: verifyCommands.data.filter((command) => {
        if (command.includes("gate")) return scripts.includes("gate");
        if (command.includes("check:active-graph-scope")) return scripts.includes("check:active-graph-scope");
        return scripts.includes("validate:data");
      }),
      code: verifyCommands.code.filter((command) => command.includes("build") ? scripts.includes("build") : scripts.includes("lint")),
    },
    supports_runtime_claims: false,
    supports_stage_context: exists(surfaces.hooks),
    supports_provider_adapters: false,
    supports_feedback_promotion: exists(surfaces.feedbackLog) && exists(surfaces.promotionBacklog),
  };
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function detect() {
  printJson({
    repo_root: repoRoot,
    profile: detectedProfile(),
    evidence: Object.fromEntries(Object.entries(surfaces).map(([key, filePath]) => [key, { path: filePath, exists: exists(filePath) }])),
  });
}

function doctor() {
  const profile = detectedProfile();
  const issues = [];
  if (!profile.policy_surface) issues.push("Missing AGENTS.md policy surface.");
  if (!profile.memory_surface) issues.push("Missing docs/agent-memory.md handoff surface.");
  if (!profile.learn_surface) issues.push("Missing docs/agent-learn.md learn surface.");
  if (!profile.supports_stage_context) issues.push("Missing .harness/hooks.toml stage-context intent.");
  if (!profile.supports_feedback_promotion) issues.push("Missing feedback or promotion surfaces.");
  if (!profile.verify_commands.data.length) issues.push("Missing data verification commands.");
  if (!profile.verify_commands.code.length) issues.push("Missing code verification commands.");

  printJson({
    status: issues.length ? "needs_attention" : "ok",
    issues,
    next_actions: issues.length
      ? ["Add the missing surface or update scripts/agent-harness.mjs detection if the surface uses a different path."]
      : ["Use npm run agent:context -- --stage plan before broad changes.", "Use npm run agent:verify -- --scope all before handoff."],
  });
}

function briefing() {
  const profile = detectedProfile();
  printJson({
    read_first: [surfaces.policy, surfaces.readme, surfaces.architecture, surfaces.currentPlan].filter(exists),
    default_target: defaultTarget,
    boundaries: ["Keep v0 local-first.", "Do not add backend, database, auth, autonomous crawling, or LLM features unless explicitly requested.", "Keep graph claims explicit and evidence-aware."],
    available_verification: profile.verify_commands,
    handoff_surface: profile.memory_surface,
    learn_surface: profile.learn_surface,
  });
}

function context(args) {
  const stage = getArg(args, "--stage") ?? "plan";
  if (!stageContexts[stage]) {
    fail(`Unknown stage: ${stage}. Expected one of ${Object.keys(stageContexts).join(", ")}.`);
  }
  const selected = stageContexts[stage];
  printJson({
    stage,
    required: selected.required.map((filePath) => ({ path: filePath, exists: exists(filePath) })),
    optional: selected.optional.map((filePath) => ({ path: filePath, exists: exists(filePath) })),
    blocking_checks: selected.checks,
  });
}

function verify(args) {
  const scope = getArg(args, "--scope") ?? "all";
  const run = args.includes("--run");
  const commands = commandsForScope(scope);
  if (!run) {
    printJson({ mode: "dry-run", scope, commands });
    return;
  }

  for (const command of commands) {
    console.log(`$ ${command}`);
    const result = spawnSync(command, { cwd: repoRoot, shell: true, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function audit() {
  const checks = [
    ["policy", exists(surfaces.policy), surfaces.policy],
    ["architecture", exists(surfaces.architecture), surfaces.architecture],
    ["operator_surface", exists(surfaces.operatorSurface), surfaces.operatorSurface],
    ["harness_config", exists(surfaces.harnessConfig), surfaces.harnessConfig],
    ["stage_context", exists(surfaces.hooks), surfaces.hooks],
    ["memory", exists(surfaces.memory), surfaces.memory],
    ["learn", exists(surfaces.learn), surfaces.learn],
    ["feedback", exists(surfaces.feedbackLog) && exists(surfaces.promotionBacklog), `${surfaces.feedbackLog}, ${surfaces.promotionBacklog}`],
    ["data_verify", scriptNames().includes("validate:data"), "package.json scripts.validate:data"],
    ["active_graph_scope_verify", scriptNames().includes("check:active-graph-scope"), "package.json scripts.check:active-graph-scope"],
    ["gate_verify", scriptNames().includes("gate"), "package.json scripts.gate"],
    ["code_verify", scriptNames().includes("lint") && scriptNames().includes("build"), "package.json scripts.lint/build"],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  const failed = checks.filter(([, ok]) => !ok).map(([name, , pathName]) => ({ name, path: pathName }));
  printJson({
    score: `${passed}/${checks.length}`,
    percent: Math.round((passed / checks.length) * 100),
    failed,
    top_actions: failed.slice(0, 5).map((item) => `Fix ${item.name} at ${item.path}.`),
  });
}

function handoff() {
  printJson({
    target_surface: surfaces.memory,
    template: {
      status: "",
      owner: "",
      branch: "",
      worktree: repoRoot,
      files_or_artifacts: [],
      commands_or_evidence: [],
      current_findings: [],
      next_steps: [],
      blockers_or_open_questions: [],
      human_feedback: "",
      feedback_scope: "one-off | candidate default | confirmed default",
      promotion_candidates: [],
      canonical_doc_follow_up: [],
    },
  });
}

function start() {
  printJson({
    sequence: [
      "npm run agent:context -- --stage plan",
      "Read AGENTS.md, README.md, docs/ARCHITECTURE.md, and the current plan.",
      "Classify whether changes touch graph data, gate logic, TypeScript/React code, or docs only.",
      "Use repo-native helpers and keep graph claims explicit.",
    ],
  });
}

function finish() {
  printJson({
    sequence: [
      "npm run agent:context -- --stage verify",
      "npm run agent:verify -- --scope <data|code|all> --run",
      "Summarize changed files, verification outcomes, any intentionally generated artifacts, and remaining risks.",
      "Record durable feedback in docs/agent-learn.md or docs/feedback-log.md when applicable.",
    ],
  });
}

function commandsForScope(scope) {
  if (scope === "data") return verifyCommands.data;
  if (scope === "code") return verifyCommands.code;
  if (scope === "all") return [...verifyCommands.data, ...verifyCommands.code];
  fail(`Unknown scope: ${scope}. Expected data, code, or all.`);
}

function getArg(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command = "briefing", ...args] = process.argv.slice(2);

switch (command) {
  case "detect":
    detect();
    break;
  case "doctor":
    doctor();
    break;
  case "briefing":
    briefing();
    break;
  case "context":
    context(args);
    break;
  case "verify":
    verify(args);
    break;
  case "audit":
    audit();
    break;
  case "handoff":
    handoff();
    break;
  case "start":
    start();
    break;
  case "finish":
    finish();
    break;
  default:
    fail(`Unknown command: ${command}`);
}
