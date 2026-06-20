// Apply the 6 humanoid Gate-B verify lanes' verdicts (run AFTER verdict files exist).
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
const ASOF = "2026-06-15";
const VDIR = ".scratch/humanoid-verify";
const LANES = ["reducers_screws","motors_magnets","sensing","battery_power","compute_control","structure_bearings_thermal"];
const V = { verified: [], repaired: [], escalations: [], tickerAudit: [] };
let found = 0;
for (const lane of LANES) {
  const p = `${VDIR}/${lane}-verdicts.json`;
  if (!existsSync(p)) { console.log(`MISSING: ${lane}`); continue; }
  found++;
  const v = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(V)) for (const x of v[k] ?? []) V[k].push({ ...x, _lane: lane });
}
console.log(`lanes ${found}/6 | verified=${V.verified.length} repaired=${V.repaired.length} escalations=${V.escalations.length} tickerAudit=${V.tickerAudit.length}`);

const evFile = "data/evidence/humanoid_robotics_evidence.json";
const evRoot = JSON.parse(readFileSync(evFile, "utf8"));
const evArr = Array.isArray(evRoot) ? evRoot : evRoot.evidence;
const byId = new Map(evArr.map((e) => [e.id, e]));
// numberInQuote MUST be boolean or omitted (schema guard — string broke validate last time)
const boolOnly = (x) => (typeof x === "boolean" ? { numberInQuote: x } : {});
let vc = 0, rc = 0, notFound = [];
for (const r of V.verified) {
  const e = byId.get(r.id); if (!e) { notFound.push(r.id); continue; }
  e.machineCheck = { status: "verified", checkedAsOf: ASOF, quoteMatch: r.quoteMatch ?? "exact", ...boolOnly(r.numberInQuote), notes: (r.notes ?? `verified ${r._lane}`).slice(0, 280) };
  vc++;
}
for (const r of V.repaired) {
  const e = byId.get(r.id); if (!e) { notFound.push(r.id); continue; }
  if (r.url) e.url = r.url;
  if (r.excerpt) e.excerpt = r.excerpt;
  if (r.sourceStatus) e.sourceStatus = r.sourceStatus;
  const rejected = r.action === "reject";
  e.machineCheck = { status: rejected ? "failed" : "verified", checkedAsOf: ASOF, quoteMatch: rejected ? "absent" : "exact", notes: (`Gate-B repair (${r.action}): ${r.reason ?? ""}`).slice(0, 280) };
  rc++;
}
for (const r of V.escalations) {
  const e = byId.get(r.id); if (!e) { notFound.push(r.id); continue; }
  e.machineCheck = { status: "needs_fetch", checkedAsOf: ASOF, quoteMatch: "not_checked", notes: ("OWNER REVIEW: " + (r.question ?? "")).slice(0, 280) };
}
writeFileSync(evFile, JSON.stringify(evRoot, null, 2) + "\n");
console.log(`evidence: verified ${vc}, repaired ${rc}${notFound.length ? `, NOT FOUND: ${notFound.join(",")}` : ""}`);

const wrong = V.tickerAudit.filter((t) => t.verdict === "wrong");
let tf = 0;
if (wrong.length) {
  const byOrg = new Map(wrong.map((t) => [t.orgId, t]));
  for (const f of readdirSync("data/nodes").filter((n) => n.endsWith(".json"))) {
    const p = "data/nodes/" + f; const root = JSON.parse(readFileSync(p, "utf8")); const arr = Array.isArray(root) ? root : root.nodes; let ch = false;
    for (const n of arr) { const t = byOrg.get(n.id); if (t) { if (t.correctTicker !== undefined) n.ticker = t.correctTicker || undefined; if (t.correctListingStatus) n.listingStatus = t.correctListingStatus; ch = true; tf++; } }
    if (ch) writeFileSync(p, JSON.stringify(root, null, 2) + "\n");
  }
}
console.log(`tickers: ${wrong.length} wrong, ${tf} fixed${wrong.length ? " -> " + wrong.map((t) => `${t.orgId}:${t.storedTicker}->${t.correctTicker}`).join(", ") : ""}`);
writeFileSync(`${VDIR}/ESCALATIONS.json`, JSON.stringify(V.escalations, null, 2) + "\n");
console.log(`escalations -> ${VDIR}/ESCALATIONS.json (${V.escalations.length})`);
