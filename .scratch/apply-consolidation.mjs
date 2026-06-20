// Apply round-1 consolidation edits:
//  (A) round-0 evidence verdicts onto data/evidence/space_spacex_evidence.json
//  (B) add spacex_reusable_launch domain tag to reused cross-domain orgs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const ASOF = "2026-06-15";

// ---------- (A) round-0 evidence verdicts ----------
const evFile = "data/evidence/space_spacex_evidence.json";
const evRoot = JSON.parse(readFileSync(evFile, "utf8"));
const evArr = Array.isArray(evRoot) ? evRoot : evRoot.evidence;
const byId = new Map(evArr.map((e) => [e.id, e]));
const v = JSON.parse(readFileSync(".scratch/spacex-reusable-launch-round-0/verdicts.json", "utf8"));

for (const r of v.verified ?? []) {
  const e = byId.get(r.id); if (!e) continue;
  e.machineCheck = { status: "verified", checkedAsOf: ASOF, quoteMatch: r.quoteMatch ?? "exact",
    ...(r.numberInQuote != null ? { numberInQuote: r.numberInQuote } : {}),
    notes: (r.notes ?? "round-0 verifier").slice(0, 300) };
}
for (const r of v.repaired ?? []) {
  const e = byId.get(r.id); if (!e) continue;
  if (r.url) e.url = r.url;
  if (r.excerpt) e.excerpt = r.excerpt;
  if (r.sourceStatus) e.sourceStatus = r.sourceStatus;
  if (r.id === "ev_space_smithsonian_grid_fin") {
    e.supportsNodeIds = ["falcon9_grid_fin_reentry_control"]; // narrow: page does NOT support boostback/landing burns
  }
  e.machineCheck = { status: "verified", checkedAsOf: ASOF, quoteMatch: "exact",
    notes: ("round-0 repair (" + r.action + "): " + (r.reason ?? "")).slice(0, 300) };
}
for (const r of v.escalations ?? []) {
  const e = byId.get(r.id); if (!e) continue;
  if (e.sourceStatus === "ok_exact") e.sourceStatus = "generic_homepage"; // SPA shell, not the claim
  e.machineCheck = { status: "needs_fetch", checkedAsOf: ASOF, quoteMatch: "not_checked",
    notes: ("OWNER REVIEW: spacex.com SPA, stored excerpt not machine-verifiable. Re-anchor to verified source or confirm via browser. " + r.question).slice(0, 300) };
}
writeFileSync(evFile, JSON.stringify(evRoot, null, 2) + "\n");
console.log(`(A) evidence: ${v.verified?.length||0} verified, ${v.repaired?.length||0} repaired, ${v.escalations?.length||0} escalated`);

// ---------- (B) tag reused orgs ----------
const REUSED = ["org_eaton","org_schaeffler","org_skf","org_honeywell_aerospace_space","org_amphenol","org_te_connectivity","org_linde","org_air_liquide","org_dupont"];
const TAG = "spacex_reusable_launch";
const found = new Set();
for (const f of readdirSync("data/nodes").filter((n) => n.endsWith(".json"))) {
  const p = "data/nodes/" + f;
  const root = JSON.parse(readFileSync(p, "utf8"));
  const arr = Array.isArray(root) ? root : root.nodes;
  let changed = false;
  for (const n of arr) {
    if (REUSED.includes(n.id)) {
      n.domain = n.domain ?? [];
      if (!n.domain.includes(TAG)) { n.domain.push(TAG); changed = true; }
      found.add(n.id);
    }
  }
  if (changed) writeFileSync(p, JSON.stringify(root, null, 2) + "\n");
}
console.log(`(B) tagged reused orgs: ${[...found].join(", ")}`);
const missing = REUSED.filter((o) => !found.has(o));
if (missing.length) console.log(`(B) WARN not found (skipped): ${missing.join(", ")}`);
