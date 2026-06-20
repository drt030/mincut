import json, glob

OUT = glob.glob(".scratch/enrich-2026-06-15/*-out.json")
TARGETS = [
    "data/evidence/humanoid_robotics_evidence.json",
    "data/evidence/controlled_fusion_routes_evidence.json",
    "data/evidence/space_spacex_evidence.json",
]

# id -> (filepath, record)
index = {}
files = {}
for fp in TARGETS:
    data = json.load(open(fp, encoding="utf-8"))
    files[fp] = data
    for r in data:
        index[r["id"]] = (fp, r)

results = []
for of in OUT:
    results.extend(json.load(open(of, encoding="utf-8")))

applied = {"enriched": 0, "demote": 0, "paywalled": 0, "unsupported": 0, "missing": 0}
for res in results:
    rid = res["id"]
    if rid not in index:
        applied["missing"] += 1
        print("  MISSING id:", rid)
        continue
    _, rec = index[rid]
    verdict = res["verdict"]
    note = (res.get("note") or "").strip()
    if verdict == "enriched":
        rec["excerpt"] = res["excerpt"]
        rec["sourceStatus"] = res.get("sourceStatus") or "ok_exact"
        rec["machineCheck"] = {"status": "verified", "checkedAsOf": "2026-06-15", "quoteMatch": "exact"}
        if note:
            rec["limitations"] = note
        applied["enriched"] += 1
    else:
        rec["sourceStatus"] = res.get("sourceStatus") or "unreachable"
        rec["machineCheck"] = {"status": "failed", "checkedAsOf": "2026-06-15",
                               "notes": f"{verdict}: {note}" if note else verdict}
        if note:
            rec["limitations"] = f"{verdict}: {note}"
        applied[verdict] = applied.get(verdict, 0) + 1

for fp, data in files.items():
    json.dump(data, open(fp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    with open(fp, "a", encoding="utf-8") as f:
        f.write("\n")

print("applied:", applied)
for fp, data in files.items():
    ex = sum(1 for r in data if (r.get("excerpt") or "").strip())
    mv = sum(1 for r in data if (r.get("machineCheck") or {}).get("status") == "verified")
    print(f"  {fp.split('/')[-1]}: n={len(data)} excerpt={ex} machineCheck.verified={mv}")
