#!/usr/bin/env python3
"""Apply round-2 patch files to the live ai_compute_chain data files.

Patch format (per docs/agents dispatch):
{
  "node_patches":   [{"id", "set"?, "replace_metrics"?, "append_metrics"?,
                      "append_evidenceIds"?, "append_tags"?, "append_notes"?}],
  "evidence_patches":[{"id", "set"}],
  "edge_patches":   [{"id", "set"}],
  "remove_node_ids": [...],
  "remove_edge_ids": [...]
}
Mechanical only; every action logged. Run validate:data afterwards.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODES_F = ROOT / "data/nodes/ai_compute_chain.json"
EDGES_F = ROOT / "data/edges/ai_compute_chain_edges.json"
EV_F = ROOT / "data/evidence/ai_compute_chain_evidence.json"
# Cross-domain org enrichment: shared orgs (org_ibiden, org_tsmc, ...) live in
# the parcel data file; patches may legitimately target them there.
PARCEL_NODES_F = ROOT / "data/nodes/parcel_sorting_robot.json"


def main(patch_paths):
    nodes = json.load(open(NODES_F))
    edges = json.load(open(EDGES_F))
    evidence = json.load(open(EV_F))
    parcel_nodes = json.load(open(PARCEL_NODES_F))
    n_by_id = {n["id"]: n for n in nodes}
    parcel_only_ids = set()
    for n in parcel_nodes:
        if n["id"] not in n_by_id:
            parcel_only_ids.add(n["id"])
            n_by_id[n["id"]] = n
    parcel_dirty = False
    e_by_id = {e["id"]: e for e in edges}
    ev_by_id = {e["id"]: e for e in evidence}
    log = []

    for pp in patch_paths:
        p = json.load(open(pp))
        tag = Path(pp).stem
        for np_ in p.get("node_patches", []):
            n = n_by_id.get(np_["id"])
            if not n:
                log.append(f"WARN {tag}: node not found {np_['id']}")
                continue
            if np_["id"] in parcel_only_ids:
                parcel_dirty = True
                log.append(f"{tag}: (cross-domain) patching parcel-file node {np_['id']}")
            for k, v in (np_.get("set") or {}).items():
                n[k] = v
                log.append(f"{tag}: {n['id']}.{k} set")
            for rm in np_.get("replace_metrics") or []:
                mets = n.setdefault("metrics", [])
                hit = next((m for m in mets if m.get("name") == rm.get("name")), None)
                if hit:
                    hit.update(rm)
                    log.append(f"{tag}: {n['id']} metric replaced: {rm.get('name')}")
                else:
                    mets.append(rm)
                    log.append(f"{tag}: {n['id']} metric added (replace->append): {rm.get('name')}")
            for am in np_.get("append_metrics") or []:
                mets = n.setdefault("metrics", [])
                if any(m.get("name") == am.get("name") for m in mets):
                    log.append(f"WARN {tag}: {n['id']} metric exists, skipped: {am.get('name')}")
                    continue
                mets.append(am)
                log.append(f"{tag}: {n['id']} metric appended: {am.get('name')}")
            if np_.get("append_evidenceIds"):
                n["evidenceIds"] = list(dict.fromkeys((n.get("evidenceIds") or []) + np_["append_evidenceIds"]))
                log.append(f"{tag}: {n['id']} evidenceIds += {len(np_['append_evidenceIds'])}")
            if np_.get("append_tags"):
                n["tags"] = list(dict.fromkeys((n.get("tags") or []) + np_["append_tags"]))
                log.append(f"{tag}: {n['id']} tags += {np_['append_tags']}")
            if np_.get("append_domain"):
                n["domain"] = list(dict.fromkeys((n.get("domain") or []) + np_["append_domain"]))
                log.append(f"{tag}: {n['id']} domain += {np_['append_domain']}")
            if np_.get("append_notes"):
                n["notes"] = ((n.get("notes") or "") + ("\n" if n.get("notes") else "") + np_["append_notes"]).strip()
                log.append(f"{tag}: {n['id']} notes appended")
        for ep in p.get("evidence_patches", []):
            ev = ev_by_id.get(ep["id"])
            if not ev:
                log.append(f"WARN {tag}: evidence not found {ep['id']}")
                continue
            ev.update(ep.get("set") or {})
            log.append(f"{tag}: evidence {ep['id']} set {sorted((ep.get('set') or {}).keys())}")
        for gp in p.get("edge_patches", []):
            e = e_by_id.get(gp["id"])
            if not e:
                log.append(f"WARN {tag}: edge not found {gp['id']}")
                continue
            e.update(gp.get("set") or {})
            log.append(f"{tag}: edge {gp['id']} set {sorted((gp.get('set') or {}).keys())}")
        for rid in p.get("remove_edge_ids", []):
            if rid in e_by_id:
                edges.remove(e_by_id.pop(rid))
                log.append(f"{tag}: edge removed {rid}")
                for ev in evidence:
                    if rid in (ev.get("supportsEdgeIds") or []):
                        ev["supportsEdgeIds"].remove(rid)
        for rid in p.get("remove_node_ids", []):
            if rid not in n_by_id:
                log.append(f"WARN {tag}: remove target missing {rid}")
                continue
            nodes.remove(n_by_id.pop(rid))
            log.append(f"{tag}: node removed {rid}")
            for e in [x for x in edges if x["source"] == rid or x["target"] == rid]:
                edges.remove(e)
                e_by_id.pop(e["id"], None)
                log.append(f"{tag}:   cascade edge removed {e['id']}")
            for ev in evidence:
                if rid in (ev.get("supportsNodeIds") or []):
                    ev["supportsNodeIds"].remove(rid)
                    if not ev.get("supportsNodeIds") and not ev.get("supportsEdgeIds"):
                        log.append(f"WARN {tag}: evidence {ev['id']} now supports nothing")

    targets = [(NODES_F, nodes), (EDGES_F, edges), (EV_F, evidence)]
    if parcel_dirty:
        targets.append((PARCEL_NODES_F, parcel_nodes))
    for f, data in targets:
        with open(f, "w") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
    print("\n".join(log))
    print(f"\napplied {len(patch_paths)} patch files; nodes={len(nodes)} edges={len(edges)} evidence={len(evidence)}")


if __name__ == "__main__":
    main(sys.argv[1:])
