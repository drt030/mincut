// Apply the 6 Gate-B verify lanes' verdicts (run AFTER all verdict files exist).
//   verified[]  -> machineCheck:{status:"verified",...} on the evidence record
//   repaired[]  -> excerpt/url/sourceStatus patched + machineCheck verified
//   escalations[] -> collected to ESCALATIONS.json for the Gate E owner queue
//   tickerAudit[] verdict:"wrong" -> fix ticker/listingStatus on the org node (any node file)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
const ASOF = "2026-06-15";
const VDIR = ".scratch/spacex-reusable-launch-verify";
const LANES = ["thermal_protection","propellants_gases","composites_copv","structural_metals","avionics_radhard","actuation_engine_merchant"];

// gather verdicts
const V = { verified: [], repaired: [], escalations: [], tickerAudit: [] };
let lanesFound = 0;
for (const lane of LANES) {
  const p = `${VDIR}/${lane}-verdicts.json`;
  if (!existsSync(p)) { console.log(`MISSING verdicts: ${lane} (skipping — rerun when present)`); continue; }
  lanesFound++;
  const v = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(V)) for (const x of v[k] ?? []) V[k].push({ ...x, _lane: lane });
}
console.log(`lanes applied: ${lanesFound}/6 | verified=${V.verified.length} repaired=${V.repaired.length} escalations=${V.escalations.length} tickerAudit=${V.tickerAudit.length}`);

// ---- evidence: apply verified + repaired to the round-1 evidence file ----
const evFile = "data/evidence/spacex_reusable_launch_evidence.json";
const evRoot = JSON.parse(readFileSync(evFile, "utf8"));
const evArr = Array.isArray(evRoot) ? evRoot : evRoot.evidence;
const evById = new Map(evArr.map((e) => [e.id, e]));
let vApplied = 0, rApplied = 0, notFound = [];
for (const r of V.verified) {
  const e = evById.get(r.id); if (!e) { notFound.push(r.id); continue; }
  e.machineCheck = { status: "verified", checkedAsOf: ASOF, quoteMatch: r.quoteMatch ?? "exact",
    ...(r.numberInQuote != null ? { numberInQuote: r.numberInQuote } : {}),
    notes: (r.notes ?? `verified ${r._lane}`).slice(0, 280) };
  vApplied++;
}
for (const r of V.repaired) {
  const e = evById.get(r.id); if (!e) { notFound.push(r.id); continue; }
  if (r.url) e.url = r.url;
  if (r.excerpt) e.excerpt = r.excerpt;
  if (r.sourceStatus) e.sourceStatus = r.sourceStatus;
  const verified = r.action !== "reject";
  e.machineCheck = { status: verified ? "verified" : "failed", checkedAsOf: ASOF, quoteMatch: verified ? "exact" : "absent",
    notes: (`Gate-B repair (${r.action}): ${r.reason ?? ""}`).slice(0, 280) };
  rApplied++;
}
writeFileSync(evFile, JSON.stringify(evRoot, null, 2) + "\n");
console.log(`evidence: machineCheck verified on ${vApplied}, repaired ${rApplied}${notFound.length ? `, NOT FOUND: ${notFound.join(", ")}` : ""}`);

// ---- tickers: fix wrong ones on whichever node file holds the org ----
const wrong = V.tickerAudit.filter((t) => t.verdict === "wrong");
let tFixed = 0;
if (wrong.length) {
  const byId = new Map(wrong.map((t) => [t.orgId, t]));
  for (const f of readdirSync("data/nodes").filter((n) => n.endsWith(".json"))) {
    const p = "data/nodes/" + f;
    const root = JSON.parse(readFileSync(p, "utf8"));
    const arr = Array.isArray(root) ? root : root.nodes;
    let changed = false;
    for (const n of arr) {
      const t = byId.get(n.id);
      if (t) {
        if (t.correctTicker !== undefined) n.ticker = t.correctTicker || undefined;
        if (t.correctListingStatus) n.listingStatus = t.correctListingStatus;
        changed = true; tFixed++;
      }
    }
    if (changed) writeFileSync(p, JSON.stringify(root, null, 2) + "\n");
  }
}
console.log(`tickers: ${wrong.length} flagged wrong, ${tFixed} fixed${wrong.length ? " -> " + wrong.map((t) => `${t.orgId}:${t.storedTicker}->${t.correctTicker}`).join(", ") : ""}`);

// ---- escalations -> owner-queue input ----
writeFileSync(`${VDIR}/ESCALATIONS.json`, JSON.stringify(V.escalations, null, 2) + "\n");
console.log(`escalations -> ${VDIR}/ESCALATIONS.json (${V.escalations.length}) for Gate E owner queue`);
