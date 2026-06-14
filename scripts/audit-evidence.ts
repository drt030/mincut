// Evidence credibility audit — deterministic core CLI.
// Usage:
//   npx tsx scripts/audit-evidence.ts --domain ai-compute            (offline triage + report)
//   npx tsx scripts/audit-evidence.ts --domain ai-compute --refresh  (also HTTP-refresh sourceStatus)
//
// v1 scope: report + worklist only. Mechanical changes are computed in-memory
// and summarized; persisting them to data/ files (and the agent judgment layer)
// are separate steps. Number-vs-quote verification is deferred to the agent
// layer because metric nodes carry no structured numeric value field yet.
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadGraphData } from "../src/lib/graphLoader";
import { buildWorklist, applyMechanicalChanges, stampMachineChecks, type RecordAudit } from "../src/lib/evidenceAudit";
import type { Evidence, GraphData } from "../src/lib/schema";

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (flag: string) => process.argv.includes(flag);
const today = () => new Date().toISOString().slice(0, 10);

async function refreshSourceStatus(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (res.status === 404) return "404";
    if (res.status === 401 || res.status === 403) return "paywalled_snippet";
    if (!res.ok) return "unreachable";
    return "fetch_ok";
  } catch {
    return "unreachable";
  }
}

async function main() {
  const slug = arg("--domain");
  const domain = DOMAIN_ROUTES.find((d) => d.slug === slug);
  if (!domain) {
    console.error(`Unknown --domain. Choices: ${DOMAIN_ROUTES.map((d) => d.slug).join(", ")}`);
    process.exit(1);
  }
  const graph: GraphData = loadGraphData();

  // Scope to this domain: nodes tagged with the domainTag, edges touching them,
  // and evidence supporting either. (Many exposure records support only edges.)
  const domainNodeIds = new Set(
    graph.nodes.filter((n) => (n.domain ?? []).includes(domain.domainTag)).map((n) => n.id),
  );
  const domainEdgeIds = new Set(
    graph.edges.filter((e) => domainNodeIds.has(e.source) || domainNodeIds.has(e.target)).map((e) => e.id),
  );
  const inDomain = graph.evidence.filter(
    (ev) =>
      (ev.supportsNodeIds ?? []).some((id) => domainNodeIds.has(id)) ||
      (ev.supportsEdgeIds ?? []).some((id) => domainEdgeIds.has(id)),
  );

  if (has("--refresh")) {
    let n = 0;
    for (const ev of inDomain) {
      if (ev.url) {
        (ev as { sourceStatus?: string }).sourceStatus = await refreshSourceStatus(ev.url);
        n += 1;
      }
    }
    console.log(`Refreshed sourceStatus for ${n} in-domain records.`);
  }

  // High-stakes proxy: evidence supporting a bottleneck node (cheap stand-in for gate weight).
  const bottleneckNodeIds = new Set(graph.nodes.filter((n) => (n.bottleneckOf?.length ?? 0) > 0).map((n) => n.id));
  const highStakesEvidenceIds = new Set(
    inDomain.filter((ev) => (ev.supportsNodeIds ?? []).some((id) => bottleneckNodeIds.has(id))).map((ev) => ev.id),
  );

  const worklist: RecordAudit[] = buildWorklist({
    evidence: inDomain,
    supportedNumbersByEvidenceId: {}, // v1: number checks deferred to the agent layer (no metric value field yet)
    highStakesEvidenceIds,
  });
  const { changes } = applyMechanicalChanges(graph, worklist, today());

  // --write: persist machineCheck onto the evidence source file(s) that hold these ids.
  // --verdicts <file>: a judgment-layer output ({ verified:[{id}], escalations:[] }); its
  //   ids are stamped `verified` (overriding their bucket).
  if (has("--write")) {
    const verdictsPath = arg("--verdicts");
    const verifiedIds = new Set<string>(
      verdictsPath
        ? (JSON.parse(readFileSync(verdictsPath, "utf8")).verified ?? []).map((v: { id: string }) => v.id)
        : [],
    );
    const auditedIds = new Set(worklist.map((r) => r.id));
    const evDir = path.join("data", "evidence");
    let filesChanged = 0;
    for (const file of readdirSync(evDir).filter((f) => f.endsWith(".json"))) {
      const full = path.join(evDir, file);
      const records: Evidence[] = JSON.parse(readFileSync(full, "utf8"));
      if (!Array.isArray(records) || !records.some((r) => auditedIds.has(r.id))) continue;
      const stamped = stampMachineChecks(records, worklist, today(), verifiedIds);
      writeFileSync(full, JSON.stringify(stamped, null, 2) + "\n");
      filesChanged += 1;
    }
    console.log(`--write: stamped machineCheck across ${filesChanged} evidence file(s); verified=${verifiedIds.size}.`);
  }

  const outDir = `.scratch/audit-${slug}-${today()}`;
  mkdirSync(outDir, { recursive: true });
  const counts = worklist.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.bucket]: (acc[r.bucket] ?? 0) + 1 }),
    {},
  );
  writeFileSync(`${outDir}/worklist.json`, JSON.stringify({ slug, counts, worklist }, null, 2));
  writeFileSync(
    `${outDir}/report.md`,
    [
      `# Evidence audit — ${slug} (${today()})`,
      ``,
      `Scoped in-domain evidence records: ${inDomain.length}`,
      `Buckets: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" · ") || "(none)"}`,
      `Would auto-apply: demote=${changes.demoted.length}, structural_ok=${changes.markedStructuralOk.length}, failed=${changes.markedFailed.length}`,
      ``,
      `## needs_fetch (hand to the judgment subagent)`,
      ...worklist.filter((r) => r.bucket === "needs_fetch").map((r) => `- ${r.id}`),
      ``,
      `## demote (dead/wrong source → rejectedEvidenceIds)`,
      ...worklist.filter((r) => r.bucket === "demote").map((r) => `- ${r.id}: ${r.reasons.join("; ")}`),
      ``,
      `## failed (fix list)`,
      ...worklist.filter((r) => r.bucket === "failed").map((r) => `- ${r.id}: ${r.reasons.join("; ")}`),
    ].join("\n"),
  );

  console.log(`Wrote ${outDir}/report.md and worklist.json. Buckets:`, counts);
}

main();
