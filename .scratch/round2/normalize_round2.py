#!/usr/bin/env python3
"""Normalize round-2 agent outputs before import/apply. Mechanical only.

1. batch_logic.json: fold duplicate orgs onto existing ids (alias map), retarget
   edges, drop semantic-duplicate edges, emit fold patches for metric/evidence
   carry-over -> batch_logic_norm.json + patch_logic_fold.json
2. patch_substrate.json: relocate embedded new evidence + new edges into
   batch_fixups.json (patches may only modify existing records).
3. patch_optics.json: strip unsourced append_metrics on org_philips_lumileds
   (keeps confidence downgrade + notes).
"""
import json
from pathlib import Path

R2 = Path(__file__).resolve().parent
ROOT = R2.parents[1]

ALIASES = {
    "org_samsung_electronics": "org_samsung",
    "org_agc_inc": "org_agc",
    "org_hoya_corporation": "org_hoya",
}

# Fold/rename plans per batch: FOLDS merge a duplicate company into an existing
# node (metrics/evidence carried via patch); RENAMES are pure id normalization
# inside the batch (no existing target node).
BATCH_PLANS = {
    "batch_logic.json": {
        "folds": dict(ALIASES),
        "renames": {},
        "out": "batch_logic_norm.json",
        "fold_patch": "patch_logic_fold.json",
    },
    "batch_optics.json": {
        "folds": {"org_coherent_corp": "org_ii_vi_coherent"},
        "renames": {
            "org_mitsubishi_electric_optics": "org_mitsubishi_electric",
            "org_sumitomo_electric_optics": "org_sumitomo_electric",
            "org_innolight_shanghai": "org_innolight",
            "org_eoptolink_china": "org_eoptolink",
        },
        "out": "batch_optics_norm.json",
        "fold_patch": "patch_optics_fold.json",
    },
    "batch_cooling_power.json": {
        "folds": {},
        "renames": {
            "org_schneider_electric_cooling": "org_schneider_electric",
            "org_coolitsystems": "org_coolit_systems",
        },
        "out": "batch_cooling_power_norm.json",
        "fold_patch": "patch_cooling_power_fold.json",
    },
}

live_edges = json.load(open(ROOT / "data/edges/ai_compute_chain_edges.json"))
live_sigs = {(e["source"], e["relation"], e["target"]) for e in live_edges}
live_edge_ids = {e["id"] for e in live_edges}
live_node_ids = set()
for f in (ROOT / "data/nodes").glob("*.json"):
    live_node_ids |= {n["id"] for n in json.load(open(f))}

log = []

# ---- 1. generic batch fold/rename plans ----
# After explicit renames, ANY batch node whose id already exists in the live
# graph is auto-folded: metrics (minus listing) + evidence + notes carried via
# patch, edges keep pointing at the existing id, node dropped. This is the
# cross-domain shared-org case (e.g. Mitsubishi Electric, Schneider exist in
# the parcel domain).
live_sig_to_id = {(e["source"], e["relation"], e["target"]): e["id"] for e in live_edges}
for src, plan in BATCH_PLANS.items():
    b = json.load(open(R2 / src))
    mapping = dict(plan["folds"])
    fold_patches2 = []
    keep = []
    for n in b["nodes"]:
        nid = plan["renames"].get(n["id"], n["id"])
        if nid != n["id"]:
            log.append(f"{src}: rename {n['id']} -> {nid}")
            mapping[n["id"]] = nid
            n["id"] = nid
        if n["id"] in plan["folds"] or n["id"] in live_node_ids:
            target = plan["folds"].get(n["id"], n["id"])
            mapping.setdefault(n["id"], target)
            fold_patches2.append({
                "id": target,
                "append_metrics": [m for m in (n.get("metrics") or []) if m.get("name") != "Public listing"],
                "append_evidenceIds": n.get("evidenceIds") or [],
                "append_tags": [t for t in (n.get("tags") or []) if t],
                "append_domain": [d for d in (n.get("domain") or []) if d],
                "append_notes": (n.get("notes") or "").strip(),
            })
            log.append(f"{src}: fold {n['id']} -> {target} (exists in live graph)")
            continue
        keep.append(n)
    b["nodes"] = keep
    keep_e = []
    edge_id_remap = {}
    for e in b["edges"]:
        e["source"] = mapping.get(e["source"], e["source"])
        e["target"] = mapping.get(e["target"], e["target"])
        sig = (e["source"], e["relation"], e["target"])
        if sig in live_sigs:
            edge_id_remap[e["id"]] = live_sig_to_id[sig]
            log.append(f"{src}: drop duplicate edge {e['id']} -> live {live_sig_to_id[sig]}")
            continue
        keep_e.append(e)
    b["edges"] = keep_e
    kept_edge_ids = {e["id"] for e in keep_e}
    for ev in b.get("evidence", []):
        if ev.get("supportsNodeIds"):
            ev["supportsNodeIds"] = [mapping.get(x, x) for x in ev["supportsNodeIds"]]
        if ev.get("supportsEdgeIds"):
            ev["supportsEdgeIds"] = [edge_id_remap.get(x, x) for x in ev["supportsEdgeIds"]]
            ev["supportsEdgeIds"] = [x for x in ev["supportsEdgeIds"] if x in kept_edge_ids or x in live_edge_ids]
    json.dump(b, open(R2 / plan["out"], "w"), indent=1, ensure_ascii=False)
    if plan["fold_patch"] and fold_patches2:
        json.dump({"node_patches": fold_patches2}, open(R2 / plan["fold_patch"], "w"), indent=1, ensure_ascii=False)
    # rename zh sidecar keys too; folded ids keep their zh (nodes exist live)
    zh_name = src.replace("batch_", "zh_")
    zp = R2 / zh_name
    if zp.exists():
        zh = json.load(open(zp))
        zh = {mapping.get(k, k): v for k, v in zh.items()}
        json.dump(zh, open(zp, "w"), indent=1, ensure_ascii=False)

# ---- 2. patch_substrate relocation ----
ps = json.load(open(R2 / "patch_substrate.json"))
fixups = {"nodes": [], "edges": [], "evidence": [], "tasks": []}
fixups["evidence"] = ps.pop("evidence", [])
keep_edge_patches = []
for ep in ps.get("edge_patches", []):
    if ep["id"] in live_edge_ids:
        keep_edge_patches.append(ep)
        continue
    body = ep.get("set") or {}
    if {"source", "target", "relation"} <= set(body):
        fixups["edges"].append({"id": ep["id"], **body})
        log.append(f"relocate new edge {ep['id']} to fixups batch")
    elif {"source", "target", "relation"} <= set(ep):
        fixups["edges"].append({k: v for k, v in ep.items() if k != "set"} | (ep.get("set") or {}))
        log.append(f"relocate new edge {ep['id']} to fixups batch (flat form)")
    else:
        log.append(f"WARN edge_patch {ep['id']}: unknown edge and incomplete fields -> dropped")
ps["edge_patches"] = keep_edge_patches
json.dump(ps, open(R2 / "patch_substrate_norm.json", "w"), indent=1, ensure_ascii=False)
json.dump(fixups, open(R2 / "batch_fixups.json", "w"), indent=1, ensure_ascii=False)

# ---- 3. patch_optics strip unsourced number ----
po = json.load(open(R2 / "patch_optics.json"))
for np_ in po.get("node_patches", []):
    if np_["id"] == "org_philips_lumileds" and np_.get("append_metrics"):
        log.append(f"strip unsourced metrics on org_philips_lumileds: {[m['name'] for m in np_['append_metrics']]}")
        np_.pop("append_metrics")
json.dump(po, open(R2 / "patch_optics_norm.json", "w"), indent=1, ensure_ascii=False)

print("\n".join(log))
