import json, glob
P = "data/evidence/parcel_sorting_robot_evidence.json"
data = json.load(open(P, encoding="utf-8"))
by = {r["id"]: r for r in data}
results = []
for of in sorted(glob.glob(".scratch/enrich-2026-06-15/parcel-*-out.json")):
    results.extend(json.load(open(of, encoding="utf-8")))
applied = {}
for res in results:
    rec = by.get(res["id"])
    if not rec:
        applied["missing"] = applied.get("missing", 0) + 1; continue
    v = res["verdict"]; note = (res.get("note") or "").strip()
    if v == "enriched":
        rec["excerpt"] = res["excerpt"]
        rec["sourceStatus"] = res.get("sourceStatus") or "ok_exact"
        rec["machineCheck"] = {"status": "verified", "checkedAsOf": "2026-06-15", "quoteMatch": "exact"}
        if note: rec["limitations"] = note
    else:
        rec["sourceStatus"] = res.get("sourceStatus") or "unreachable"
        rec["machineCheck"] = {"status": "failed", "checkedAsOf": "2026-06-15", "notes": f"{v}: {note}" if note else v}
        if note: rec["limitations"] = f"{v}: {note}"
    applied[v] = applied.get(v, 0) + 1
json.dump(data, open(P, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
open(P, "a", encoding="utf-8").write("\n")
ex = sum(1 for r in data if (r.get("excerpt") or "").strip())
mv = sum(1 for r in data if (r.get("machineCheck") or {}).get("status") == "verified")
print("applied:", applied, "| parcel now excerpt=" + str(ex), "machineCheck.verified=" + str(mv))
