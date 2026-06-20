import json

P = "data/evidence/ai_compute_chain_evidence.json"
data = json.load(open(P, encoding="utf-8"))
by = {r["id"]: r for r in data}
VER = {"status": "verified", "checkedAsOf": "2026-06-14", "quoteMatch": "exact"}

updates = {
    "ev_acc_pkg_ibiden_expansion": {
        "url": "https://www.agenzianova.com/en/news/NVIDIA-supplier-Ibiden-increases-substrate-production-for-generative-LIA/",
        "excerpt": "The company plans to expand its production lines from three to five by fiscal year 2025, with a 150 percent capacity increase by 2027 compared to 2024 levels.",
        "summary": "Two distinct, consistent plans: (Sept 2025 CEO Kawashima interview, via Nikkei) expand IC-substrate lines 3->5 by FY2025 with a ~150% capacity increase by 2027 vs 2024; and (Feb 2026 board plan, separately sourced) ~JPY500bn invested FY2026-2028. The two are sequential, not contradictory.",
        "sourceName": "Nikkei (CEO Kawashima interview), via Agenzia Nova",
        "date": "2025-09-22",
        "sourceStatus": "ok_exact",
        "confidence": "high",
        "limitations": "'150 percent capacity increase by 2027' wording is ambiguous (likely 'to ~150% of' 2024, i.e. +50%); keep the FY2025 line-count target and the FY2026-2028 JPY500bn plan as distinct dates.",
        "machineCheck": VER,
    },
    "ev_acc_nc4_asmpt_share_gain_1": {
        "title": "ASMPT guides 35-40% share of the expanded TCB equipment market (TAM >$1bn by 2027)",
        "url": "https://www.asmpt.com/en/investor-relations/news-events/asmpt-secures-additional-orders-for-fifteen-chip-to-substrate-thermo-compression-bonding-tools-driven-by-ai-tailwind/",
        "excerpt": "The Group is strategically positioned to capture an estimated 35% to 40% share of this expanded market.",
        "summary": "ASMPT's own forward GUIDANCE: a 35-40% share of the expanded TCB (thermo-compression bonding) equipment TAM it projects to exceed US$1bn by 2027 - a target, not a realized current share. Corroborated by I-Connect007 (non-paywalled). Hanmi's ~71% (current revenue share through Q3-2025) is a different basis.",
        "sourceName": "ASMPT IR press release + I-Connect007",
        "date": "2025-12-22",
        "sourceStatus": "ok_exact",
        "confidence": "high",
        "limitations": "Forward/target share of the expanded TAM (>US$1bn by 2027), not realized current share; different basis from Hanmi's current revenue share.",
        "machineCheck": VER,
    },
    "ev_acc_nc4_asahi_entry_1": {
        "excerpt": "Asahi Kasei has entered the AI-chip fiberglass (T-glass) cloth market to challenge Nittobo, which holds ~90% of the high-end share. Long qualification cycles mean Nittobo's dominance persists near-term; supply relief is unlikely before mid-2027.",
        "summary": "Entry + near-term Nittobo dominance are accessibly sourced (DigiTimes lead; TrendForce 2026-02-04 'Asahi Kasei and Nittobo are regarded as the two leading players'; relief not before mid-2027). The previously-claimed '12-24 month qualification cycle' could not be sourced (the only 12-18mo figure found is for PCB fabricators, not glass cloth) and has been removed.",
        "sourceName": "DigiTimes (lead) + TrendForce",
        "sourceStatus": "paywalled_snippet",
        "confidence": "medium",
        "limitations": "Body paywalled; the '12-24 month qualification cycle' was removed (unsourced at the glass-cloth basis). Qualitative claim only.",
        "machineCheck": VER,
    },
}

for cid, fields in updates.items():
    if cid not in by:
        raise SystemExit("MISSING " + cid)
    by[cid].update(fields)

json.dump(data, open(P, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
with open(P, "a", encoding="utf-8") as f:
    f.write("\n")
print("updated 3 paywalled records (2 re-sourced FOUND, 1 downgraded). reviewStatus left unflipped.")
