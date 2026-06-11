#!/usr/bin/env python3
"""Layer-0 self-check (zero-leak): mechanical rubric over the live ai_compute_chain data.

Per docs/agents/gpu-decomposition-brief.md §6 and the handoff feedback protocol:
runs entirely on repo data + query logs; never touches .eval/holdout or reports.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOMAIN = "ai_compute_chain"
COMPONENT_KINDS = {"module", "material", "manufacturing_process", "equipment"}
FORBIDDEN = re.compile(r"serenity|aleabitoreddit|白毛", re.IGNORECASE)


def load(kind):
    out = []
    for f in (ROOT / "data" / kind).glob("*.json"):
        out.extend(json.load(open(f)))
    return out


def main():
    nodes = load("nodes")
    edges = load("edges")
    evidence = {e["id"]: e for e in load("evidence")}

    dom_nodes = [n for n in nodes if DOMAIN in (n.get("domain") or [])]
    dom_ids = {n["id"] for n in dom_nodes}
    by_id = {n["id"]: n for n in nodes}
    components = [n for n in dom_nodes if n["kind"] in COMPONENT_KINDS]
    orgs = [n for n in dom_nodes if n["kind"] == "organization"]

    mfg = {}  # component -> [org ids]
    for e in edges:
        if e["relation"] == "manufactured_by" and e["source"] in dom_ids:
            mfg.setdefault(e["source"], []).append(e["target"])

    issues, stats = [], {}

    # R1/R7: org caps and org quality
    for comp, olist in mfg.items():
        if len(olist) > 5:
            issues.append(f"R7 orgs>5: {comp} has {len(olist)}")
    for o in orgs:
        metrics = o.get("metrics") or []
        names = {m.get("name", "") for m in metrics}
        if not any("listing" in n.lower() for n in names):
            issues.append(f"R7 org missing listing metric (ok if private, verify): {o['id']}")
        if not any("share" in n.lower() or "share" in (m.get("description") or "").lower() for n, m in zip(names, metrics)):
            issues.append(f"R1 org missing share metric: {o['id']}")
        if not o.get("evidenceIds"):
            issues.append(f"R6 org without evidenceIds: {o['id']}")

    # R4: bottleneck claims quantified + evidenced. A node counts as evidenced
    # if it carries evidenceIds OR any evidence record supports it (or one of
    # its manufactured_by / requires edges) via supports*Ids.
    supported_nodes = set()
    supported_edges = set()
    for e in evidence.values():
        supported_nodes.update(e.get("supportsNodeIds") or [])
        supported_edges.update(e.get("supportsEdgeIds") or [])
    edges_by_node = {}
    for e in edges:
        edges_by_node.setdefault(e["source"], []).append(e)
        edges_by_node.setdefault(e["target"], []).append(e)
    bn = [n for n in dom_nodes if n.get("bottleneckOf")]
    for n in bn:
        text = (n.get("description") or "") + json.dumps(n.get("metrics") or [])
        if not re.search(r"\d", text):
            issues.append(f"R4 bottleneck not quantified: {n['id']}")
        evidenced = bool(n.get("evidenceIds")) or n["id"] in supported_nodes or any(
            (e.get("evidenceIds") or e["id"] in supported_edges) for e in edges_by_node.get(n["id"], [])
        )
        if not evidenced:
            issues.append(f"R4 bottleneck without any evidence linkage: {n['id']}")

    # R5/R2: maturity + confidence presence on components
    for n in components:
        if n.get("maturityScore") is None:
            issues.append(f"R5 component missing maturityScore: {n['id']}")
        if not n.get("confidence"):
            issues.append(f"R5 component missing confidence: {n['id']}")

    # R6: evidence url coverage for domain evidence (prefix ev_acc_)
    dom_ev = [e for e in evidence.values() if e["id"].startswith("ev_acc_")]
    no_url = [e["id"] for e in dom_ev if not e.get("url")]
    if no_url:
        issues.append(f"R6 evidence without url: {no_url}")

    # depth uniformity per level-1 module
    children = {}
    for e in edges:
        if e["relation"] == "requires":
            children.setdefault(e["source"], []).append(e["target"])

    def depth(nid, seen=None):
        seen = seen or set()
        if nid in seen:
            return 0
        seen = seen | {nid}
        kids = [c for c in children.get(nid, []) if c in dom_ids]
        return 0 if not kids else 1 + max(depth(c, seen) for c in kids)

    product_kids = [c for c in children.get("ai_accelerator_module_hbm_cowos", []) if c in dom_ids]
    for m in product_kids:
        sub = set()
        stack = [m]
        while stack:
            cur = stack.pop()
            if cur in sub:
                continue
            sub.add(cur)
            stack.extend(c for c in children.get(cur, []) if c in dom_ids)
        n_orgs = sum(len(mfg.get(x, [])) for x in sub)
        frontier = sum(1 for x in sub if "decomposition_frontier" in (by_id[x].get("tags") or []) or by_id[x].get("frontierFor"))
        stats[m] = {"subtree_nodes": len(sub), "depth": depth(m), "orgs": n_orgs,
                    "bottlenecks": sum(1 for x in sub if by_id[x].get("bottleneckOf")),
                    "frontier_tags": frontier}

    # query-log hygiene
    qfiles = list((ROOT / ".scratch").rglob("*queries*.log")) + list((ROOT / ".scratch" / "round1").glob("*.log"))
    leak_hits = []
    for qf in set(qfiles):
        txt = qf.read_text(errors="ignore")
        if FORBIDDEN.search(txt):
            leak_hits.append(str(qf))
    # data files scan
    data_blob = json.dumps([n for n in dom_nodes]) + json.dumps(dom_ev)
    if FORBIDDEN.search(data_blob):
        leak_hits.append("DATA FILES CONTAIN FORBIDDEN TERMS")

    print(json.dumps({
        "components": len(components),
        "orgs": len(orgs),
        "bottleneck_nodes": len(bn),
        "module_stats": stats,
        "issue_count": len(issues),
        "issues": issues,
        "leak_scan_hits": leak_hits,
    }, indent=1, ensure_ascii=False))
    return 2 if leak_hits else (1 if issues else 0)


if __name__ == "__main__":
    sys.exit(main())
