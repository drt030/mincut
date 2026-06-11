#!/usr/bin/env node
/**
 * Export a judgment-free summary of a domain's decomposition for eval grading
 * (see docs/agents/handoff-2026-06-10-gpu-chain.md Part 2 step 2).
 *
 * Usage: node scripts/export-decomposition.mjs <round-number>
 * Writes .eval/exports/round-<N>-decomposition.json
 */
import fs from "node:fs";
import path from "node:path";

const round = process.argv[2];
if (!round) {
  console.error("Usage: node scripts/export-decomposition.mjs <round-number>");
  process.exit(1);
}

const load = (f) => {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return Array.isArray(j) ? j : j.nodes ?? j.edges ?? [];
};

const nodes = load("data/nodes/ai_compute_chain.json");
const edges = load("data/edges/ai_compute_chain_edges.json");
const out = nodes
  .filter((n) => ["module", "material", "manufacturing_process", "equipment"].includes(n.kind))
  .map((n) => {
    const tags = n.tags ?? [];
    const frontier = tags.includes("decomposition_frontier") || Boolean(n.frontierFor?.length);
    const boundary = (n.notes ?? "").match(/SCOPE BOUNDAR[YIES]*[^]*?(?=\n|$)/)?.[0];
    return {
      id: n.id,
      name: n.name,
      bottleneckOf: n.bottleneckOf ?? [],
      maturity: n.maturityScore,
      orgs: edges
        .filter((e) => e.relation === "manufactured_by" && e.source === n.id)
        .map((e) => e.target),
      // Scope decisions must be visible to graders: a documented boundary
      // reads as a judgment, a silent absence reads as a miss (brief §2.12).
      ...(frontier ? { frontier: true } : {}),
      ...(boundary ? { boundaryNote: boundary.slice(0, 300) } : {}),
    };
  });

fs.mkdirSync(".eval/exports", { recursive: true });
const dest = path.join(".eval/exports", `round-${round}-decomposition.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log("exported", out.length, "components ->", dest);
