import { loadGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
const full = loadGraphData();
const names = ["Harmonic Drive Systems", "Nabtesco", "Leaderdrive"];
for (const nm of names) {
  const n = full.nodes.find((x) => x.kind === "organization" && x.name.includes(nm.split(" ")[0]));
  console.log(nm, "→ domains:", n?.domain);
}
const { graph } = stripExposureLayer(full, []);
const s = JSON.stringify(graph);
console.log("after strip([]) — still present?:");
for (const nm of names) console.log("  ", nm, ":", s.includes(nm));
