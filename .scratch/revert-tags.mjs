import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const REUSED = ["org_eaton","org_schaeffler","org_skf","org_honeywell_aerospace_space","org_amphenol","org_te_connectivity","org_linde","org_air_liquide","org_dupont"];
const TAG = "spacex_reusable_launch";
let n = 0;
for (const f of readdirSync("data/nodes").filter((x) => x.endsWith(".json"))) {
  const p = "data/nodes/" + f;
  const root = JSON.parse(readFileSync(p, "utf8"));
  const arr = Array.isArray(root) ? root : root.nodes;
  let changed = false;
  for (const node of arr) {
    if (REUSED.includes(node.id) && Array.isArray(node.domain) && node.domain.includes(TAG)) {
      node.domain = node.domain.filter((t) => t !== TAG); changed = true; n++;
    }
  }
  if (changed) writeFileSync(p, JSON.stringify(root, null, 2) + "\n");
}
console.log(`reverted ${TAG} tag from ${n} reused org(s) — exposure still shows via root-reachable edges`);
