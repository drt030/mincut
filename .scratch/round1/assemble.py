#!/usr/bin/env python3
"""Round-1 batch assembly: mechanical merge of per-module decomposer batches.

Merges .scratch/round1/batch_<module>.json files into one import-ready batch:
  - drops nodes whose id already exists in the live graph (cross-domain org reuse)
  - dedupes nodes repeated across batches (keeps the richer record)
  - dedupes edges by id and by (source, relation, target)
  - drops edges whose endpoints are missing, loudly
  - dedupes evidence by id (identical -> drop, conflicting -> error)
  - merges zh_<module>.json sidecars and reports zh coverage gaps

Mechanical only: no content is authored here.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R1 = ROOT / ".scratch" / "round1"

MODULES = [
    "logic_die_fabrication",
    "advanced_packaging",
    "high_bandwidth_memory",
    "substrate_and_interposer",
    "interconnect_and_optics",
    "power_delivery",
    "thermal_cooling",
]

# Same company, different ids across batches -> canonical id. Applied to node
# ids, edge endpoints, and evidence supportsNodeIds before dedupe.
ORG_ALIASES = {
    "org_nanya_pcb": "org_nan_ya_pcb",
    "org_unimicron_technology": "org_unimicron",
}


def canon(nid):
    return ORG_ALIASES.get(nid, nid)


def load_live_ids():
    ids = set()
    for sub in ("nodes", "edges", "evidence"):
        for f in (ROOT / "data" / sub).glob("*.json"):
            for rec in json.load(open(f)):
                ids.add(rec["id"])
    return ids


def richness(node):
    return (
        len(node.get("metrics", [])),
        len(node.get("evidenceIds", [])),
        len(json.dumps(node)),
    )


def main():
    live_ids = load_live_ids()
    merged = {"nodes": [], "edges": [], "evidence": [], "tasks": []}
    zh = {}
    nodes_by_id, edges_by_id, ev_by_id = {}, {}, {}
    edge_sig = set()
    report = {"dropped_existing": [], "deduped_nodes": [], "dropped_edges": [],
              "deduped_edges": 0, "deduped_evidence": 0, "missing": [], "conflicts": []}

    for m in MODULES:
        bp = R1 / f"batch_{m}.json"
        if not bp.exists():
            report["missing"].append(m)
            continue
        b = json.load(open(bp))
        for n in b.get("nodes", []):
            n["id"] = canon(n["id"])
            nid = n["id"]
            if nid in live_ids:
                report["dropped_existing"].append(f"{m}:{nid}")
                continue
            if nid in nodes_by_id:
                old = nodes_by_id[nid]
                keep = n if richness(n) > richness(old) else old
                # union evidenceIds so neither batch's sourcing is lost
                ev_union = list(dict.fromkeys((old.get("evidenceIds") or []) + (n.get("evidenceIds") or [])))
                if ev_union:
                    keep["evidenceIds"] = ev_union
                nodes_by_id[nid] = keep
                report["deduped_nodes"].append(f"{m}:{nid}")
                continue
            nodes_by_id[nid] = n
        for e in b.get("edges", []):
            e["source"], e["target"] = canon(e["source"]), canon(e["target"])
            sig = (e["source"], e["relation"], e["target"])
            if e["id"] in edges_by_id or sig in edge_sig:
                report["deduped_edges"] += 1
                continue
            edges_by_id[e["id"]] = e
            edge_sig.add(sig)
        for ev in b.get("evidence", []):
            if ev.get("supportsNodeIds"):
                ev["supportsNodeIds"] = [canon(x) for x in ev["supportsNodeIds"]]
            if ev["id"] in ev_by_id:
                if ev_by_id[ev["id"]] == ev:
                    report["deduped_evidence"] += 1
                else:
                    report["conflicts"].append(f"evidence id reused with different content: {ev['id']}")
                continue
            ev_by_id[ev["id"]] = ev
        zp = R1 / f"zh_{m}.json"
        if zp.exists():
            zh.update(json.load(open(zp)))

    # drop dangling edges (endpoint neither live nor in merged nodes)
    ok_ids = live_ids | set(nodes_by_id)
    for eid, e in list(edges_by_id.items()):
        if e["source"] not in ok_ids or e["target"] not in ok_ids:
            report["dropped_edges"].append(f"{eid} ({e['source']} -> {e['target']})")
            del edges_by_id[eid]

    # evidence references sanity (node/edge refs must resolve after merge)
    ok_edge_ids = {e["id"] for e in edges_by_id.values()} | live_ids
    for ev in ev_by_id.values():
        for ref in ev.get("supportsNodeIds", []) or []:
            if ref not in ok_ids:
                report["conflicts"].append(f"evidence {ev['id']} supports missing node {ref}")
        for ref in ev.get("supportsEdgeIds", []) or []:
            if ref not in ok_edge_ids:
                report["conflicts"].append(f"evidence {ev['id']} supports missing edge {ref}")

    merged["nodes"] = list(nodes_by_id.values())
    merged["edges"] = list(edges_by_id.values())
    merged["evidence"] = list(ev_by_id.values())

    # near-duplicate org-id warning: ids that collapse to the same alnum form
    # (e.g. org_nan_ya_pcb vs org_nanya_pcb) but were not alias-mapped
    seen_forms = {}
    for nid in list(nodes_by_id) + sorted(live_ids):
        if not nid.startswith("org_"):
            continue
        form = re.sub(r"[^a-z0-9]", "", nid)
        if form in seen_forms and seen_forms[form] != nid:
            report["conflicts"].append(f"possible duplicate org ids: {seen_forms[form]} vs {nid}")
        seen_forms.setdefault(form, nid)

    zh_missing = [n["id"] for n in merged["nodes"] if n["id"] not in zh]

    out = R1 / "batch_round1_merged.json"
    json.dump(merged, open(out, "w"), indent=1, ensure_ascii=False)
    json.dump(zh, open(R1 / "zh_round1_merged.json", "w"), indent=1, ensure_ascii=False)

    print(json.dumps({
        "modules_missing": report["missing"],
        "nodes": len(merged["nodes"]),
        "edges": len(merged["edges"]),
        "evidence": len(merged["evidence"]),
        "orgs": sum(1 for n in merged["nodes"] if n.get("kind") == "organization"),
        "dropped_existing": report["dropped_existing"],
        "deduped_nodes": report["deduped_nodes"],
        "deduped_edges": report["deduped_edges"],
        "deduped_evidence": report["deduped_evidence"],
        "dropped_edges": report["dropped_edges"],
        "conflicts": report["conflicts"],
        "zh_missing": zh_missing,
    }, indent=1, ensure_ascii=False))
    return 1 if report["conflicts"] else 0


if __name__ == "__main__":
    sys.exit(main())
