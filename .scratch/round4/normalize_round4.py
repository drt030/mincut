#!/usr/bin/env python3
"""Round-4 normalization. Mechanical only. Mirrors round-3 logic plus:
- explicit fold org_coherent -> org_ii_vi_coherent (third alias for Coherent Corp)
- CDU cap trim: drop (cooling_distribution_unit_cdu -> org_auras) manufactured_by
  edge; demote to an additional-supply-base note (concentration-first cap rule)
"""
import json
from pathlib import Path

R4 = Path(__file__).resolve().parent
ROOT = R4.parents[1]

BATCHES = ["batch_supplier_breadth.json", "batch_narrow_corners.json", "batch_tickers_r3.json"]
PATCHES = ["patch_supplier_breadth.json", "patch_narrow_corners.json", "patch_tickers_r3.json"]
FOLDS = {
    "org_coherent": "org_ii_vi_coherent",
    # semantic duplicates of existing component nodes
    "inp_substrate_wafer_supply_bottleneck": "inp_gaas_substrate_wafer",
    "nittobo_t_glass_fiber_monopoly": "t_glass_fabric",
}
# id should name the component, never the supplier or the verdict
RENAMES = {
    "high_na_euv_mask_blank_hoya_exclusive": "high_na_euv_mask_blanks",
    "hoya_core_euv_mask_blanks_duopoly_hoya_dominant": "euv_mask_blanks",
    "hbm_specialized_thermocompression_bonding_equipment": "hbm_tc_bonding_equipment",
}
NAME_OVERRIDES = {
    "high_na_euv_mask_blanks": "High-NA EUV mask blanks",
    "euv_mask_blanks": "EUV mask blanks",
    "hbm_tc_bonding_equipment": "HBM thermocompression bonding equipment",
}
DROP_EDGES_BY_SIG = {("cooling_distribution_unit_cdu", "manufactured_by", "org_auras")}

live_node_ids = set()
for f in (ROOT / "data/nodes").glob("*.json"):
    live_node_ids |= {n["id"] for n in json.load(open(f))}
live_edges = json.load(open(ROOT / "data/edges/ai_compute_chain_edges.json"))
live_sigs = {(e["source"], e["relation"], e["target"]): e["id"] for e in live_edges}
live_ev_ids = set()
for f in (ROOT / "data/evidence").glob("*.json"):
    live_ev_ids |= {e["id"] for e in json.load(open(f))}

log, seen_nodes, seen_ev, fold_patches = [], {}, {}, []

for src in BATCHES:
    p = R4 / src
    if not p.exists():
        log.append(f"MISSING {src}")
        continue
    b = json.load(open(p))
    if b.get("tasks"):
        log.append(f"{src}: stripped {len(b['tasks'])} tasks")
        b["tasks"] = []
    mapping = dict(FOLDS)
    keep_nodes = []
    for n in b.get("nodes", []):
        if n["id"] in RENAMES:
            mapping[n["id"]] = RENAMES[n["id"]]
            log.append(f"{src}: rename {n['id']} -> {RENAMES[n['id']]}")
            n["id"] = RENAMES[n["id"]]
            if n["id"] in NAME_OVERRIDES:
                n["name"] = NAME_OVERRIDES[n["id"]]
        nid = n["id"]
        if nid in FOLDS or nid in live_node_ids or nid in seen_nodes:
            target = FOLDS.get(nid, nid)
            fold_patches.append({
                "id": target,
                "append_metrics": [m for m in (n.get("metrics") or []) if m.get("name") != "Public listing"],
                "append_evidenceIds": n.get("evidenceIds") or [],
                "append_tags": n.get("tags") or [],
                "append_domain": n.get("domain") or [],
                "append_notes": (n.get("notes") or "").strip(),
            })
            log.append(f"{src}: fold {nid} -> {target}")
            continue
        seen_nodes[nid] = src
        keep_nodes.append(n)
    b["nodes"] = keep_nodes
    keep_edges, edge_remap, batch_sigs = [], {}, set()
    for e in b.get("edges", []):
        e["source"] = mapping.get(e["source"], e["source"])
        e["target"] = mapping.get(e["target"], e["target"])
        sig = (e["source"], e["relation"], e["target"])
        if sig in DROP_EDGES_BY_SIG:
            log.append(f"{src}: CAP TRIM drop edge {e['id']} ({e['source']} -> {e['target']})")
            continue
        if sig in live_sigs:
            edge_remap[e["id"]] = live_sigs[sig]
            log.append(f"{src}: drop dup edge {e['id']}")
            continue
        if sig in batch_sigs:
            continue
        batch_sigs.add(sig)
        keep_edges.append(e)
    b["edges"] = keep_edges
    kept_edge_ids = {e["id"] for e in keep_edges}
    keep_ev = []
    for ev in b.get("evidence", []):
        if ev["id"] in live_ev_ids or ev["id"] in seen_ev:
            log.append(f"{src}: drop dup evidence {ev['id']}")
            continue
        seen_ev[ev["id"]] = src
        if ev.get("supportsNodeIds"):
            ev["supportsNodeIds"] = [mapping.get(x, x) for x in ev["supportsNodeIds"]]
        if ev.get("supportsEdgeIds"):
            ev["supportsEdgeIds"] = [edge_remap.get(x, x) for x in ev["supportsEdgeIds"]]
            ev["supportsEdgeIds"] = [x for x in ev["supportsEdgeIds"] if x in kept_edge_ids or x in {e["id"] for e in live_edges}]
        keep_ev.append(ev)
    b["evidence"] = keep_ev
    json.dump(b, open(R4 / src.replace(".json", "_norm.json"), "w"), indent=1, ensure_ascii=False)
    zp = R4 / src.replace("batch_", "zh_")
    if zp.exists():
        zh = json.load(open(zp))
        zh = {mapping.get(k, k): v for k, v in zh.items()}
        json.dump(zh, open(zp, "w"), indent=1, ensure_ascii=False)

# CDU demotion note (cap rule)
fold_patches.append({
    "id": "cooling_distribution_unit_cdu",
    "append_notes": "Additional supply base beyond the 5-org cap (concentration-first): Auras Technology (6288.TW), high-growth Taiwan thermal/CDU maker per DigiTimes 2026-04 AI-server thermal tracker; wired to thermal_management_module instead.",
})

all_new_ids = set(seen_nodes)
for src in PATCHES:
    p = R4 / src
    if not p.exists():
        log.append(f"{src}: missing (ok)")
        continue
    d = json.load(open(p))
    if set(d.keys()) == {"nodes"}:
        log.append(f"{src}: ignored — redundant node dump")
        continue
    out = {"node_patches": [], "evidence_patches": d.get("evidence_patches", []),
           "edge_patches": d.get("edge_patches", []),
           "remove_node_ids": d.get("remove_node_ids", d.get("remove_nodes", [])),
           "remove_edge_ids": d.get("remove_edge_ids", d.get("remove_edges", []))}
    for np_ in d.get("node_patches", []):
        nid = np_.get("id") or np_.get("nodeId")
        if not nid:
            log.append(f"{src}: DROP node_patch without id")
            continue
        np_.pop("nodeId", None)
        np_["id"] = FOLDS.get(nid, nid)
        if np_["id"] not in live_node_ids and np_["id"] not in all_new_ids:
            log.append(f"{src}: DROP patch for unknown node {np_['id']}")
            continue
        out["node_patches"].append(np_)
    json.dump(out, open(R4 / src.replace(".json", "_norm.json"), "w"), indent=1, ensure_ascii=False)

json.dump({"node_patches": fold_patches}, open(R4 / "patch_round4_folds.json", "w"), indent=1, ensure_ascii=False)
print("\n".join(log))
print(f"\nfolds: {len(fold_patches)}, new nodes: {len(seen_nodes)}, new evidence: {len(seen_ev)}")
