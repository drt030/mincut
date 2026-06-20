import json

P = "data/evidence/ai_compute_chain_evidence.json"
data = json.load(open(P, encoding="utf-8"))
by = {r["id"]: r for r in data}

VER = {"status": "verified", "checkedAsOf": "2026-06-14", "quoteMatch": "exact"}
EST = {"status": "failed", "checkedAsOf": "2026-06-14",
       "notes": "best-estimate, not source-verified; see limitations"}

updates = {
    # ── RE-SOURCED (found authoritative source + verbatim quote) ──
    "ev_acc_pkg_tsmc_capacity": {
        "url": "https://www.trendforce.com/news/2024/10/21/news-cowos-capacity-doubles-for-two-years-still-insufficient-positive-outlook-for-suppliers/",
        "excerpt": "TSMC's CoWoS monthly capacity is expected to reach 35,000 to 40,000 wafers this year [2024] ... potentially reaching 140,000 to 150,000 wafers per month by 2026.",
        "summary": "2024 TrendForce/MoneyDJ projection of TSMC CoWoS monthly wafer capacity scaling toward 140,000-150,000 wafers/month by 2026. Aggressive AI-demand scenario; TrendForce's own later (Dec 2024) estimate is more conservative (~90,000/month by end-2026).",
        "sourceName": "TrendForce (Oct 2024, citing MoneyDJ)",
        "date": "2024-10-21",
        "sourceStatus": "ok_exact",
        "confidence": "high",
        "limitations": "Projection made in 2024 for 2026; other estimates (incl. TrendForce Dec-2024) run lower (~90k/month). Basis: monthly CoWoS wafer capacity.",
        "machineCheck": VER,
    },
    "ev_acc_nc4_nittobo_monopoly_1": {
        "url": "https://insights.trendforce.com/p/glass-fiber-cloth-shortage",
        "excerpt": "Nittobo, the leading manufacturer holding approximately 90% market share in T-glass and 60-70% in NER-glass ... raised prices across its glass fiber product line by 20% in August 2025, and plans another increase of roughly 20%-30% in April 2026.",
        "summary": "TrendForce: Nittobo holds ~90% of the high-end T-glass market; raised glass-fiber prices ~20% (Aug 2025) with a further ~20-30% planned (Apr 2026). Price hikes are line-wide, not high-end-only.",
        "sourceName": "TrendForce Insights",
        "date": "2026-04-30",
        "sourceStatus": "ok_exact",
        "confidence": "high",
        "limitations": "~90% basis is T-glass (high-end); the 20% / 20-30% hikes are across Nittobo's glass-fiber line, not high-end-only.",
        "machineCheck": VER,
    },
    "ev_acc_pkg_test_capacity": {
        "url": "https://www.fool.com/earnings/call-transcripts/2026/04/30/cohu-cohu-q1-2026-earnings-call-transcript/",
        "excerpt": "Estimated semiconductor test utilization also increased sequentially to 78% at the end of the first quarter.",
        "summary": "Cohu-estimated blended semiconductor test-cell utilization across its installed ATE base (ALL end-markets, not HBM/advanced-package-specific): 78% at end of Q1-2026, up from 76% in December 2025 (Cohu Q4-2025 call). Used as a back-end test-tightening proxy.",
        "sourceName": "Cohu Q1-2026 earnings call (transcript)",
        "date": "2026-04-30",
        "sourceStatus": "ok_exact",
        "confidence": "high",
        "limitations": "Blended industry proxy; Cohu does not break out HBM/advanced-package test utilization. Dec-2025 76% from the Cohu Q4-2025 call (2026-02-12).",
        "machineCheck": VER,
    },
    "ev_acc_optup_eml_shortage_2024": {
        "url": "https://www.trendforce.com/presscenter/news/20251208-12823.html",
        "excerpt": "Demand for 800G+ transceivers is forecast to surge from 24M units (2025) to 63M units (2026); McKinsey projects 800-gigabit-per-second transceiver production will fall 40 to 60 percent short of demand through 2027.",
        "summary": "EML/laser is a severe optical bottleneck. The 40-60% shortfall is McKinsey's figure for 800G TRANSCEIVERS (not EML chips specifically). Separately, NVIDIA made a ~$4B EQUITY investment ($2B each in Lumentum and Coherent, Mar 2026) plus an undisclosed multibillion purchase commitment - equity, not a prepay.",
        "sourceName": "TrendForce (units) + McKinsey via TechTimes (shortfall)",
        "date": "2025-12-08",
        "sourceStatus": "fetch_ok",
        "confidence": "medium",
        "limitations": "$4B/$2B are equity investments (NVIDIA newsroom 2026-03; CNBC), NOT a prepay; the purchase commitment dollar amount is undisclosed. No published EML-chip-specific shortfall %; the 40-60% is the 800G-transceiver basis (McKinsey).",
        "machineCheck": VER,
    },
    # ── ESTIMATES (anchor exists; relabel as best-estimate + method) ──
    "ev_acc_nc4_tglass_shortage_1": {
        "url": "https://insights.trendforce.com/p/glass-fiber-cloth-shortage",
        "excerpt": "[Best-estimate] Low-Dk/T-glass cloth supply gap on the order of 30-50% across 2026, easing from ~mid-2027. No source states a precise '2H2026' cloth figure.",
        "summary": "Estimate, not a directly cited figure. Method: triangulate (a) widely-reported '>40% T-glass gap by 2026' for IC-substrate fabric and (b) China Securities' 30-50% gap for specialty low-Dk-2/low-CTE cloth (full-year 2026). Source-backed parts: qualitative shortage, +20% Aug-2025 price hike, relief not before mid-2027 (TrendForce).",
        "sourceName": "Best-estimate (TrendForce qualitative + China Securities)",
        "sourceStatus": "fetch_ok",
        "confidence": "low",
        "limitations": "Best-estimate. Exact 2H2026 cloth gap % is not published. Anchors: TrendForce glass-fiber-cloth shortage page; China Securities via huxiu.com/article/4850455.html; news.futunn.com.",
        "machineCheck": EST,
    },
    "ev_acc_hbm_tsv_bonding_yield": {
        "url": "https://newsletter.semianalysis.com/p/scaling-the-memory-wall-the-rise-and-roadmap-of-hbm",
        "excerpt": "[Best-estimate] Exact HBM stacking yields are proprietary. A first-order per-layer compounding model (~99%/layer) implies roughly 85-90% effective yield for an 8-12-high stack, lower for hybrid bonding.",
        "summary": "Estimate, not a directly cited figure. Method: per-layer yield compounding (SemiAnalysis: 8-layer at 99%/layer ~= 92%, 12-layer ~= 87%); SK hynix states HBM4 hybrid-bonding yield is 'not yet high'. The prior 68/32/70/48 yield chain was unsourced and has been removed.",
        "sourceName": "Best-estimate (SemiAnalysis model + SK hynix)",
        "date": "2026-06-14",
        "sourceStatus": "fetch_ok",
        "confidence": "low",
        "limitations": "Best-estimate from a per-layer compounding model; exact HBM stacking/bonding yields are proprietary and undisclosed.",
        "machineCheck": EST,
    },
    "ev_acc_optup_epitaxy_capacity_constraint": {
        "url": "https://www.yolegroup.com/strategy-insights/what-does-the-future-hold-for-the-compound-semiconductor-industry/",
        "excerpt": "[Best-estimate] InP epitaxy is a specialty, low-throughput step; transceiver demand is estimated to exceed InP epitaxy supply by roughly 2x (per SemiAnalysis's InP-bottleneck thesis). InP epitaxy is mostly vertically integrated.",
        "summary": "Estimate. Method/anchor: SemiAnalysis InP-bottleneck thesis for the ~2x demand/supply ratio (primary article paywalled, not directly quotable). The prior '~35% open-market / 65% integrated' split had no traceable source and has been removed.",
        "sourceName": "Best-estimate (SemiAnalysis thesis; Yole topic anchor)",
        "sourceStatus": "paywalled_snippet",
        "confidence": "low",
        "limitations": "Best-estimate. ~2x ratio anchored to SemiAnalysis (paywalled, not quotable verbatim). The 35%/65% open-vs-integrated split is removed (no traceable source).",
        "machineCheck": EST,
    },
}

changed = []
for cid, fields in updates.items():
    r = by.get(cid)
    if not r:
        print("MISSING", cid)
        continue
    r.update(fields)
    changed.append(cid)

json.dump(data, open(P, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
open(P, "a", encoding="utf-8").write("\n") if not open(P, encoding="utf-8").read().endswith("\n") else None
print("updated", len(changed), "records:", ", ".join(changed))
