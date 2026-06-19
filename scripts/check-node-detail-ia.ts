import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { auditNodeDetailIa, type NodeDetailIaIssue } from "../src/lib/nodeDetailIaAudit";

const showAllDetails = process.argv.includes("--details");
const failOnError = process.argv.includes("--fail-on-error") || process.argv.includes("--fail-on-warn");
const failOnWarn = process.argv.includes("--fail-on-warn");
const maxDetailsPerDomain = Number(
  process.argv.find((arg) => arg.startsWith("--max-details="))?.replace("--max-details=", "") ?? 12,
);

function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function formatCounts(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => `${key}=${count}`)
    .join(" ");
}

function formatIssue(issue: NodeDetailIaIssue): string {
  const parts = [
    issue.severity.toUpperCase(),
    issue.kind,
    issue.nodeId,
    issue.edgeId ? `edge=${issue.edgeId}` : null,
    issue.orgId ? `org=${issue.orgId}` : null,
    issue.evidenceId ? `evidence=${issue.evidenceId}` : null,
  ].filter(Boolean);
  return `  - ${parts.join(" ")} :: ${issue.message}`;
}

const allIssues: NodeDetailIaIssue[] = [];

for (const domain of DOMAIN_ROUTES) {
  const graph = loadActiveGraphData(domain.rootId);
  const issues = auditNodeDetailIa(graph, { domainSlug: domain.slug, rootId: domain.rootId });
  allIssues.push(...issues);

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warn").length;
  const kindCounts = countBy(issues.map((issue) => issue.kind));
  const summary = [
    `${domain.slug}: root=${domain.rootId}`,
    `nodes=${graph.nodes.length}`,
    `issues=${issues.length}`,
    `errors=${errors}`,
    `warnings=${warnings}`,
    formatCounts(kindCounts),
  ].filter(Boolean).join(" ");
  console.log(summary);

  const details = showAllDetails ? issues : issues.slice(0, maxDetailsPerDomain);
  for (const issue of details) console.log(formatIssue(issue));
  if (!showAllDetails && issues.length > maxDetailsPerDomain) {
    console.log(`  ... ${issues.length - maxDetailsPerDomain} more; rerun with --details to list all.`);
  }
}

const totalErrors = allIssues.filter((issue) => issue.severity === "error").length;
const totalWarnings = allIssues.filter((issue) => issue.severity === "warn").length;
console.log(`Node detail IA audit complete: errors=${totalErrors} warnings=${totalWarnings}`);

if ((failOnError && totalErrors > 0) || (failOnWarn && totalWarnings > 0)) {
  process.exit(1);
}
