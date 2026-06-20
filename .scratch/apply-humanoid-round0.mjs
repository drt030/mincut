import { readFileSync, writeFileSync } from "node:fs";
const ASOF = "2026-06-15";
const ef = "data/evidence/humanoid_robotics_evidence.json";
const root = JSON.parse(readFileSync(ef, "utf8"));
const arr = Array.isArray(root) ? root : root.evidence;
const byId = new Map(arr.map((e) => [e.id, e]));
const v = JSON.parse(readFileSync(".scratch/humanoid-round0/verdicts.json", "utf8"));
let vc = 0, rc = 0, ec = 0, miss = [];
for (const r of v.verified ?? []) {
  const e = byId.get(r.id); if (!e) { miss.push(r.id); continue; }
  e.machineCheck = { status: "verified", checkedAsOf: ASOF, quoteMatch: r.quoteMatch ?? "exact",
    ...(r.numberInQuote != null ? { numberInQuote: r.numberInQuote } : {}), notes: (r.notes ?? "round0").slice(0,280) };
  vc++;
}
for (const r of v.repaired ?? []) {
  const e = byId.get(r.id); if (!e) { miss.push(r.id); continue; }
  if (r.url) e.url = r.url;
  if (r.excerpt) e.excerpt = r.excerpt;
  if (r.sourceStatus) e.sourceStatus = r.sourceStatus;
  if (r.basis) e.limitations = (e.limitations ? e.limitations + "; " : "") + ("basis: " + r.basis);
  const rejected = r.action === "reject";
  e.machineCheck = { status: rejected ? "failed" : "verified", checkedAsOf: ASOF, quoteMatch: rejected ? "absent" : "exact",
    notes: (`round0 ${r.action}: ${r.reason ?? ""}`).slice(0,280) };
  rc++;
}
for (const r of v.escalations ?? []) {
  const e = byId.get(r.id); if (!e) { miss.push(r.id); continue; }
  e.machineCheck = { status: "needs_fetch", checkedAsOf: ASOF, quoteMatch: "not_checked",
    notes: ("OWNER REVIEW: " + (r.question ?? "")).slice(0,280) };
  ec++;
}
writeFileSync(ef, JSON.stringify(root, null, 2) + "\n");
writeFileSync(".scratch/humanoid-round0/ESCALATIONS.json", JSON.stringify(v.escalations ?? [], null, 2) + "\n");
console.log(`humanoid round0 applied: ${vc} verified, ${rc} repaired, ${ec} escalated${miss.length ? " | NOT FOUND: " + miss.join(",") : ""}`);
