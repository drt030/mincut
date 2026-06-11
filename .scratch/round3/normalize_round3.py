#!/usr/bin/env python3
"""Round-3 normalization. Mechanical only.

- strips `tasks` from every batch (owner-managed queue)
- auto-folds any batch org/node whose id already exists in the live graph
  (metrics minus listing + evidence + tags + domain + notes carried via fold patch)
- cross-batch dedupe in fixed order (later duplicate folds onto the first batch
  that introduced the id)
- remaps known-wrong patch target ids; drops patches whose target is missing
- remaps evidence supports refs and zh keys accordingly
"""
import json
from pathlib import Path

R3 = Path(__file__).resolve().parent
ROOT = R3.parents[1]

BATCHES = [
    "batch_optics_upstream.json",
    "batch_compound_upstream.json",
    "batch_interconnect_silicon.json",
    "batch_packaging_equipment.json",
    "batch_bottleneck_evidence.json",
]
PATCHES = [
    "patch_optics_upstream.json",
    "patch_compound_upstream.json",
    "patch_interconnect_silicon.json",
    "patch_packaging_equipment.json",
    "patch_bottleneck_evidence.json",
]
PATCH_ID_REMAP = {
    "org_coherent_corp": "org_ii_vi_coherent",
    "org_broadcom_corp": "org_broadcom",
}

live_node_ids = set()
for f in (ROOT / "data/nodes").glob("*.json"):
    live_node_ids |= {n["id"] for n in json.load(open(f))}
live_edges = json.load(open(ROOT / "data/edges/ai_compute_chain_edges.json"))
live_sigs = {(e["source"], e["relation"], e["target"]): e["id"] for e in live_edges}
live_ev_ids = set()
for f in (ROOT / "data/evidence").glob("*.json"):
    live_ev_ids |= {e["id"] for e in json.load(open(f))}

log = []
seen_nodes = {}   # id -> batch that introduced it
seen_ev = {}
fold_patches_all = []

for src in BATCHES:
    p = R3 / src
    if not p.exists():
        log.append(f"MISSING {src}")
        continue
    b = json.load(open(p))
    if b.get("tasks"):
        log.append(f"{src}: stripped {len(b['tasks'])} tasks")
        b["tasks"] = []
    mapping = {}
    keep_nodes = []
    for n in b.get("nodes", []):
        nid = n["id"]
        target = None
        if nid in live_node_ids:
            target = nid
            reason = "live"
        elif nid in seen_nodes:
            target = nid
            reason = f"dup of {seen_nodes[nid]}"
        if target is not None and (nid in live_node_ids or nid in seen_nodes):
            fold_patches_all.append({
                "id": target,
                "append_metrics": [m for m in (n.get("metrics") or []) if m.get("name") != "Public listing"],
                "append_evidenceIds": n.get("evidenceIds") or [],
                "append_tags": n.get("tags") or [],
                "append_domain": n.get("domain") or [],
                "append_notes": (n.get("notes") or "").strip(),
            })
            log.append(f"{src}: fold {nid} ({reason})")
            continue
        seen_nodes[nid] = src
        keep_nodes.append(n)
    b["nodes"] = keep_nodes
    keep_edges = []
    edge_remap = {}
    seen_batch_sigs = set()
    for e in b.get("edges", []):
        sig = (e["source"], e["relation"], e["target"])
        if sig in live_sigs:
            edge_remap[e["id"]] = live_sigs[sig]
            log.append(f"{src}: drop dup edge {e['id']} -> live")
            continue
        if sig in seen_batch_sigs:
            log.append(f"{src}: drop within-batch dup edge {e['id']}")
            continue
        seen_batch_sigs.add(sig)
        keep_edges.append(e)
    b["edges"] = keep_edges
    kept_edge_ids = {e["id"] for e in keep_edges}
    keep_ev = []
    for ev in b.get("evidence", []):
        if ev["id"] in live_ev_ids or ev["id"] in seen_ev:
            log.append(f"{src}: drop dup evidence {ev['id']}")
            continue
        seen_ev[ev["id"]] = src
        if ev.get("supportsEdgeIds"):
            ev["supportsEdgeIds"] = [edge_remap.get(x, x) for x in ev["supportsEdgeIds"]]
        keep_ev.append(ev)
    b["evidence"] = keep_ev
    json.dump(b, open(R3 / src.replace(".json", "_norm.json"), "w"), indent=1, ensure_ascii=False)

# patch normalization: tolerate agent schema drift (nodeId alias, remove_*
# key variants, batch-node dumps inside patch files), remap ids, keep only
# patches with resolvable targets
all_new_ids = set(seen_nodes)
for src in PATCHES:
    p = R3 / src
    if not p.exists():
        log.append(f"{src}: missing (ok — agent put everything in its batch)")
        continue
    d = json.load(open(p))
    if set(d.keys()) == {"nodes"}:
        log.append(f"{src}: ignored — redundant batch-node dump, nodes already in batch")
        continue
    out = {"node_patches": [], "evidence_patches": d.get("evidence_patches", []),
           "edge_patches": d.get("edge_patches", []),
           "remove_node_ids": d.get("remove_node_ids", d.get("remove_nodes", [])),
           "remove_edge_ids": d.get("remove_edge_ids", d.get("remove_edges", []))}
    for np_ in d.get("node_patches", []):
        nid = np_.get("id") or np_.get("nodeId")
        if not nid:
            log.append(f"{src}: DROP node_patch without id: {str(np_)[:80]}")
            continue
        np_.pop("nodeId", None)
        np_["id"] = PATCH_ID_REMAP.get(nid, nid)
        if np_["id"] not in live_node_ids and np_["id"] not in all_new_ids:
            log.append(f"{src}: DROP patch for unknown node {np_['id']}")
            continue
        out["node_patches"].append(np_)
    json.dump(out, open(R3 / src.replace(".json", "_norm.json"), "w"), indent=1, ensure_ascii=False)

json.dump({"node_patches": fold_patches_all}, open(R3 / "patch_round3_folds.json", "w"), indent=1, ensure_ascii=False)
print("\n".join(log))
print(f"\nfolds: {len(fold_patches_all)}, new nodes: {len(seen_nodes)}, new evidence: {len(seen_ev)}")
