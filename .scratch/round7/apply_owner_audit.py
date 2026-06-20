#!/usr/bin/env python3
"""Apply the 2026-06-11 owner audit prescription (second pass).

P0 hard blockers (#14 #10 #2 #13), P1 claim-scope rewrites (#1 #3 #4 #7 #8),
P2 touch (#6 83% demotion), plus a GLOBAL bad-evidence demotion sweep:
any evidence with sourceStatus in BAD set stops supporting nodes/edges and
moves to node.rejectedEvidenceIds with a reason in the record's limitations.
Every action printed. Mechanical execution of owner-specified wording only.
"""
import json

NODES_F = "data/nodes/ai_compute_chain.json"
EDGES_F = "data/edges/ai_compute_chain_edges.json"
EV_F = "data/evidence/ai_compute_chain_evidence.json"
BAD = {"404", "unreachable", "wrong_topic", "generic_homepage", "market_report_seo"}
BAD_REASON = {
    "404": "URL dead; cannot support claim",
    "unreachable": "URL unreachable at audit time; cannot support claim",
    "wrong_topic": "page content unrelated to the claim",
    "generic_homepage": "generic homepage/section page; not claim-specific",
    "market_report_seo": "SEO-grade market report; below source bar for quantified claims",
}

nodes = json.load(open(NODES_F))
edges = json.load(open(EDGES_F))
evidence = json.load(open(EV_F))
n = {x["id"]: x for x in nodes}
ev = {x["id"]: x for x in evidence}
log = []

# ---------- global bad-evidence demotion ----------
for node in nodes:
    if "ai_compute_chain" not in (node.get("domain") or []):
        continue
    keep, rejected = [], list(node.get("rejectedEvidenceIds") or [])
    for eid in node.get("evidenceIds") or []:
        st = (ev.get(eid) or {}).get("sourceStatus")
        if st in BAD:
            rejected.append(eid)
            log.append(f"demote {node['id']}: {eid} [{st}]")
        else:
            keep.append(eid)
    if rejected:
        node["evidenceIds"] = keep
        node["rejectedEvidenceIds"] = list(dict.fromkeys(rejected))
for rec in evidence:
    st = rec.get("sourceStatus")
    if st in BAD:
        rec["limitations"] = BAD_REASON[st]
        # stop supporting nodes via supportsNodeIds; keep the trail on the node side
        if rec.get("supportsNodeIds"):
            for nid in rec["supportsNodeIds"]:
                target = n.get(nid)
                if target is not None and "ai_compute_chain" in (target.get("domain") or []):
                    rej = list(dict.fromkeys((target.get("rejectedEvidenceIds") or []) + [rec["id"]]))
                    target["rejectedEvidenceIds"] = rej
            log.append(f"unsupport {rec['id']}: supportsNodeIds {rec['supportsNodeIds']} -> rejected trail")
            rec["supportsNodeIds"] = []
for e in edges:
    bad_here = [i for i in (e.get("evidenceIds") or []) if (ev.get(i) or {}).get("sourceStatus") in BAD]
    if bad_here:
        e["evidenceIds"] = [i for i in e["evidenceIds"] if i not in bad_here]
        log.append(f"edge {e['id']}: dropped bad evidence {bad_here}")

# ---------- new verified evidence (orchestrator-fetched 2026-06-11) ----------
evidence.append({
    "id": "ev_acc_r7_cowos_fully_booked",
    "type": "news",
    "title": "TSMC CoWoS-L/S reportedly fully booked; OSAT partners step up (ASE CoWoP)",
    "url": "https://www.trendforce.com/news/2025/12/08/news-tsmcs-cowos-l-s-reportedly-fully-booked-osat-partners-step-up-with-ases-cowop-in-focus/",
    "sourceName": "TrendForce",
    "date": "2025-12-08",
    "sourceStatus": "ok_exact",
    "excerpt": "TSMC's entire CoWoS lineup to full capacity, with both CoWoS-L and CoWoS-S fully booked. ... TSMC aims to scale monthly CoWoS capacity from today's 75,000–80,000 wafers to as high as 120,000–130,000 [by the end of 2026]. ... ASE's CoWoS capacity to jump to 20,000–25,000 wafers per month by year-end.",
    "summary": "Quote-verified by orchestrator 2026-06-11. NOTE: no booked-through end date is stated; '>85% pre-locked by top customers' does NOT appear in this source and was removed from the claim.",
    "supportsNodeIds": ["silicon_interposer_rdl"],
    "reviewStatus": "unreviewed",
})
evidence.append({
    "id": "ev_acc_r7_ecolab_coolit",
    "type": "news",
    "title": "Ecolab to acquire CoolIT Systems (definitive agreement, ~$4.75B cash)",
    "url": "https://investor.ecolab.com/news/news-details/2026/Ecolab-to-Acquire-CoolIT-Systems-a-Global-Leader-in-Advanced-Liquid-Cooling-for-Next-Gen-AI-Data-Centers/default.aspx",
    "sourceName": "Ecolab Investor Relations",
    "date": "2026-03-20",
    "sourceStatus": "ok_exact",
    "excerpt": "Ecolab announced today that it has entered into a definitive agreement to acquire CoolIT Systems ... approximately $4.75 billion in cash ... a high-growth, high-margin leader in liquid cooling technology for next-gen AI data centers.",
    "summary": "Primary IR source, quote-verified by orchestrator 2026-06-11. Ownership event (pending close), not a manufacturing relationship.",
    "supportsNodeIds": ["org_coolit_systems"],
    "reviewStatus": "unreviewed",
})
ev = {x["id"]: x for x in evidence}

# ---------- P0 #14 CDU ----------
cdu = n["cooling_distribution_unit_cdu"]
cdu.pop("bottleneckOf", None)
cdu["metrics"] = [m for m in (cdu.get("metrics") or [])
                  if not any(k in m["name"].lower() for k in ("concentration", "lead time", "share"))]
cdu["description"] = ("Coolant distribution units (CDUs) for direct liquid cooling of AI racks. "
    "Demand is rising sharply with AI rack deployment; vendors include Vertiv, CoolIT Systems, "
    "Schneider Electric and Motivair. Market-concentration and lead-time quantification removed "
    "pending verifiable sourcing (owner audit 2026-06-11): gating status requires procurement / "
    "earnings-call / supply-chain-survey evidence.")
cdu["confidence"] = "medium"
log.append("P0 #14: CDU degraded to qualitative; bottleneckOf removed")

nodes.append({
    "id": "org_ecolab",
    "name": "Ecolab",
    "kind": "organization",
    "domain": ["ai_compute_chain", "investable_supplier", "liquid_cooling"],
    "description": "US water/hygiene/industrial-services group; entered a definitive agreement to acquire CoolIT Systems (announced 2026-03-20, ~$4.75B cash, pending close), bringing a leading direct-liquid-cooling vendor under its ownership.",
    "confidence": "high",
    "tags": ["acquirer", "public_company"],
    "notes": "Listing metric deliberately omitted: ticker not yet IR-verified per round-2 rule (verify before adding; expected NYSE listing).",
    "evidenceIds": ["ev_acc_r7_ecolab_coolit"],
    "reviewStatus": "unreviewed",
    "maturityLabel": "unknown",
})
edges.append({
    "id": "e_acc_r7_org_coolit_systems__owned_by__org_ecolab",
    "source": "org_coolit_systems",
    "target": "org_ecolab",
    "relation": "owned_by",
    "claim": "Ecolab entered a definitive agreement to acquire CoolIT Systems (announced 2026-03-20, ~$4.75B cash, pending close). Ownership event per ADR-0009 — not a manufacturing relationship.",
    "confidence": "high",
    "evidenceIds": ["ev_acc_r7_ecolab_coolit"],
    "reviewStatus": "unreviewed",
})
log.append("P0 #14: org_ecolab + owned_by edge added (IR-sourced, ok_exact)")

# ---------- P0 #10 InP substrate ----------
inp = n["inp_gaas_substrate_wafer"]
inp.pop("bottleneckOf", None)
inp["metrics"] = [m for m in (inp.get("metrics") or [])
                  if not any(k in (m["name"] + (m.get("description") or "")).lower()
                             for k in ("demand", "supply ratio", "lead time", "combined", "share"))]
inp["description"] = ("Single-crystal InP/GaAs substrate wafers feeding compound-semiconductor device "
    "fabrication (lasers, photodiodes). Merchant supply is reported to be concentrated among JX "
    "Advanced Metals, Sumitomo Electric and AXT, with capacity expansions underway. Claim split per "
    "owner audit 2026-06-11: demand/supply ratios, combined-share percentages and furnace lead times "
    "removed pending exact-quote sourcing; device-level laser capacity constraints are claimed on "
    "eml_dfb_laser_diodes (Coherent CEO statement), not on this substrate node.")
inp["confidence"] = "medium"
log.append("P0 #10: InP substrate split to qualitative; bottleneckOf removed")

# ---------- P0 #2 High-NA blanks ----------
hna = n["high_na_euv_mask_blanks"]
hna.pop("bottleneckOf", None)
hna["tags"] = list(dict.fromkeys((hna.get("tags") or []) + ["watchlist", "reported_capability"]))
for e in edges:
    if e["source"] == "high_na_euv_mask_blanks" and e["relation"] == "manufactured_by":
        e["relation"] = "reported_capable_supplier"
        e["confidence"] = "low"
        e["claim"] = ("Hoya is reported as one of few capable High-NA EUV mask-blank players; "
                      "qualification/exclusivity unverified (owner audit 2026-06-11, ADR-0009 relation).")
        log.append(f"P0 #2: edge {e['id']} retyped manufactured_by -> reported_capable_supplier (low)")

# ---------- P0 #13 EUV blanks share split disputed ----------
blanks = n["euv_mask_blanks"]
blanks["metrics"] = [m for m in (blanks.get("metrics") or []) if "share" not in m["name"].lower()]
blanks["description"] = ("EUV mask blanks (multilayer Mo/Si on low-defect substrates) — the feedstock "
    "tier of EUV photomask production. Two-supplier structure: Hoya and AGC. The SHARE SPLIT between "
    "them is DISPUTED (owner audit 2026-06-11): an SEO-grade report shows AGC-led figures while the "
    "legacy Hoya-led split has no surviving source; no numeric split is asserted until a "
    "qualification-grade source exists. The duopoly structure itself is well supported.")
if "ev_acc_r6_euv_blanks_agc_hoya_duopoly" in ev:
    ev["ev_acc_r6_euv_blanks_agc_hoya_duopoly"]["reviewStatus"] = "disputed"  # owner-instructed 2026-06-11
    ev["ev_acc_r6_euv_blanks_agc_hoya_duopoly"]["limitations"] = (
        "Share split disputed by owner audit 2026-06-11: SEO-grade source (AGC-led) conflicts with "
        "unsourced legacy claim (Hoya-led). Duopoly structure usable; numeric split is not.")
for e in edges:
    if e["source"] == "euv_mask_blanks" and e["relation"] == "manufactured_by":
        e["confidence"] = "medium"
log.append("P0 #13: share metrics stripped; duopoly kept; split evidence marked disputed (owner-instructed)")

# ---------- P1 rewrites ----------
tg = n["t_glass_fabric"]
tg["metrics"] = [m for m in (tg.get("metrics") or [])
                 if not any(k in m["name"].lower() for k in ("share", "gap", "shortage"))]
tg["description"] = ("T-glass (low-CTE specialty glass fiber cloth) for AI package substrates. Supply is "
    "highly concentrated around Nittobo; TrendForce/DigiTimes/Fusion report tight supply and "
    "Nittobo/Nan Ya capacity expansion into 2027. The exact share figure (legacy '91%') and any "
    "'no second source qualified' claim remain unverified and are not asserted (owner audit "
    "2026-06-11); alternative suppliers are reported to be in qualification/ramp.")
log.append("P1 #1: t_glass conservative rewrite; 91% + no-second-source removed")

hanmi_eq = n["hbm_tc_bonding_equipment"]
for m in hanmi_eq.get("metrics") or []:
    if "71" in str(m.get("currentValue", "")):
        m["name"] = "Hanmi HBM TC bonder revenue share (through Q3 2025)"
        m["description"] = ("Revenue-share basis, through Q3 2025, media citing TechInsights. Scope per "
                            "owner audit 2026-06-11; not a unit/capacity share.")
hanmi_eq["metrics"] = [m for m in (hanmi_eq.get("metrics") or []) if "lead" not in m["name"].lower()]
hanmi_eq["description"] = ("Thermocompression bonders specialized for HBM stack assembly. Hanmi "
    "Semiconductor is reported as the leading supplier (revenue share through Q3 2025, media citing "
    "TechInsights), with ASMPT and peers competing for HBM4-generation orders. Delivery lead-time "
    "figures removed pending direct quotes (owner audit 2026-06-11).")
log.append("P1 #3: Hanmi share scoped (revenue, through Q3'25); lead time removed")

abf = n["abf_build_up_film"]
abf["metrics"] = [m for m in (abf.get("metrics") or [])
                  if not any(k in m["name"].lower() for k in ("share", "price"))]
abf["description"] = ("Ajinomoto Build-up Film (ABF) — the critical dielectric material class for "
    "high-layer-count IC package substrates. Ajinomoto has announced/invested capacity expansion "
    "through 2030. Per owner audit 2026-06-11 the claim is split: exact market share requires a "
    "dedicated source (public estimates vary widely, incl. activist-cited ~95%); price increases are "
    "REPORTED PRESSURE/PROPOSALS (Reuters Breakingviews 2026-04), not announced increases — neither "
    "is asserted as fact here.")
log.append("P1 #4: ABF split into share/capex/price-pressure; unverified numbers removed")

disco_n = n["singulation_laser_dicing_systems"]
disco_n["metrics"] = [m for m in (disco_n.get("metrics") or [])
                      if not any(k in m["name"].lower() for k in ("share", "lead"))]
disco_n["description"] = ("Wafer dicing/singulation systems (blade and laser) for advanced packaging. "
    "DISCO is a leading supplier in this tool class. Exact market-share and lead-time figures removed "
    "pending TechInsights/Gartner-grade or company-disclosure sourcing (owner audit 2026-06-11).")
log.append("P1 #7: DISCO conservative rewrite; 70-80% + 6-9mo removed")

rdl = n["silicon_interposer_rdl"]
rdl["metrics"] = [m for m in (rdl.get("metrics") or []) if "pre-lock" not in m["name"].lower() and "lock" not in m["name"].lower()]
rdl["description"] = ("Silicon interposer / RDL capacity inside TSMC's CoWoS flow. CoWoS-L and CoWoS-S "
    "are reported fully booked (no booked-through end date stated in the source). TSMC aims to scale "
    "monthly CoWoS capacity from 75,000–80,000 to as high as 120,000–130,000 wafers by the end of "
    "2026; ASE's CoWoS capacity is projected to reach 20,000–25,000 wafers/month by year-end "
    "(TrendForce 2025-12-08, quote-verified). The legacy '>85% pre-locked by top customers' figure "
    "does not appear in the source and was removed (owner audit 2026-06-11).")
rdl["evidenceIds"] = list(dict.fromkeys((rdl.get("evidenceIds") or []) + ["ev_acc_r7_cowos_fully_booked"]))
log.append("P1 #8: interposer rewritten on quote-verified ramp; >85% pre-lock removed")

# ---------- P2 #6 ASML 83% demotion ----------
asml_n = n["asml_lithography_systems"]
asml_n["metrics"] = [m for m in (asml_n.get("metrics") or []) if "83" not in str(m.get("currentValue", ""))]
asml_n["description"] = ("EUV lithography systems. ASML is the dominant lithography supplier and the "
    "sole EUV system supplier; 48 EUV systems were sold in 2025 (ASML annual report, quote-verified). "
    "The legacy '~83% lithography share' figure is tertiary-sourced and per owner audit 2026-06-11 is "
    "not displayed as a number; lead-time figures removed earlier as unsourced.")
log.append("P2 #6: 83% demoted to qualitative dominance; 48-units kept")

with open(NODES_F, "w") as f:
    json.dump(nodes, f, indent=2, ensure_ascii=False); f.write("\n")
with open(EDGES_F, "w") as f:
    json.dump(edges, f, indent=2, ensure_ascii=False); f.write("\n")
with open(EV_F, "w") as f:
    json.dump(evidence, f, indent=2, ensure_ascii=False); f.write("\n")
print("\n".join(log))
print(f"\nnodes={len(nodes)} edges={len(edges)} evidence={len(evidence)}")
