#!/usr/bin/env python3
"""Apply the orchestrator's verification verdicts (2026-06-11, fetched + quote-
checked in the main loop) to the four rebuild packages, then emit one clean
import batch + one clean patch file.

Verdict ledger (per evidence id):
  ok_exact   = orchestrator fetched the URL and confirmed the quote + scope
  rewrite    = page verified but agent excerpt contained fabricated parts
  drop       = no verifiable source (dead URL / number absent everywhere)
"""
import json
from pathlib import Path

R6 = Path(__file__).resolve().parent
ROOT = R6.parents[1]

live_nodes = {n["id"]: n for n in json.load(open(ROOT / "data/nodes/ai_compute_chain.json"))}
live_edges = json.load(open(ROOT / "data/edges/ai_compute_chain_edges.json"))
live_sigs = {(e["source"], e["relation"], e["target"]) for e in live_edges}

OUT = {"nodes": [], "edges": [], "evidence": [], "tasks": []}
PATCH = {"node_patches": [], "evidence_patches": []}
log = []

# ---------- evidence verdicts ----------
DROP_EV = {
    "ev_acc_r6h_samsung_hbm_share_2026",   # URL 404 (likely invented slug); mid-20%/28% unsourced
    "ev_acc_r6l_tsmc_capacity_wiki",       # wiki-only capacity figure; not load-bearing
}
REWRITE = {
  "ev_acc_r6h_skhynix_hbm_share_2026": dict(
    excerpt="SK hynix is forecast to retain over 50% share and lead the market.",
    summary="TrendForce (2025-09-17): SK hynix forecast to retain OVER 50% of global HBM bit output in 2026. Scope: bit-output share. NOTE: precise 50/59/28 trajectory in an earlier draft was NOT on the page and was removed at verification.",
    sourceStatus="ok_exact"),
  "ev_acc_r6h_samsung_hbm_capacity_2026": dict(sourceStatus="ok_exact"),
  "ev_acc_r6h_micron_hbm4_ramp_2026": dict(
    excerpt="Micron has already locked in pricing and volume agreements covering its entire calendar 2026 HBM supply, including HBM4.",
    summary="TrendForce (2025-12-18): Micron's entire calendar-2026 HBM supply is pre-sold (pricing+volume locked), HBM4 ramps 2Q26. The '15,000 wafers/month' figure in an earlier draft was NOT on the page and was removed at verification.",
    sourceStatus="ok_exact"),
  "ev_acc_r6h_hbm_total_capacity_bits_2026": dict(
    excerpt="TrendForce projects HBM shipments will surpass 30 billion Gb by 2026.",
    sourceStatus="ok_exact"),
  "ev_acc_r6h_sk_m15x_fab_capacity": dict(sourceStatus="ok_exact"),
  "ev_acc_r6h_hbm_hybrid_bonding_yield": dict(
    summary="TrendForce (2026-04-29): SK hynix completed 12-high hybrid-bonding HBM validation; yields being raised for mass production. No yield percentages disclosed.",
    sourceStatus="ok_exact"),
  "ev_acc_r6h_hanmi_tc_bonder_lead_time": dict(
    title="Hanmi leads emerging HBF (high-bandwidth flash) TC bonder race; first deliveries 2H26",
    summary="TrendForce (2026-06-05): Hanmi prepares FIRST HBF TC bonder deliveries in 2H26 and is furthest along. SCOPE: HBF (high-bandwidth FLASH) — an adjacent emerging market, NOT the existing HBM TC bonder business where Hanmi already ships. Verification re-scoped this record to the Hanmi org node.",
    supportsNodeIds=["org_hanmi_semiconductor"],
    sourceStatus="ok_exact"),
  "ev_acc_r6h_advantest_ate_lead_time": dict(
    excerpt="As demand strengthens in markets such as GPUs and high-bandwidth memory (HBM), Japan-based Advantest said orders for semiconductor automated test equipment (ATE) remain stable, with average product lead times exceeding six months.",
    sourceStatus="ok_exact"),
  "ev_acc_r6h_asmpt_hbm4_bonder_orders": dict(
    excerpt="SK Hynix has reportedly placed a new order for thermal compression (TC) bonders with Singapore-based ASMPT as it accelerates preparations for HBM4.",
    summary="DigiTimes (2025-12-15): SK hynix placed new HBM4 TC bonder order with ASMPT. Unit counts ('fifty sets') sit behind the paywall and were removed at verification.",
    sourceStatus="paywalled_snippet"),
  "ev_acc_r6l_asml_euv_2025": dict(
    excerpt="System sales in units: 48 EUV lithography systems (of 535 total systems sold in 2025).",
    sourceStatus="ok_exact"),
  "ev_acc_r6l_asml_litho_share": dict(
    summary="Tertiary source (Wikipedia, fetched 2026-06-11): ~83% of worldwide lithography-equipment sales. Treat as approximate; primary scoped source still wanted.",
    sourceStatus="fetch_ok"),
  "ev_acc_r6l_asml_sole_supplier": dict(sourceStatus="fetch_ok"),
  "ev_acc_r6l_zeiss_sole_source": dict(sourceStatus="fetch_ok"),
  "ev_acc_r6l_zeiss_asml_partnership": dict(
    excerpt="ASML buys 24.9% of ZEISS subsidiary Carl Zeiss SMT for EUR 1 billion in cash... ASML supports Carl Zeiss SMT's R&D and capex for approximately EUR 760 million over the next 6 years (EUR 220M R&D + EUR 540M capex/supply-chain).",
    sourceStatus="ok_exact"),
  "ev_acc_r6l_tsmc_foundry_wiki": dict(
    title="TrendForce 4Q25 foundry ranking: TSMC 70.4% share of top-10 foundry revenue",
    url="https://www.trendforce.com/presscenter/news/20260312-12965.html",
    sourceName="TrendForce",
    date="2026-03-12",
    excerpt="TSMC to maintain its leading position with a 70.4% market share... the combined revenue of the world's top ten foundries up 2.6% QoQ to nearly US$46.3 billion in 4Q25.",
    summary="TrendForce press release (2026-03-12): TSMC 70.4% share in 4Q25. SCOPE: revenue share among the top-10 global foundries. Replaces the Wikipedia tertiary source at verification.",
    sourceStatus="ok_exact"),
  "ev_acc_r6o_coherent_inp_capacity": dict(
    summary="optics.org: Coherent CEO — InP laser capacity constrained; capacity to double over the next 12 months. Page blocks automated fetch; verified manually by the owner in the 2026-06-11 audit (citation [11]).",
    sourceStatus="ok_exact"),
  "ev_acc_r6o_eml_supplier_share": dict(
    excerpt="(paywalled report; landing page lists scope only)",
    summary="Yole optical-transceiver report (paywalled): EML/DFB long-reach laser supply concentrated among a small set of suppliers (Coherent, Lumentum, Mitsubishi Electric class). The earlier '70-75% top-3 share' precision is NOT visible outside the paywall and was downgraded at verification.",
    sourceStatus="paywalled_snippet"),
  "ev_acc_r6_euv_blanks_agc_hoya_duopoly": dict(
    excerpt="AGC Inc. stands as the undisputed global leader, commanding more than 59% of the market... AGC Inc. and Hoya Corporation collectively holding approximately 93% of the market share.",
    summary="intelmarketresearch.com (SEO-grade market report): AGC >59%, AGC+Hoya ~93% combined, basis implied value. NOTE: the page contains NO High-NA segment share data — a 'Hoya exceeds 75% by volume in High-NA' sentence in an earlier draft was fabricated and removed at verification.",
    sourceStatus="market_report_seo"),
  "ev_acc_r6_high_na_hoya_lead_position": dict(
    excerpt="HOYA has unveiled new advancements in EUV photomask blanks... one of the few capable players in this highly specialized domain.",
    summary="semiconductorinsight.com blog: Hoya described as ONE OF THE FEW capable players. The page does NOT say 'only vendor with validated High-NA blanks' (an earlier draft's quote was fabricated; removed at verification). No supporting citations on page.",
    sourceStatus="fetch_ok"),
  "ev_acc_r6_asml_high_na_timeline": dict(
    excerpt="The first High NA EUV lithography system was delivered in December 2023... expected to be used in high-volume manufacturing in 2025-2026.",
    sourceStatus="ok_exact"),
}
META_NO_URL = {"ev_acc_r6_euv_blanks_market_conflict_note", "ev_acc_r6_high_na_qualification_unverified"}

for f in ["batch_hbm_rebuild", "batch_litho_rebuild", "batch_optics_rebuild", "batch_euvblanks_rebuild"]:
    b = json.load(open(R6 / f"{f}.json"))
    for n in b.get("nodes", []):
        # rebuilds may not create nodes: _r6l duplicates dropped; existing-id
        # "updates" move to patches
        if n["id"] in live_nodes:
            PATCH["node_patches"].append({"id": n["id"], "set": {k: v for k, v in n.items() if k in ("description", "notes", "confidence")},
                                          "replace_metrics": n.get("metrics") or []})
            log.append(f"{f}: node-update {n['id']} -> patch")
        else:
            log.append(f"{f}: DROP stray new node {n['id']}")
    for e in b.get("edges", []):
        sig = (e["source"], e["relation"], e["target"])
        if any(x.endswith("_r6l") for x in (e["source"], e["target"])):
            log.append(f"{f}: DROP edge to stray node {e['id']}")
            continue
        if sig in live_sigs:
            log.append(f"{f}: drop dup edge {e['id']}")
            continue
        OUT["edges"].append(e)
    for ev in b.get("evidence", []):
        if ev["id"] in DROP_EV:
            log.append(f"{f}: DROP evidence {ev['id']}")
            continue
        if ev["id"] in REWRITE:
            ev.update(REWRITE[ev["id"]])
            log.append(f"{f}: verdict applied {ev['id']} -> {ev.get('sourceStatus')}")
        if ev["id"] in META_NO_URL:
            ev.pop("sourceStatus", None)  # ok_exact is reviewer-granted; meta notes carry none
            log.append(f"{f}: stripped self-granted ok_exact on {ev['id']}")
        OUT["evidence"].append(ev)

# ---------- patch files (normalize key variants) ----------
def norm_patch(d):
    nps = d.get("node_patches") or d.get("node_updates") or d.get("updates") or d.get("nodes") or []
    out = []
    for p in nps:
        pid = p.get("id") or p.get("nodeId")
        if not pid or pid not in live_nodes:
            log.append(f"patch: DROP for unknown node {pid}")
            continue
        q = {"id": pid}
        for k in ("set", "replace_metrics", "append_metrics", "append_evidenceIds", "append_tags", "append_notes"):
            if p.get(k) is not None:
                q[k] = p[k]
        # flat-form tolerance: description/metrics/etc. at top level
        flat_set = {k: v for k, v in p.items() if k in ("description", "notes", "confidence", "maturityScore", "maturityLabel", "maturityAsOf", "evidenceIds", "bottleneckOf")}
        if flat_set:
            q.setdefault("set", {}).update(flat_set)
        if p.get("metrics") is not None:
            q["replace_metrics"] = p["metrics"]
        out.append(q)
    return out, d.get("evidence_patches", [])

for f in ["patch_hbm_rebuild", "patch_litho_rebuild", "patch_optics_rebuild", "patch_euvblanks_rebuild"]:
    p = R6 / f"{f}.json"
    if not p.exists():
        continue
    nps, eps = norm_patch(json.load(open(p)))
    PATCH["node_patches"].extend(nps)
    PATCH["evidence_patches"].extend(eps)
    log.append(f"{f}: {len(nps)} node patches, {len(eps)} evidence patches")

# ---------- scrub fabricated numbers from patch content ----------
BAD_FRAGMENTS = ["15,000 wafers", "15000 wafers", "40,000 wafers", "fifty sets", "50 sets",
                 "down from 59", "20% to 28%", "28% share", "~22%", "mid-20", "70-75% of the EML",
                 "75% by volume", "only vendor with validated", ">95% N3", "95% utilization",
                 "18-24 month", "18–24 month", "14-month", "14 month optics"]
def scrub(text):
    flagged = [b for b in BAD_FRAGMENTS if b.lower() in (text or "").lower()]
    return flagged
removed = 0
for np_ in PATCH["node_patches"]:
    s = np_.get("set", {})
    for k in ("description", "notes"):
        if k in s and scrub(s[k]):
            log.append(f"SCRUB WARNING {np_['id']}.{k}: contains {scrub(s[k])} — manual rewrite required")
            removed += 1
    kept = []
    for m in np_.get("replace_metrics", []):
        frag = scrub(json.dumps(m, ensure_ascii=False))
        if frag:
            log.append(f"SCRUB drop metric on {np_['id']}: {m.get('name')} (contains {frag})")
            removed += 1
            continue
        kept.append(m)
    if "replace_metrics" in np_:
        np_["replace_metrics"] = kept

json.dump(OUT, open(R6 / "batch_round6_final.json", "w"), indent=1, ensure_ascii=False)
json.dump(PATCH, open(R6 / "patch_round6_final.json", "w"), indent=1, ensure_ascii=False)
print("\n".join(log))
print(f"\nfinal batch: {len(OUT['edges'])} edges, {len(OUT['evidence'])} evidence; patches: {len(PATCH['node_patches'])} node, {len(PATCH['evidence_patches'])} evidence; scrub hits: {removed}")
